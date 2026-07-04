import { randomUUID } from "node:crypto";
import type {
  CreateUserInput,
  PasswordResetRecord,
  StoredUser,
  UserRepository,
} from "./types.js";

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, StoredUser>();
  private resetTokens = new Map<string, PasswordResetRecord>();

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    if (await this.findUserByEmail(input.email)) {
      throw new Error("Email already exists");
    }

    const user: StoredUser = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };

    this.users.set(user.id, user);
    return user;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return (
      Array.from(this.users.values()).find((user) => user.email === email) ?? null
    );
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.users.get(id) ?? null;
  }

  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetRecord> {
    const record: PasswordResetRecord = {
      id: randomUUID(),
      tokenHash: input.tokenHash,
      userId: input.userId,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };

    this.resetTokens.set(record.tokenHash, record);
    return record;
  }

  async findPasswordResetToken(tokenHash: string): Promise<PasswordResetRecord | null> {
    return this.resetTokens.get(tokenHash) ?? null;
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    for (const record of this.resetTokens.values()) {
      if (record.id === id) {
        record.usedAt = new Date();
        return;
      }
    }
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.passwordHash = passwordHash;
    }
  }
}
