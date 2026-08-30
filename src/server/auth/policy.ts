import "server-only";

import type { Actor, UserActor } from "./actor";
import { GuestTokenService } from "./guest-token";
import { CasesRepository } from "../db/repositories/cases";
import { ClientsRepository } from "../db/repositories/clients";
import { IntakeRepository } from "../db/repositories/intake";
import { UsersRepository } from "../db/repositories/users";
import type { SqlExecutor } from "../db/types";
import { DomainError } from "../domain/shared/errors";
import type {
  CaseMemberRecord,
  CaseRecord,
  CaseRole,
  ConversationChannel,
  IntakeSessionRecord,
  UserRecord,
} from "../domain/shared/types";

const staffCaseRoles = new Set<CaseRole>([
  "lead_consultant",
  "consultant",
  "reviewer",
]);

export interface AuthorizedCaseActor {
  actor: UserActor;
  user: UserRecord;
  caseRecord: CaseRecord;
  membership: CaseMemberRecord;
}

export interface AuthorizedGuestCaseActor {
  actor: Extract<Actor, { kind: "guest" }>;
  user: null;
  caseRecord: CaseRecord;
  membership: null;
  guestSession: IntakeSessionRecord;
}

export type AuthorizedConversationActor = AuthorizedCaseActor | AuthorizedGuestCaseActor;

export class AuthorizationPolicy {
  private readonly users: UsersRepository;
  private readonly clients: ClientsRepository;
  private readonly intakes: IntakeRepository;
  private readonly cases: CasesRepository;

  constructor(
    database: SqlExecutor,
    private readonly guestTokens: GuestTokenService,
  ) {
    this.users = new UsersRepository(database);
    this.clients = new ClientsRepository(database);
    this.intakes = new IntakeRepository(database);
    this.cases = new CasesRepository(database);
  }

  async requireActiveUser(actor: Actor): Promise<UserRecord> {
    if (actor.kind !== "user") {
      throw new DomainError("UNAUTHENTICATED", "An authenticated user is required");
    }

    const user = await this.users.findById(actor.userId);
    if (!user || user.status !== "active") {
      throw new DomainError("UNAUTHENTICATED", "The user session is not active");
    }
    return user;
  }

  async requireIntakeAccess(
    actor: Actor,
    intakeSessionId: string,
  ): Promise<IntakeSessionRecord> {
    const session = await this.intakes.findSessionById(intakeSessionId);
    if (!session) {
      throw new DomainError("NOT_FOUND", "Intake session was not found");
    }

    if (actor.kind === "user") {
      await this.requireActiveUser(actor);
      if (session.ownerUserId !== actor.userId) {
        throw new DomainError("FORBIDDEN", "The intake does not belong to this user");
      }
      return session;
    }

    if (actor.kind === "guest") {
      const validToken =
        actor.intakeSessionId === session.id &&
        session.guestTokenHash === this.guestTokens.hash(actor.token);
      const expired =
        session.expiresAt !== null && new Date(session.expiresAt).getTime() <= Date.now();
      if (!validToken || expired || session.status === "expired") {
        throw new DomainError("FORBIDDEN", "The guest intake credential is invalid");
      }
      return session;
    }

    throw new DomainError("FORBIDDEN", "This actor cannot access an intake");
  }

  async requireActiveClientMembership(
    userId: string,
    clientAccountId: string,
  ) {
    const account = await this.clients.findAccountById(clientAccountId);
    const membership = await this.clients.findMembership(clientAccountId, userId);
    if (
      !account ||
      account.status !== "active" ||
      !membership ||
      membership.status !== "active"
    ) {
      throw new DomainError(
        "FORBIDDEN",
        "The user is not an active member of this client account",
      );
    }
    return { account, membership };
  }

  async requireCaseAccess(actor: Actor, caseId: string): Promise<AuthorizedCaseActor> {
    const user = await this.requireActiveUser(actor);
    const caseRecord = await this.cases.findCaseById(caseId);
    if (!caseRecord) {
      throw new DomainError("NOT_FOUND", "Case was not found");
    }
    const membership = await this.cases.findActiveMembership(caseId, user.id);
    if (!membership) {
      throw new DomainError("FORBIDDEN", "The user is not assigned to this case");
    }
    return { actor: actor as UserActor, user, caseRecord, membership };
  }

  async requireGuestCaseAccess(
    actor: Extract<Actor, { kind: "guest" }>,
    caseId: string,
  ): Promise<AuthorizedGuestCaseActor> {
    const session = await this.requireIntakeAccess(actor, actor.intakeSessionId);
    const caseRecord = await this.cases.findCaseById(caseId);
    if (!caseRecord) throw new DomainError("NOT_FOUND", "Case was not found");
    if (caseRecord.intakeSessionId !== session.id) {
      throw new DomainError("FORBIDDEN", "The guest credential does not own this case");
    }
    return {
      actor,
      user: null,
      caseRecord,
      membership: null,
      guestSession: session,
    };
  }

  async requireConversationAccess(
    actor: Actor,
    caseId: string,
    channel: ConversationChannel,
  ): Promise<AuthorizedConversationActor> {
    if (actor.kind === "guest") {
      if (channel !== "client") {
        throw new DomainError("FORBIDDEN", "Guest access is limited to the shared client conversation");
      }
      return this.requireGuestCaseAccess(actor, caseId);
    }
    const access = await this.requireCaseAccess(actor, caseId);
    if (channel === "internal" && !staffCaseRoles.has(access.membership.caseRole)) {
      throw new DomainError("FORBIDDEN", "Internal conversations are staff-only");
    }
    return access;
  }

  isStaffCaseRole(role: CaseRole): boolean {
    return staffCaseRoles.has(role);
  }

  async requireAssignableTarget(
    actor: Actor,
    caseRecord: CaseRecord,
    targetUserId: string,
    targetRole: CaseRole,
  ): Promise<{ actorUser: UserRecord; targetUser: UserRecord; actorMembership: CaseMemberRecord | null }> {
    const actorUser = await this.requireActiveUser(actor);
    const targetUser = await this.users.findById(targetUserId);
    if (!targetUser || targetUser.status !== "active") {
      throw new DomainError("NOT_FOUND", "Target user was not found or is inactive");
    }

    const clientTarget = targetRole === "client_owner" || targetRole === "client_collaborator";
    if (clientTarget !== (targetUser.globalRole === "client")) {
      throw new DomainError("VALIDATION_ERROR", "The target user's role is incompatible");
    }

    if (clientTarget) {
      if (!caseRecord.clientAccountId) {
        throw new DomainError("INVALID_STATE", "The case has no verified client account");
      }
      await this.requireActiveClientMembership(targetUser.id, caseRecord.clientAccountId);
    }

    const actorMembership = await this.cases.findActiveMembership(
      caseRecord.id,
      actorUser.id,
    );

    if (actorUser.globalRole === "admin") {
      return { actorUser, targetUser, actorMembership };
    }

    if (
      actorMembership?.caseRole === "lead_consultant" &&
      staffCaseRoles.has(targetRole)
    ) {
      return { actorUser, targetUser, actorMembership };
    }

    if (
      actorMembership?.caseRole === "client_owner" &&
      targetRole === "client_collaborator"
    ) {
      return { actorUser, targetUser, actorMembership };
    }

    throw new DomainError("FORBIDDEN", "The actor cannot assign this case role");
  }
}
