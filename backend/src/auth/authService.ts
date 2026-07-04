import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { AuthResponse, AuthUser, UserRole } from "@fpf/shared";
import { getDashboardRoute } from "./dashboard.js";
import type { JwtUser, StoredUser, UserRepository } from "./types.js";

const passwordSaltRounds = 12;
const resetTokenMinutes = 60;

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
    const user = await this.users.findUserByEmail(input.email);
    if (!user || user.status !== "ACTIVE") {
      throw new AuthError("Invalid email or password", 401);
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AuthError("Invalid email or password", 401);
    }

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
    const token = jwt.sign(
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

    return {
      user: publicUser(user),
      token,
      expiresIn,
    };
  }
}
