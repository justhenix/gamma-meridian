import { loadEnvConfig } from "@next/env";

import { getDatabaseClient } from "../src/server/db/client";
import { applyMigrations } from "../src/server/db/migrations";
import { ClientsRepository } from "../src/server/db/repositories/clients";
import { UsersRepository } from "../src/server/db/repositories/users";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  if (process.env.NODE_ENV === "production") {
    throw new Error("Synthetic development seeds are disabled in production");
  }

  const database = getDatabaseClient();
  try {
    await applyMigrations(database);
    const users = new UsersRepository(database);
    const admin =
      (await users.findByEmail("admin@synthetic.meridian.test")) ??
      (await users.create({
        authSubject: "synthetic:development-admin",
        email: "admin@synthetic.meridian.test",
        displayName: "Synthetic Development Admin",
        globalRole: "admin",
        status: "active",
        emailVerifiedAt: new Date().toISOString(),
      }));
    const partner =
      (await users.findByEmail("hendrik.prasetyo@meridiantax.com")) ??
      (await users.create({
        authSubject: "synthetic:development-partner",
        email: "hendrik.prasetyo@meridiantax.com",
        displayName: "Hendrik Prasetyo, BAP, S.H.",
        globalRole: "admin",
        status: "active",
        emailVerifiedAt: new Date().toISOString(),
      }));
    const consultant =
      (await users.findByEmail("maya.kusuma@meridiantax.com")) ??
      (await users.create({
        authSubject: "synthetic:development-consultant",
        email: "maya.kusuma@meridiantax.com",
        displayName: "Maya Kusuma, S.E., BKP",
        globalRole: "consultant",
        status: "active",
        emailVerifiedAt: new Date().toISOString(),
      }));
    const client =
      (await users.findByEmail("client@synthetic.meridian.test")) ??
      (await users.create({
        authSubject: "synthetic:development-client",
        email: "client@synthetic.meridian.test",
        displayName: "Synthetic Development Client",
        globalRole: "client",
        status: "active",
        emailVerifiedAt: new Date().toISOString(),
      }));

    const clients = new ClientsRepository(database);
    const existingAccountResult = await database.execute({
      sql: `
        SELECT id FROM client_accounts
        WHERE created_by_user_id = ? AND display_name = ?
        LIMIT 1
      `,
      args: [client.id, "Synthetic Development Company"],
    });
    const existingAccountId = existingAccountResult.rows[0]?.id;
    const account =
      typeof existingAccountId === "string"
        ? (await clients.findAccountById(existingAccountId))!
        : await clients.createAccount({
            accountType: "company",
            legalName: "PT Synthetic Development — Not a Real Client",
            displayName: "Synthetic Development Company",
            countryCode: "ID",
            preferredLocale: "id",
            createdByUserId: client.id,
          });
    await clients.addMember({
      clientAccountId: account.id,
      userId: client.id,
      membershipRole: "owner",
      invitedByUserId: client.id,
    });

    console.log(JSON.stringify({
      adminUserId: admin.id,
      partnerUserId: partner.id,
      consultantUserId: consultant.id,
      clientUserId: client.id,
      clientAccountId: account.id,
    }, null, 2));
  } finally {
    database.close();
  }
}

void main();
