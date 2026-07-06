import type { AccountStatus, AuthUser, UserRole } from "@fpf/shared";

export type StoredUser = AuthUser & {
  passwordHash: string;
};

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  role: Exclude<UserRole, "ADMIN">;
};

export type PasswordResetRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export type UserRepository = {
  createUser(input: CreateUserInput): Promise<StoredUser>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetRecord>;
  findPasswordResetToken(tokenHash: string): Promise<PasswordResetRecord | null>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  recordLogin(input: { userId?: string | null; email: string; success: boolean }): Promise<void>;
  initializeClient?(): void;
  checkConnection?(): Promise<void>;
};

export type JwtUser = {
  sub: string;
  role: UserRole;
  email: string;
};

export type RequestUser = AuthUser & {
  status: AccountStatus;
};
