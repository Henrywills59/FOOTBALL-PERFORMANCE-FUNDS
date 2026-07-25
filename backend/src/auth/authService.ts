import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { AuthResponse, AuthUser, PublicUserRole, UserRole } from "@fpf/shared";
import { isPrismaConnectionPressureError } from "../database/prismaErrors.js";
import type { NotificationDeliveryService } from "../integrations/notificationProviders.js";
import { buildFrontendUrl } from "../config/publicUrls.js";
import { getDashboardRoute } from "./dashboard.js";
import type { JwtUser, StoredUser, UserRepository } from "./types.js";

const passwordSaltRounds = 12;
const resetTokenMinutes = 60;

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const visiblePrefix = localPart.slice(0, 2);
  return domain ? `${visiblePrefix}***@${domain}` : `${visiblePrefix}***`;
}

function runtimeFlag(name: string) {
  return Boolean(process.env[name]?.trim());
}

function safeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: "Unknown error" };
  }

  return {
    name: error.constructor.name,
    message: error.message,
    code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
  };
}

type LoginStageName =
  | "environment"
  | "prismaClient"
  | "databaseConnection"
  | "adminUserLookup"
  | "passwordHashVerification"
  | "jwtSigning"
  | "auditHistoryWrite";

type LoginDiagnosticStage = {
  stage: LoginStageName;
  status: "SUCCESS" | "FAILURE";
  detail?: Record<string, unknown>;
  error?: ReturnType<typeof safeErrorDetails>;
};

function loginStage(
  stage: LoginStageName,
  status: LoginDiagnosticStage["status"],
  detail?: Record<string, unknown>,
  error?: unknown,
): LoginDiagnosticStage {
  const result: LoginDiagnosticStage = {
    stage,
    status,
    ...(detail ? { detail } : {}),
    ...(error ? { error: safeErrorDetails(error) } : {}),
  };

  const logPayload = {
    stage,
    status,
    ...(detail ? { detail } : {}),
    ...(error ? { error: safeErrorDetails(error) } : {}),
  };

  if (status === "SUCCESS") {
    console.info("AUTH_LOGIN_STAGE", logPayload);
  } else {
    console.error("AUTH_LOGIN_STAGE", logPayload);
  }

  return result;
}

function publicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwtSecret: string,
    private readonly notificationDeliveryService?: NotificationDeliveryService,
  ) {}

  async register(input: {
    name: string;
    email: string;
    password: string;
    role: PublicUserRole;
  }): Promise<AuthResponse> {
    const existingUser = await this.users.findUserByEmail(input.email);
    if (existingUser) {
      throw new AuthError("An account with this email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(input.password, passwordSaltRounds);
    const user = await this.users.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });
    await this.sendAccountNotification(user.email, {
      title: "Welcome to Football Performance Fund",
      message: "Your Football Performance Fund account has been created. Please verify your email when verification is enabled.",
      purpose: "EMAIL_VERIFICATION",
      metadata: { userId: user.id, role: user.role },
    });

    return this.createAuthResponse(user, false);
  }

  async login(input: {
    email: string;
    password: string;
    rememberMe: boolean;
  }): Promise<AuthResponse> {
    const maskedEmail = maskEmail(input.email);
    console.info("Auth login started", {
      email: maskedEmail,
      rememberMe: input.rememberMe,
      databaseUrlConfigured: runtimeFlag("DATABASE_URL"),
      jwtSecretConfigured: runtimeFlag("JWT_SECRET"),
    });
    loginStage("environment", runtimeFlag("DATABASE_URL") && runtimeFlag("JWT_SECRET") ? "SUCCESS" : "FAILURE", {
      email: maskedEmail,
      databaseUrlConfigured: runtimeFlag("DATABASE_URL"),
      jwtSecretConfigured: runtimeFlag("JWT_SECRET"),
    });

    let user: StoredUser | null;
    try {
      user = await this.users.findUserByEmail(input.email);
      loginStage("adminUserLookup", "SUCCESS", {
        email: maskedEmail,
        userFound: Boolean(user),
        userStatus: user?.status,
        userRole: user?.role,
      });
      console.info("Auth login user lookup completed", {
        email: maskedEmail,
        userFound: Boolean(user),
        userStatus: user?.status,
        userRole: user?.role,
      });
    } catch (error) {
      loginStage("adminUserLookup", "FAILURE", { email: maskedEmail }, error);
      console.error("Auth login user lookup failed", {
        email: maskedEmail,
        error: safeErrorDetails(error),
      });
      throw error;
    }

    if (!user || user.status !== "ACTIVE") {
      await this.recordLoginAttempt({ email: input.email, success: false });
      throw new AuthError("Invalid email or password", 401);
    }

    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
      loginStage("passwordHashVerification", "SUCCESS", {
        email: maskedEmail,
        userId: user.id,
        passwordMatches,
      });
      console.info("Auth login password verification completed", {
        email: maskedEmail,
        userId: user.id,
        passwordMatches,
      });
    } catch (error) {
      loginStage("passwordHashVerification", "FAILURE", {
        email: maskedEmail,
        userId: user.id,
        passwordHashPresent: Boolean(user.passwordHash),
        passwordHashLength: user.passwordHash?.length ?? 0,
      }, error);
      console.error("Auth login password verification failed", {
        email: maskedEmail,
        userId: user.id,
        error: safeErrorDetails(error),
      });
      throw error;
    }

    if (!passwordMatches) {
      await this.recordLoginAttempt({ userId: user.id, email: input.email, success: false });
      throw new AuthError("Invalid email or password", 401);
    }

    await this.recordLoginAttempt({ userId: user.id, email: input.email, success: true });
    return this.createAuthResponse(user, input.rememberMe);
  }

  async debugLogin(input: {
    email: string;
    password: string;
    rememberMe: boolean;
  }) {
    const stages: LoginDiagnosticStage[] = [];
    const maskedEmail = maskEmail(input.email);
    const expiresIn = input.rememberMe ? "30d" : "1d";

    const environment = {
      databaseUrlConfigured: runtimeFlag("DATABASE_URL"),
      jwtSecretConfigured: runtimeFlag("JWT_SECRET"),
      nodeEnv: process.env.NODE_ENV ?? "development",
    };
    stages.push(
      loginStage(
        "environment",
        environment.databaseUrlConfigured && environment.jwtSecretConfigured ? "SUCCESS" : "FAILURE",
        environment,
      ),
    );

    try {
      this.users.initializeClient?.();
      stages.push(
        loginStage("prismaClient", "SUCCESS", {
          repositorySupportsInitialization: Boolean(this.users.initializeClient),
        }),
      );
    } catch (error) {
      stages.push(loginStage("prismaClient", "FAILURE", { email: maskedEmail }, error));
      return {
        ok: false,
        failedStage: "prismaClient",
        stages,
      };
    }

    try {
      await this.users.checkConnection?.();
      stages.push(
        loginStage("databaseConnection", "SUCCESS", {
          repositorySupportsConnectionCheck: Boolean(this.users.checkConnection),
        }),
      );
    } catch (error) {
      stages.push(loginStage("databaseConnection", "FAILURE", { email: maskedEmail }, error));
      return {
        ok: false,
        failedStage: "databaseConnection",
        stages,
      };
    }

    let user: StoredUser | null;
    try {
      user = await this.users.findUserByEmail(input.email);
      stages.push(
        loginStage("adminUserLookup", "SUCCESS", {
          email: maskedEmail,
          userFound: Boolean(user),
          userId: user?.id,
          role: user?.role,
          status: user?.status,
          passwordHashPresent: Boolean(user?.passwordHash),
          passwordHashLength: user?.passwordHash?.length ?? 0,
        }),
      );
    } catch (error) {
      stages.push(loginStage("adminUserLookup", "FAILURE", { email: maskedEmail }, error));
      return {
        ok: false,
        failedStage: "adminUserLookup",
        stages,
      };
    }

    if (!user || user.status !== "ACTIVE") {
      return {
        ok: false,
        failedStage: "adminUserLookup",
        stages,
        authResult: "Invalid email or password",
      };
    }

    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
      stages.push(
        loginStage("passwordHashVerification", "SUCCESS", {
          email: maskedEmail,
          userId: user.id,
          passwordMatches,
        }),
      );
    } catch (error) {
      stages.push(
        loginStage("passwordHashVerification", "FAILURE", {
          email: maskedEmail,
          userId: user.id,
          passwordHashPresent: Boolean(user.passwordHash),
          passwordHashLength: user.passwordHash?.length ?? 0,
        }, error),
      );
      return {
        ok: false,
        failedStage: "passwordHashVerification",
        stages,
      };
    }

    if (!passwordMatches) {
      return {
        ok: false,
        failedStage: "passwordHashVerification",
        stages,
        authResult: "Invalid email or password",
      };
    }

    try {
      jwt.sign(
        {
          role: user.role,
          email: user.email,
        },
        this.jwtSecret,
        {
          subject: user.id,
          expiresIn,
        },
      );
      stages.push(
        loginStage("jwtSigning", "SUCCESS", {
          userId: user.id,
          role: user.role,
          expiresIn,
          jwtSecretConfigured: runtimeFlag("JWT_SECRET"),
        }),
      );
    } catch (error) {
      stages.push(loginStage("jwtSigning", "FAILURE", { userId: user.id, role: user.role }, error));
      return {
        ok: false,
        failedStage: "jwtSigning",
        stages,
      };
    }

    try {
      await this.users.recordLogin({ userId: user.id, email: input.email, success: true });
      stages.push(
        loginStage("auditHistoryWrite", "SUCCESS", {
          userId: user.id,
          email: maskedEmail,
        }),
      );
    } catch (error) {
      stages.push(loginStage("auditHistoryWrite", "FAILURE", { userId: user.id, email: maskedEmail }, error));
      return {
        ok: false,
        failedStage: "auditHistoryWrite",
        stages,
      };
    }

    return {
      ok: true,
      stages,
      user: publicUser(user),
    };
  }

  async requestPasswordReset(email: string) {
    const user = await this.users.findUserByEmail(email);
    if (!user) {
      return {
        message: "If an account exists, a password reset email will be sent.",
      };
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + resetTokenMinutes * 60 * 1000);

    await this.users.createPasswordResetToken({
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt,
    });
    await this.notificationDeliveryService?.sendPasswordReset(user.email, this.passwordResetUrl(token), {
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      message: "If an account exists, a password reset email will be sent.",
      resetToken: process.env.NODE_ENV === "production" ? undefined : token,
    };
  }

  async resetPassword(input: { token: string; password: string }) {
    const record = await this.users.findPasswordResetToken(hashResetToken(input.token));
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new AuthError("This password reset link is invalid or expired", 400);
    }

    const passwordHash = await bcrypt.hash(input.password, passwordSaltRounds);
    await this.users.updatePassword(record.userId, passwordHash);
    await this.users.markPasswordResetTokenUsed(record.id);
    const user = await this.users.findUserById(record.userId);
    if (user) {
      await this.sendAccountNotification(user.email, {
        title: "Football Performance Fund password changed",
        message: "Your account password was changed successfully. Contact support immediately if this was not you.",
        purpose: "SECURITY_ALERT",
        metadata: { userId: user.id },
      });
    }

    return {
      message: "Password updated successfully.",
    };
  }

  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }) {
    const user = await this.users.findUserById(input.userId);
    if (!user) {
      throw new AuthError("Unauthorized", 401);
    }

    const passwordMatches = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new AuthError("Current password is incorrect", 400);
    }

    const passwordHash = await bcrypt.hash(input.newPassword, passwordSaltRounds);
    await this.users.updatePassword(user.id, passwordHash);
    await this.sendAccountNotification(user.email, {
      title: "Football Performance Fund password changed",
      message: "Your account password was changed successfully. Contact support immediately if this was not you.",
      purpose: "SECURITY_ALERT",
      metadata: { userId: user.id },
    });

    return {
      message: "Password updated successfully.",
    };
  }

  async getUserFromToken(token: string): Promise<AuthUser> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtUser;
      const user = await this.users.findUserById(payload.sub);
      if (!user || user.status !== "ACTIVE") {
        throw new AuthError("Unauthorized", 401);
      }

      return publicUser(user);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      if (isPrismaConnectionPressureError(error)) {
        throw error;
      }

      throw new AuthError("Unauthorized", 401);
    }
  }

  getDashboardForRole(role: UserRole) {
    return getDashboardRoute(role);
  }

  private createAuthResponse(user: StoredUser, rememberMe: boolean): AuthResponse {
    const expiresIn = rememberMe ? "30d" : "1d";
    let token: string;

    try {
      token = jwt.sign(
        {
          role: user.role,
          email: user.email,
        },
        this.jwtSecret,
        {
          subject: user.id,
          expiresIn,
        },
      );
      console.info("Auth login JWT generated", {
        userId: user.id,
        role: user.role,
        expiresIn,
        jwtSecretConfigured: runtimeFlag("JWT_SECRET"),
      });
      loginStage("jwtSigning", "SUCCESS", {
        userId: user.id,
        role: user.role,
        expiresIn,
        jwtSecretConfigured: runtimeFlag("JWT_SECRET"),
      });
    } catch (error) {
      loginStage("jwtSigning", "FAILURE", { userId: user.id, role: user.role }, error);
      console.error("Auth login JWT generation failed", {
        userId: user.id,
        role: user.role,
        error: safeErrorDetails(error),
      });
      throw error;
    }

    return {
      user: publicUser(user),
      token,
      expiresIn,
    };
  }

  private async recordLoginAttempt(input: {
    userId?: string | null;
    email: string;
    success: boolean;
  }) {
    try {
      await this.users.recordLogin(input);
      console.info("Auth login audit recorded", {
        email: maskEmail(input.email),
        userId: input.userId,
        success: input.success,
      });
      loginStage("auditHistoryWrite", "SUCCESS", {
        email: maskEmail(input.email),
        userId: input.userId,
        success: input.success,
      });
    } catch (error) {
      loginStage("auditHistoryWrite", "FAILURE", {
        email: maskEmail(input.email),
        userId: input.userId,
        success: input.success,
      }, error);
      console.error("Auth login audit failed; continuing authentication flow", {
        email: maskEmail(input.email),
        userId: input.userId,
        success: input.success,
        error: safeErrorDetails(error),
      });
    }
  }

  private passwordResetUrl(token: string) {
    return buildFrontendUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  }

  private async sendAccountNotification(
    to: string,
    input: {
      title: string;
      message: string;
      purpose: "EMAIL_VERIFICATION" | "SECURITY_ALERT" | "ACCOUNT_NOTIFICATION";
      metadata?: Record<string, unknown>;
    },
  ) {
    try {
      const result = await this.notificationDeliveryService?.send("EMAIL", {
        to,
        title: input.title,
        message: input.message,
        purpose: input.purpose,
        metadata: input.metadata,
      });
      if (result) {
        console.info("AUTH_NOTIFICATION_DELIVERY", {
          purpose: input.purpose,
          provider: result.provider,
          status: result.status,
          delivered: result.delivered,
          attempts: result.attempts,
        });
      }
    } catch (error) {
      console.error("AUTH_NOTIFICATION_DELIVERY_FAILED", {
        purpose: input.purpose,
        error: safeErrorDetails(error),
      });
    }
  }
}
