import "server-only";

import type { Row } from "@libsql/client";

import { createId, nowIso } from "../../domain/shared/ids";
import type {
  ClientAccountMemberRecord,
  ClientAccountRecord,
  ClientAccountType,
  ClientMembershipRole,
  Locale,
} from "../../domain/shared/types";
import { optionalString, requiredString } from "../row";
import type { SqlExecutor } from "../types";

export interface CreateClientAccountInput {
  accountType: ClientAccountType;
  legalName: string;
  displayName: string;
  countryCode: string;
  preferredLocale?: Locale;
  createdByUserId: string;
}

export interface AddClientAccountMemberInput {
  clientAccountId: string;
  userId: string;
  membershipRole: ClientMembershipRole;
  invitedByUserId: string;
}

function mapClientAccount(row: Row): ClientAccountRecord {
  return {
    id: requiredString(row, "id"),
    accountType: requiredString(row, "account_type") as ClientAccountType,
    legalName: requiredString(row, "legal_name"),
    displayName: requiredString(row, "display_name"),
    countryCode: requiredString(row, "country_code"),
    preferredLocale: requiredString(row, "preferred_locale") as Locale,
    status: requiredString(row, "status") as "active" | "archived",
    createdByUserId: requiredString(row, "created_by_user_id"),
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  };
}

function mapClientMember(row: Row): ClientAccountMemberRecord {
  return {
    id: requiredString(row, "id"),
    clientAccountId: requiredString(row, "client_account_id"),
    userId: requiredString(row, "user_id"),
    membershipRole: requiredString(row, "membership_role") as ClientMembershipRole,
    status: requiredString(row, "status") as "active" | "removed",
    invitedByUserId: requiredString(row, "invited_by_user_id"),
    createdAt: requiredString(row, "created_at"),
    removedAt: optionalString(row, "removed_at"),
  };
}

export class ClientsRepository {
  constructor(private readonly database: SqlExecutor) {}

  async createAccount(input: CreateClientAccountInput): Promise<ClientAccountRecord> {
    const id = createId();
    const timestamp = nowIso();
    await this.database.execute({
      sql: `
        INSERT INTO client_accounts (
          id, account_type, legal_name, display_name, country_code,
          preferred_locale, status, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `,
      args: [
        id,
        input.accountType,
        input.legalName.trim(),
        input.displayName.trim(),
        input.countryCode.trim().toUpperCase(),
        input.preferredLocale ?? "id",
        input.createdByUserId,
        timestamp,
        timestamp,
      ],
    });
    return (await this.findAccountById(id))!;
  }

  async findAccountById(id: string): Promise<ClientAccountRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, account_type, legal_name, display_name, country_code,
               preferred_locale, status, created_by_user_id, created_at, updated_at
        FROM client_accounts
        WHERE id = ?
      `,
      args: [id],
    });
    return result.rows[0] ? mapClientAccount(result.rows[0]) : null;
  }

  async addMember(input: AddClientAccountMemberInput): Promise<ClientAccountMemberRecord> {
    const id = createId();
    const timestamp = nowIso();
    await this.database.execute({
      sql: `
        INSERT INTO client_account_members (
          id, client_account_id, user_id, membership_role, status,
          invited_by_user_id, created_at, removed_at
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, NULL)
        ON CONFLICT(client_account_id, user_id) DO UPDATE SET
          membership_role = excluded.membership_role,
          status = 'active',
          invited_by_user_id = excluded.invited_by_user_id,
          removed_at = NULL
      `,
      args: [
        id,
        input.clientAccountId,
        input.userId,
        input.membershipRole,
        input.invitedByUserId,
        timestamp,
      ],
    });
    return (await this.findMembership(input.clientAccountId, input.userId))!;
  }

  async findMembership(
    clientAccountId: string,
    userId: string,
  ): Promise<ClientAccountMemberRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, client_account_id, user_id, membership_role, status,
               invited_by_user_id, created_at, removed_at
        FROM client_account_members
        WHERE client_account_id = ? AND user_id = ?
      `,
      args: [clientAccountId, userId],
    });
    return result.rows[0] ? mapClientMember(result.rows[0]) : null;
  }

  async findReusableAccountForUser(input: {
    userId: string;
    accountType: ClientAccountType;
    displayName: string;
  }): Promise<ClientAccountRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT ca.id, ca.account_type, ca.legal_name, ca.display_name, ca.country_code,
               ca.preferred_locale, ca.status, ca.created_by_user_id, ca.created_at, ca.updated_at
        FROM client_accounts AS ca
        JOIN client_account_members AS cam ON cam.client_account_id = ca.id
        WHERE cam.user_id = ?
          AND cam.status = 'active'
          AND ca.status = 'active'
          AND ca.account_type = ?
          AND lower(ca.display_name) = lower(?)
        ORDER BY ca.created_at
        LIMIT 1
      `,
      args: [input.userId, input.accountType, input.displayName.trim()],
    });
    return result.rows[0] ? mapClientAccount(result.rows[0]) : null;
  }
}
