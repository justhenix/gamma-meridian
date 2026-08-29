import type { Client } from "@libsql/client";

import { ClientsRepository } from "../../src/server/db/repositories/clients";
import { UsersRepository } from "../../src/server/db/repositories/users";
import type {
  ClientAccountRecord,
  UserRecord,
  UserRole,
} from "../../src/server/domain/shared/types";

let fixtureSequence = 0;

export async function createUser(
  database: Client,
  role: UserRole,
  label: string = role,
): Promise<UserRecord> {
  fixtureSequence += 1;
  return new UsersRepository(database).create({
    authSubject: `synthetic:${label}:${fixtureSequence}`,
    email: `${label}-${fixtureSequence}@example.test`,
    displayName: `${label} ${fixtureSequence}`,
    globalRole: role,
    status: "active",
    emailVerifiedAt: new Date().toISOString(),
  });
}

export async function createClientAccountWithOwner(
  database: Client,
  owner: UserRecord,
): Promise<ClientAccountRecord> {
  const clients = new ClientsRepository(database);
  const account = await clients.createAccount({
    accountType: "company",
    legalName: "Synthetic Client PT",
    displayName: "Synthetic Client",
    countryCode: "ID",
    createdByUserId: owner.id,
  });
  await clients.addMember({
    clientAccountId: account.id,
    userId: owner.id,
    membershipRole: "owner",
    invitedByUserId: owner.id,
  });
  return account;
}

export async function addClientAccountMember(
  database: Client,
  account: ClientAccountRecord,
  user: UserRecord,
): Promise<void> {
  await new ClientsRepository(database).addMember({
    clientAccountId: account.id,
    userId: user.id,
    membershipRole: "member",
    invitedByUserId: account.createdByUserId,
  });
}
