import { PrismaClient } from "@prisma/client";
import { prisma as sharedPrisma } from "../database/prismaClient.js";
import type {
  CreateUserInput,
  PasswordResetRecord,
  StoredUser,
  UserRepository,
} from "./types.js";

function toStoredUser(user: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: StoredUser["role"];
  status: StoredUser["status"];
  createdAt: Date;
}): StoredUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma = sharedPrisma) {}

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    const user = await this.prisma.user.create({
      data: input,
    });

    return toStoredUser(user);
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user ? toStoredUser(user) : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    return user ? toStoredUser(user) : null;
  }

  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetRecord> {
    return this.prisma.passwordResetToken.create({
      data: input,
    });
  }

  async findPasswordResetToken(tokenHash: string): Promise<PasswordResetRecord | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async recordLogin(input: { userId?: string | null; email: string; success: boolean }): Promise<void> {
    await this.prisma.loginHistory.create({
      data: input,
    });
  }
}
