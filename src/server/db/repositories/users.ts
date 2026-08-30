import "server-only";

import type { Row } from "@libsql/client";

import { createId, nowIso } from "../../domain/shared/ids";
import type {
  Locale,
  UserRecord,
  UserRole,
  UserStatus,
} from "../../domain/shared/types";
import { optionalString, requiredString } from "../row";
import type { SqlExecutor } from "../types";

export interface CreateUserInput {
  authSubject: string;
  email: string;
  displayName: string;
  globalRole: UserRole;
  locale?: Locale;
  status?: UserStatus;
  emailVerifiedAt?: string | null;
}

function mapUser(row: Row): UserRecord {
  return {
    id: requiredString(row, "id"),
    authSubject: requiredString(row, "auth_subject"),
    emailNormalized: requiredString(row, "email_normalized"),
    displayName: requiredString(row, "display_name"),
    globalRole: requiredString(row, "global_role") as UserRole,
    locale: requiredString(row, "locale") as Locale,
    status: requiredString(row, "status") as UserStatus,
    emailVerifiedAt: optionalString(row, "email_verified_at"),
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  };
}

export class UsersRepository {
  constructor(private readonly database: SqlExecutor) {}

  async create(input: CreateUserInput): Promise<UserRecord> {
    const id = createId();
    const timestamp = nowIso();
    await this.database.execute({
      sql: `
        INSERT INTO users (
          id, auth_subject, email_normalized, display_name, global_role,
          locale, status, email_verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        input.authSubject,
        input.email.trim().toLowerCase(),
        input.displayName.trim(),
        input.globalRole,
        input.locale ?? "id",
        input.status ?? "active",
        input.emailVerifiedAt ?? null,
        timestamp,
        timestamp,
      ],
    });
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, auth_subject, email_normalized, display_name, global_role,
               locale, status, email_verified_at, created_at, updated_at
        FROM users
        WHERE id = ?
      `,
      args: [id],
    });
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, auth_subject, email_normalized, display_name, global_role,
               locale, status, email_verified_at, created_at, updated_at
        FROM users
        WHERE email_normalized = ?
      `,
      args: [email.trim().toLowerCase()],
    });
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }
}
