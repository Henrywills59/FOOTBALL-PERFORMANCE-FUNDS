import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { AuthResponse, AuthUser, UserRole } from "@fpf/shared";
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
  ) {}

  async register(input: {
    name: string;
    email: string;
    password: string;
    role: Exclude<UserRole, "ADMIN">;
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

    let user: StoredUser | null;
    try {
      user = await this.users.findUserByEmail(input.email);
      console.info("Auth login user lookup completed", {
        email: maskedEmail,
        userFound: Boolean(user),
        userStatus: user?.status,
        userRole: user?.role,
      });
    } catch (error) {
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
      console.info("Auth login password verification completed", {
        email: maskedEmail,
        userId: user.id,
        passwordMatches,
      });
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Auth login audit failed; continuing authentication flow", {
        email: maskEmail(input.email),
        userId: input.userId,
        success: input.success,
        error: safeErrorDetails(error),
      });
    }
  }
}
