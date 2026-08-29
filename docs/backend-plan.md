# Meridian Backend MVP Plan

Status: planning only  
Last reviewed: 2026-08-29  
Scope: backend architecture for the MVP; no frontend or implementation is included.

## Repository baseline

The repository is currently a small Next.js 16.3.3 App Router scaffold with TypeScript, Paraglide, shadcn/Tailwind, and `@libsql/client` 0.17.4. Backend-relevant code is limited to `src/lib/turso.ts`, which creates a Turso client. There are no migrations, tables, auth dependencies, route handlers, server actions, AI integrations, object storage, validation library, job system, or tests yet.

Two existing details should be addressed only when implementation starts:

- `src/lib/turso.ts` is not marked server-only and falls back to a placeholder production URL. The eventual database module should fail closed when required configuration is missing and must never be importable by client code.
- This project uses `src/middleware.ts`. Next.js 16 calls this convention `proxy.ts`. Proxy may later perform cheap route redirects, but it must not be the authorization boundary.

The working tree already contains frontend changes and untracked `copy.md` and `design.md`; this plan does not alter them.

## 1. Backend principles

1. **Build a modular monolith.** Keep one Next.js application, one Turso database, and a small number of external providers. Put domain logic in server-only modules, not in React components, actions, or HTTP handlers.
2. **Treat every enquiry as confidential.** Minimize collection, use least-privilege access, keep storage private, avoid sensitive request-body logs, and record access to case details and documents.
3. **Authorize at the data boundary.** Every query and mutation must derive the actor from a verified server session and check access to the specific case or client account. Page visibility, Proxy redirects, hidden buttons, and object IDs are not security controls.
4. **Make important records append-only or versioned.** Messages, AI runs, recommendation versions, calculation runs, source versions, and audit events are not silently overwritten. Corrections create a new record or an explicit redaction event.
5. **Ground AI in approved, versioned sources.** A model may only use source sections that Meridian has ingested, hashed, dated, and approved. A citation must point to the exact source version and locator used in that run.
6. **Use rules for safety decisions.** Deterministic, versioned rules decide whether a case may stay AI-first. Model confidence is supporting metadata, never the primary safety gate.
7. **Use code for arithmetic.** Money, rates, thresholds, rounding, deadlines, and projections use reviewed TypeScript implementations with test fixtures. Values use integer minor units or canonical decimal strings, never binary floating-point arithmetic.
8. **Keep side effects explicit and idempotent.** Case creation, status changes, recommendations, messages, document callbacks, and AI triggers accept an idempotency key and use database uniqueness constraints to prevent duplicates.
9. **Keep transactions short.** Never hold a database transaction open while calling an LLM, sending email, scanning a file, or fetching a regulation.
10. **Prefer refusal or escalation over unsupported output.** Missing sources, missing facts, conflicts, outdated rules, provider failures, or invalid citations route the case to a person rather than producing a best guess.
11. **Do not cache confidential data across users.** Reads of case data should be request-time, explicitly authorized, and returned through minimal DTOs. Sensitive HTTP responses should use `Cache-Control: private, no-store` where relevant.
12. **Design deletion and retention before collecting data.** Retention is category-specific and subject to legal review; it is not “keep everything forever.”

These choices follow the current [Next.js data-security guidance](https://nextjs.org/docs/app/guides/data-security) to use a server-only data access layer (DAL), re-authorize every Server Action/Route Handler, and return minimal DTOs. Route Handlers are public endpoints and Server Actions are externally reachable mutation entry points, as described in the [Backend for Frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend).

Legal and regulatory notes in this plan are engineering constraints, not legal advice. Before production, Indonesian counsel should confirm the processing basis, notices, retention schedule, processor contracts, incident process, and international data transfers under [Law No. 27 of 2022 on Personal Data Protection](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/undangundang%2Bnomor%2B27%2Btahun%2B2022). A tax professional should separately confirm tax-record and professional-confidentiality duties under the current consolidated KUP framework.

## 2. MVP architecture

### 2.1 Shape of the system

```text
Browser
  -> Next.js Server Components (authorized reads through DAL)
  -> Server Actions (small, same-origin mutations)
  -> Route Handlers (guest endpoints, uploads, callbacks, webhooks)
       -> application/domain services
            -> authorization policy
            -> Turso repositories + audit writer
            -> private object storage
            -> auth, AI, email, and malware-scan providers
```

There is no separate admin backend. Admin, consultant, reviewer, client, and guest experiences use the same backend services with different policies and DTOs.

### 2.2 Actor assumptions

- **Guest:** may start and resume one intake through a random, single-scope bearer token. Only the token hash is stored. It expires quickly and cannot expose recommendations, case documents, internal notes, or other client data.
- **Client user:** an authenticated person linked to one or more client accounts. Client-account membership permits account-level actions such as starting a case; explicit case membership controls access to each case.
- **Consultant:** an authenticated Meridian staff user. Access is limited to assigned cases. A consultant may write internal notes, request information, and draft recommendations.
- **Reviewer:** a consultant assigned the reviewer role on a particular case. This is a case role, not another global identity type.
- **Admin:** manages users, client memberships, assignments, approved sources, and calculation templates. An admin should not silently browse every case. For the MVP, an admin who needs case content adds themself as a case member with a reason; both actions are audited.
- **System/AI:** non-human actors with no login session and no independent authorization. They act only through a service operation tied to a case, ruleset version, and audit record.

### 2.3 Authentication assumptions

- Use a mature auth library or managed identity provider; do not build password storage, password resets, session cryptography, or MFA from scratch.
- Prefer verified email sign-in for clients. Require MFA for consultants and admins. Staff accounts should be invite-only.
- Keep provider identity separate from application authorization. The provider authenticates a subject; the `users` table and case memberships decide what that subject may do.
- Use server-verified sessions in `HttpOnly`, `Secure`, `SameSite=Lax` or stricter cookies. Session payloads contain only opaque identifiers and minimal role hints; secure authorization always re-reads current application data.
- Store no auth access token in local storage. Do not store passwords in Meridian's application tables.
- The provider choice is a phase-zero decision because its hosting location, subprocessors, log retention, account-recovery controls, and support for staff MFA affect confidentiality and Indonesian cross-border-transfer analysis.
- Provider-owned auth/session tables, if any, remain provider schema. They are not mixed into Meridian domain tables.

### 2.4 Organizations decision

A generic `organizations`/multi-tenant hierarchy is **not necessary for the MVP**. Meridian is one consulting firm. `client_accounts` represents an individual or company customer, `client_account_members` represents its people, and `case_members` provides exact case access.

Add a true organization/tenant abstraction later only if Meridian hosts multiple consulting firms, requires white-labelling, or needs complex corporate-group inheritance. A corporate client account is not the same thing as a platform tenant.

### 2.5 Infrastructure choices

- **Application:** Next.js on Vercel, Node runtime for backend modules unless a provider explicitly requires another runtime.
- **Relational data:** one Turso database through the existing `@libsql/client`. No read replicas, database-per-client, or ORM is required to prove the MVP.
- **Files:** a private object store (for example, Vercel Blob or S3-compatible storage) with short-lived signed URLs. Turso stores metadata, hashes, and access policy, not file blobs.
- **AI:** one provider behind a narrow adapter. Store the model/version and provider request ID for every call; prohibit provider training on client data and select the lowest feasible retention setting.
- **Regulatory corpus:** curated official sources ingested as deterministic text sections. Start with database text search/topic filters; do not add a vector database until retrieval quality requires one.
- **Background work:** no general queue initially. See section 9.4.

## 3. Domain model

### 3.1 Core relationships

```text
User -> Client-account membership -> Client account
User -> Case membership -----------> Case <---- submitted Intake session
                                          |---- Conversations -> Messages
                                          |---- Documents
                                          |---- AI runs -> source sections
                                          |---- Escalations
                                          |---- Recommendation versions -> citations
                                          |---- Calculation runs -> approved template
                                          `---- Audit events

Regulatory source -> Source version -> Source section
Calculation template -> approved source sections
```

### 3.2 Aggregate boundaries

- **Intake aggregate:** a resumable draft, its answers, guest/user ownership, expiration, and immutable submission boundary.
- **Case aggregate:** current lifecycle state, risk level, participants, and the authoritative link to all case work.
- **Conversation aggregate:** ordered append-only communication in either the client-shared or staff-internal channel.
- **AI evidence aggregate:** exact input/output snapshots, prompt/ruleset/model versions, and the source sections provided to the model.
- **Recommendation aggregate:** immutable versions with approval and publication states. Only a published version is client-visible.
- **Calculation aggregate:** an approved template and immutable executions. The model is never the calculation engine.
- **Regulatory corpus aggregate:** stable source identity, immutable versions, deterministic sections, approval, and effective dates.
- **Audit aggregate:** append-only security and business events referencing records rather than duplicating their confidential contents.

### 3.3 Important invariants

- A submitted intake cannot be edited. A correction arrives as a new client message or a consultant-authored case note.
- A user sees a case only if an active `case_members` record allows it. Client-account membership alone does not reveal all historical cases.
- Client DTOs never include internal conversations, raw AI runs, unpublished recommendations, source-ingestion notes, or unrestricted audit records.
- Only approved source versions and sections can enter an AI context or calculation-template basis.
- A recommendation version never changes content after it enters review. Revisions create the next version.
- An AI-origin recommendation cannot mark itself approved or override an escalation.
- Publishing a recommendation and recording its audit event occur in the same database transaction.
- A calculation run stores the exact template version, canonical inputs, canonical outputs, and engine version.
- A quarantined/unscanned document cannot be downloaded by clients, parsed, sent to an LLM, or used as evidence.
- Audit events are not updateable through normal repositories.

## 4. Database schema

### 4.1 SQLite/Turso conventions

- Use opaque sortable text IDs (UUIDv7 or ULID), not sequential public IDs.
- Store timestamps in UTC using one canonical representation across all tables. Public case references must be random and non-enumerable.
- Enable and test foreign-key enforcement. Use `CHECK` constraints for enums/booleans and `CHECK(json_valid(column))` for JSON.
- Prefer `NOT NULL` and explicit defaults. Use foreign keys with `RESTRICT` for submitted business records; use cascade only for disposable, unsubmitted draft children.
- Parameterize all SQL. Do not assemble filters, identifiers, or sort expressions from untrusted strings.
- Add indexes for every foreign key used in authorization and list queries, plus `(case_id, created_at)`, active memberships, open escalations, source effective dates, and status queues.
- Use numbered SQL migrations when implementation begins, but do not create them as part of this plan.
- Keep application content in Indonesian or English as UTF-8 text. Store money as integer minor units when possible; otherwise use currency plus canonical decimal strings. Never use SQLite `REAL` for tax arithmetic.
- Treat JSON as a bounded schema escape hatch for variable intake answers and model output, not as a substitute for core relational fields.

### 4.2 Proposed tables

#### `users`

- **Purpose:** map one authenticated person to Meridian's application identity and global actor type.
- **Important fields:** `id`, `auth_subject` (unique), `email_normalized` (unique), `display_name`, `global_role` (`client`, `consultant`, `admin`), `locale`, `status` (`invited`, `active`, `suspended`), `email_verified_at`, `created_at`, `updated_at`.
- **Relationships:** referenced by client-account memberships, case memberships, messages, approvals, assignments, calculations, and audit events.
- **MVP vs later:** MVP uses one global role plus per-case roles. Later, add multi-role policy tables, SCIM/SSO, delegated administrators, and richer staff credentials only if needed.

#### `client_accounts`

- **Purpose:** represent the customer about whom cases are created, either an individual or a company.
- **Important fields:** `id`, `account_type` (`individual`, `company`), `legal_name`, `display_name`, `country_code`, `preferred_locale`, `status`, `created_by_user_id`, `created_at`, `updated_at`.
- **Relationships:** has client-account members and cases.
- **MVP vs later:** do not collect NPWP, national ID, full address, group structure, or beneficial owners unless the approved intake genuinely requires them. Later sensitive identifiers should be application-encrypted, with a keyed lookup hash only when search is necessary.

#### `client_account_members`

- **Purpose:** connect authenticated client users to a client account and control account-level administration.
- **Important fields:** `id`, `client_account_id`, `user_id`, `membership_role` (`owner`, `member`), `status`, `invited_by_user_id`, `created_at`, `removed_at`; unique active `(client_account_id, user_id)`.
- **Relationships:** belongs to one client account and one user. It enables case creation/invitations but does not by itself grant access to every case.
- **MVP vs later:** later roles may include billing contact, entity administrator, and read-only member. Do not add hierarchical inheritance now.

#### `intake_sessions`

- **Purpose:** hold a resumable guided-interview draft before it becomes a case.
- **Important fields:** `id`, `owner_user_id` (nullable), `guest_token_hash` (nullable, unique), `contact_email_ciphertext` (nullable), `contact_email_lookup_hash` (nullable), `intake_schema_version`, `locale`, `status` (`draft`, `submitted`, `claimed`, `expired`), `expires_at`, `submitted_at`, `row_version`, `created_at`, `updated_at`.
- **Relationships:** has intake answers and pre-submission documents; a submitted session is linked one-to-one to a case.
- **MVP vs later:** the question definitions live in version-controlled TypeScript/config for MVP. A database-driven form builder, partial-submission analytics, anonymous tracking, and multiple submissions are later work.

#### `intake_answers`

- **Purpose:** store the latest answer for each versioned intake question while the intake is a draft and preserve it after submission.
- **Important fields:** `id`, `intake_session_id`, `question_key`, `question_version`, `answer_json`, `data_classification`, `created_at`, `updated_at`; unique `(intake_session_id, question_key)`.
- **Relationships:** belongs to one intake session; the resulting case reaches answers through its intake link.
- **MVP vs later:** draft answers may be replaced before submission; submission locks all answers. Later, if the business needs formal amended questionnaires, add submission/revision records rather than editing the original.

#### `cases`

- **Purpose:** authoritative record for an enquiry and its current lifecycle/risk state.
- **Important fields:** `id`, `case_reference` (unique random display value), `intake_session_id` (nullable, unique), `client_account_id` (nullable until a guest claim is verified), `created_by_user_id` (nullable), `title`, `primary_jurisdiction`, `tax_topics_json`, `tax_period_start`, `tax_period_end`, `status`, `risk_level` (`unknown`, `low`, `medium`, `high`), `ruleset_version`, `row_version`, `received_at`, `resolved_at`, `closed_at`, `created_at`, `updated_at`.
- **Relationships:** has members, conversations, documents, AI runs, escalations, recommendation versions, calculation runs, and audit events.
- **MVP vs later:** no billing, engagement-letter workflow, CRM pipeline, deadlines calendar, parent/child matters, or legal hold engine. Add only when operationally proven.

#### `case_members`

- **Purpose:** exact access list for a case, covering both client and staff collaborators.
- **Important fields:** `id`, `case_id`, `user_id`, `case_role` (`client_owner`, `client_collaborator`, `lead_consultant`, `consultant`, `reviewer`), `added_by_user_id`, `reason`, `created_at`, `removed_at`; unique active `(case_id, user_id)`.
- **Relationships:** belongs to one case and one user. Authorization queries always include this table unless a narrowly defined system operation is running.
- **MVP vs later:** fixed roles are sufficient. Field-level grants, temporary access, teams, information barriers, and delegated review groups are later features.

#### `conversations`

- **Purpose:** separate client-visible communication from confidential staff-only discussion.
- **Important fields:** `id`, `case_id`, `channel` (`client`, `internal`), `status` (`open`, `closed`), `created_by_user_id`, `created_at`, `closed_at`; unique `(case_id, channel)` for MVP.
- **Relationships:** belongs to a case and has ordered messages.
- **MVP vs later:** create exactly one client and one internal conversation per case. Multiple threads, mentions, email ingestion, and real-time presence are deferred.

#### `messages`

- **Purpose:** append-only human, AI, and system communication.
- **Important fields:** `id`, `conversation_id`, `author_type` (`user`, `ai`, `system`), `author_user_id` (nullable), `ai_run_id` (nullable), `body_markdown`, `language`, `status` (`active`, `redacted`), `client_request_id` (nullable, unique per conversation), `created_at`, `redacted_at`, `redacted_by_user_id`.
- **Relationships:** belongs to one conversation; may reference an AI run and documents.
- **MVP vs later:** no silent edits. Redaction retains a tombstone and audit event. Reactions, typing indicators, read receipts, and full email synchronization are later.

#### `documents`

- **Purpose:** store attachment metadata and security state while file bytes remain in private object storage.
- **Important fields:** `id`, `case_id` (nullable before submission), `intake_session_id` (nullable), `message_id` (nullable), `uploaded_by_user_id` (nullable), `original_filename`, `storage_provider`, `storage_key` (unique, random), `content_type`, `byte_size`, `sha256`, `classification`, `scan_status` (`pending`, `clean`, `quarantined`, `rejected`), `processing_status`, `created_at`, `deleted_at`. A check constraint requires an intake or case context.
- **Relationships:** belongs to an intake or case and optionally a message. On submission, draft documents are atomically attached to the new case.
- **MVP vs later:** MVP stores metadata, scan result, and access audit only. OCR, document classification, extracted tables, versioned documents, e-signatures, and generated tax forms are deferred.

#### `regulatory_sources`

- **Purpose:** stable identity for an authoritative law, regulation, treaty, ruling, or official guidance document.
- **Important fields:** `id`, `official_identifier`, `title`, `authority`, `jurisdiction`, `source_type`, `canonical_url`, `status` (`active`, `retired`), `created_at`, `updated_at`.
- **Relationships:** has immutable source versions.
- **MVP vs later:** only a manually curated allowlist of official sources. Do not crawl arbitrary blogs or let the model add sources. Automated monitoring and broader source types come later.

#### `regulatory_source_versions`

- **Purpose:** preserve the exact edition/effective period used for advice.
- **Important fields:** `id`, `regulatory_source_id`, `version_label`, `publication_date`, `effective_from`, `effective_to`, `retrieved_at`, `raw_object_key`, `content_sha256`, `review_status` (`pending`, `approved`, `rejected`, `superseded`), `reviewed_by_user_id`, `reviewed_at`, `supersedes_version_id`, `created_at`.
- **Relationships:** belongs to a stable source and has deterministic source sections.
- **MVP vs later:** source approval is manual and mandatory. Later add scheduled update detection, change diffs, dual review, and source licensing metadata.

#### `regulatory_source_sections`

- **Purpose:** provide deterministic retrieval/citation units with stable locators.
- **Important fields:** `id`, `source_version_id`, `locator`, `heading`, `ordinal`, `body_text`, `body_sha256`, `tax_topics_json`, `created_at`; unique `(source_version_id, locator, ordinal)`.
- **Relationships:** belongs to one approved source version; referenced by AI-run context, recommendation citations, and calculation-template sources.
- **MVP vs later:** use topic filters and SQLite text search over a small corpus. Embeddings, a vector index, semantic reranking, and multilingual source alignment are later and require measured retrieval failures first.

#### `ai_runs`

- **Purpose:** make every model invocation reproducible enough to audit and retry without storing hidden reasoning.
- **Important fields:** `id`, `case_id`, `purpose` (`triage`, `draft_response`, `citation_check`, `summarize`), `trigger_type`, `trigger_id`, `requested_by_user_id` (nullable), `status` (`pending`, `running`, `succeeded`, `failed`, `invalid`, `escalated`), `provider`, `model`, `provider_request_id`, `prompt_key`, `prompt_version`, `application_commit`, `ruleset_version`, `input_snapshot_json`, `input_sha256`, `output_json`, `output_sha256`, `input_tokens`, `output_tokens`, `latency_ms`, `error_code`, `started_at`, `completed_at`, `created_at`, `idempotency_key` (unique for one logical run).
- **Relationships:** belongs to a case, consumes source sections, and may produce messages, an escalation, or a recommendation version.
- **MVP vs later:** store the exact application-provided request/response needed for audit, but never request or store chain-of-thought. Later add eval scores, provider fallback, cost accounting, and offline replay tooling.

#### `ai_run_sources`

- **Purpose:** record the exact source sections and order/context hash supplied to an AI run.
- **Important fields:** `ai_run_id`, `source_section_id`, `context_ordinal`, `context_sha256`, `retrieval_method`, `retrieval_score` (nullable); primary key `(ai_run_id, source_section_id)`.
- **Relationships:** join between AI runs and regulatory source sections.
- **MVP vs later:** this is evidence, not a claim that the model interpreted the source correctly. Later retrieval diagnostics may add candidate/reranker data.

#### `escalations`

- **Purpose:** explicit, queryable human-escalation workflow and resolution history.
- **Important fields:** `id`, `case_id`, `ai_run_id` (nullable), `trigger_type` (`rule`, `ai_validation`, `client_request`, `consultant`, `system_failure`), `reason_codes_json`, `reason_text`, `severity`, `status` (`open`, `assigned`, `resolved`, `cancelled`), `assigned_to_user_id`, `resolved_by_user_id`, `resolution_code`, `resolution_note`, `created_at`, `assigned_at`, `resolved_at`; at most one active escalation per case.
- **Relationships:** belongs to a case and optionally the triggering AI run; assignment should match an active staff case member.
- **MVP vs later:** a single active escalation aggregates reasons. Queues, skill routing, SLA timers, workload balancing, and on-call schedules are deferred.

#### `recommendation_versions`

- **Purpose:** immutable versions of client-facing analysis/recommendations, with review and publication controls.
- **Important fields:** `id`, `case_id`, `version_number`, `origin` (`ai`, `human`, `hybrid`), `ai_run_id` (nullable), `author_user_id` (nullable), `language`, `content_json`, `content_sha256`, `status` (`draft`, `in_review`, `approved`, `published`, `superseded`, `withdrawn`), `supersedes_version_id`, `approved_by_user_id`, `approved_at`, `published_by_user_id` (nullable for an allowed AI-first release), `published_at`, `created_at`; unique `(case_id, version_number)`.
- **Relationships:** belongs to one case and has citations; may reference the originating AI run and a calculation run from its structured content.
- **MVP vs later:** only published versions are client-visible. Rich collaborative editing, tracked changes, signatures, and formal opinion-letter generation are deferred.

#### `recommendation_citations`

- **Purpose:** map each material recommendation claim to exact regulatory evidence.
- **Important fields:** `id`, `recommendation_version_id`, `source_section_id`, `claim_key`, `locator_snapshot`, `excerpt_snapshot`, `support_status` (`pending`, `verified`, `rejected`), `verified_by_user_id` (nullable), `verified_at`, `display_order`; unique `(recommendation_version_id, claim_key, source_section_id)`.
- **Relationships:** belongs to a recommendation version and an approved source section.
- **MVP vs later:** deterministic checks verify that the locator exists and excerpt matches the stored section. They cannot prove the legal interpretation; high-risk claims require professional review. Later add claim graphs or citation-quality evals only if useful.

#### `calculation_templates`

- **Purpose:** registry and approval metadata for deterministic tax calculations implemented in reviewed code.
- **Important fields:** `id`, `template_key`, `version`, `name`, `jurisdiction`, `effective_from`, `effective_to`, `implementation_key`, `implementation_version`, `input_schema_json`, `output_schema_json`, `rounding_policy_json`, `status` (`draft`, `approved`, `retired`), `approved_by_user_id`, `approved_at`, `created_at`; unique `(template_key, version)`.
- **Relationships:** has supporting source sections and calculation runs.
- **MVP vs later:** formulas are named TypeScript functions selected from a fixed registry, never executable expressions stored in the database. A visual formula builder and user-defined formulas are out of scope.

#### `calculation_template_sources`

- **Purpose:** record the regulatory basis for a calculation template/version.
- **Important fields:** `calculation_template_id`, `source_section_id`, `basis_note`; primary key `(calculation_template_id, source_section_id)`.
- **Relationships:** join between calculation templates and approved source sections.
- **MVP vs later:** a tax professional approves these links together with formula fixtures. Later add change-impact alerts when a source is superseded.

#### `calculation_runs`

- **Purpose:** immutable evidence of a deterministic calculation performed for a case.
- **Important fields:** `id`, `case_id`, `calculation_template_id`, `recommendation_version_id` (nullable), `executed_by_user_id` (nullable for system execution), `input_json`, `input_sha256`, `output_json`, `output_sha256`, `currency`, `engine_version`, `status` (`succeeded`, `failed`), `error_code`, `created_at`, `idempotency_key` (unique per logical execution).
- **Relationships:** belongs to a case and exact template version; may support a recommendation version.
- **MVP vs later:** canonical decimal strings/minor units are required in inputs/outputs. Scenario comparison, batch calculations, spreadsheets, and Monte Carlo projections are deferred.

#### `audit_events`

- **Purpose:** append-only history of important reads, writes, approvals, access changes, AI actions, and security events.
- **Important fields:** `id`, `case_id` (nullable), `actor_type` (`user`, `guest`, `ai`, `system`), `actor_user_id` (nullable), `actor_reference_id` (nullable), `event_type`, `target_type`, `target_id`, `request_id`, `reason_code`, `changed_fields_json`, `metadata_json`, `ip_hash` (nullable), `user_agent_hash` (nullable), `created_at`.
- **Relationships:** optionally scoped to a case and user/AI run. It references domain records rather than copying their full contents.
- **MVP vs later:** repositories expose insert only; application roles cannot update/delete events. This is an operational audit log, not tamper-proof WORM storage. Hash chaining, external immutable export, SIEM streaming, and cryptographic attestation are later hardening.

### 4.3 Tables deliberately not proposed

- No `organizations`, `tenants`, `teams`, or general RBAC graph.
- No `jobs`/`outbox` table until background reliability is actually needed.
- No vector/embedding table until corpus-search measurements justify it.
- No separate mutable `recommendations` header; the case and immutable versions are sufficient for MVP queries.
- No tax rates table that the LLM can edit. Rates belong in versioned, code-reviewed calculation implementations and fixtures.
- No database table for prompt templates or escalation rules in the MVP. Keep them version-controlled in code and write their version identifiers into each run.

## 5. Case lifecycle

### 5.1 Intake lifecycle

```text
draft -> submitted -> claimed
  `---------> expired (only before submission/claim, according to retention policy)
```

Submitting an intake runs one short transaction that:

1. checks the guest token or authenticated owner and the intake `row_version`;
2. validates required answers and confirms the session is still `draft`;
3. changes the session to `submitted` and locks its answers;
4. creates the case in `received`;
5. links/creates the client account if identity is already verified;
6. adds the client creator as a case member when applicable;
7. creates the client and internal conversations;
8. attaches clean intake documents to the case; and
9. appends case-created/intake-submitted audit events.

A guest receives only a receipt and account-claim path. Confidential case results require verified authentication. Guest access expires and is not a long-term case portal.

### 5.2 Case states

| State | Meaning | Typical next states |
| --- | --- | --- |
| `received` | Durable case exists; triage has not started | `triaging` |
| `triaging` | Deterministic pre-screen, source retrieval, and AI validation are running | `ai_response_ready`, `human_review_required`, `waiting_for_client` |
| `ai_response_ready` | A low-risk, source-grounded response passed every configured release gate | `resolved`, `human_review_required` |
| `human_review_required` | One or more hard escalation conditions apply | `consultant_working` |
| `consultant_working` | Assigned staff is investigating or drafting | `waiting_for_client`, `ready_for_review` |
| `waiting_for_client` | Missing facts/documents block safe progress | `triaging`, `consultant_working` |
| `ready_for_review` | A human/hybrid recommendation awaits reviewer approval | `resolved`, `consultant_working` |
| `resolved` | A published response/recommendation was delivered | `closed`, `consultant_working` (reopen) |
| `closed` | Operational work is complete; record remains under retention policy | `consultant_working` (admin/lead reopen with reason) |

### 5.3 Transition rules

- All transitions go through one `transitionCase` domain service; direct status updates are forbidden.
- The service checks the current state, actor capability, case membership, prerequisites, and expected `row_version`.
- Status update and audit event commit in one transaction.
- AI failures never strand a case in a terminal failure state. They create an escalation and move to `human_review_required` or return a stale `triaging` run to `received` through an audited recovery action.
- Resolving a case requires a published recommendation/response or an explicit non-advice resolution code such as duplicate, withdrawn, or insufficient information.
- Reopening requires a reason and creates a new recommendation version rather than editing the published one.

## 6. AI -> human escalation flow

### 6.1 Processing flow

1. **Durable intake first.** Commit the case before calling any external model.
2. **Deterministic pre-screen.** A code-versioned ruleset evaluates structured answers for jurisdiction, tax topic, deadlines, amount/materiality, dispute status, cross-border elements, ambiguity, missing facts, and explicit client request for a person.
3. **Retrieve approved evidence.** Select only approved source versions effective for the relevant jurisdiction and tax period. Pass exact section text and stable locators.
4. **Minimal model input.** Send only facts necessary for the purpose. Mask identity and financial details that are not needed. Treat client messages and documents as untrusted data, never as model instructions.
5. **Strict structured output.** Require schema-valid JSON containing classification, missing facts, risk flags, assumptions, material claims, cited section IDs, and a draft response. The model does not calculate tax.
6. **Deterministic post-validation.** Verify schema, allowlisted source IDs, effective dates, exact excerpt/locator matches, required claim coverage, prohibited wording, and all hard escalation flags.
7. **Route outcome.** Create an AI-first draft only when every allowlist rule passes. Otherwise create/update the escalation, assign a consultant, and expose no unsupported draft to the client.
8. **Version and log.** Store the AI run, supplied source sections, output hash, recommendation version, citations, decision, status transition, and audit events.

### 6.2 Hard escalation conditions for the initial ruleset

These should route to a human regardless of model confidence:

- cross-border, treaty, permanent-establishment, transfer-pricing, CFC, beneficial-ownership, or multi-jurisdiction questions;
- audits, SP2DK responses, objections, appeals, litigation, investigations, sanctions, or an imminent statutory deadline;
- material transactions, restructurings, M&A, related-party arrangements, uncertain entity classification, or unusually high amounts;
- contradictory facts/documents, missing required facts, source conflicts, no approved/effective source, or citation validation failure;
- requests to file, sign, represent, certify, guarantee an outcome, or provide a formal tax opinion;
- any case outside the accountant-approved AI-first allowlist;
- any user request to speak to a consultant;
- provider error, malformed output, prompt-injection signal, or ruleset/model version not approved for production.

Thresholds and the exact allowlist must be supplied and signed off by an Indonesian tax professional; this plan intentionally does not invent them.

### 6.3 AI-first release policy

The safe default at launch is human review. AI-first client release may be enabled per narrowly defined case category only after a tax professional approves:

- the required intake facts;
- source corpus and update process;
- deterministic risk gates;
- response template and disclaimer;
- citation-coverage rules;
- model/prompt version and evaluation results; and
- an incident/rollback owner.

An AI-first response should be framed as source-grounded general information and next steps, not a formal opinion or filing instruction. A published AI response remains versioned, attributable to the system, and reopenable by a consultant.

### 6.4 What must never be delegated blindly to an LLM

- final interpretation of ambiguous law or resolution of conflicting authorities;
- approval of regulatory sources or determination that a source is current/effective;
- deciding whether a treaty, exemption, incentive, safe harbour, filing position, or professional privilege applies;
- tax arithmetic, currency conversion, rate selection, thresholds, rounding, deadlines, penalties, or projections;
- approving/publishing high-risk advice or overriding an escalation rule;
- verifying document authenticity, identity, authority to act, signatures, or legal representation rights;
- submitting returns, objections, appeals, payments, or communications to authorities;
- changing permissions, deleting data, setting retention/legal holds, or altering audit history;
- deciding that a data transfer, consent, NDA, or confidentiality statement is legally sufficient;
- inventing a citation, source text, taxpayer fact, or missing number.

## 7. Auditability model

### 7.1 Three layers of evidence

1. **Current operational state:** `cases`, memberships, open escalation, and conversation status support fast application queries.
2. **Immutable/versioned work product:** intake at submission, messages, AI runs and their exact source context, recommendation versions/citations, calculation runs, source versions, and document hashes preserve what was actually used.
3. **Append-only event trail:** `audit_events` explains who/what caused important state, access, approval, publication, and security changes.

### 7.2 Events that must be logged

- guest intake created, resumed after verification, submitted, claimed, expired, or deleted;
- case created, viewed in detail, status changed, reopened, resolved, or closed;
- client/staff member added, role changed, removed, or admin self-assignment;
- message created/redacted and client/internal boundary changes;
- document upload finalized, scan state changed, downloaded, quarantined, or deleted;
- AI run requested, started, succeeded, failed, invalidated, retried, or released;
- escalation opened, assigned, resolved, cancelled, or overridden;
- regulatory source version approved, superseded, or rejected;
- recommendation version created, reviewed, approved, published, superseded, or withdrawn;
- calculation template approved/retired and calculation run executed;
- export, retention deletion, subject-access operation, authentication security event, or administrator action.

### 7.3 Audit content rules

- Audit metadata records IDs, event type, changed field names, reason, request ID, and hashes; it should not duplicate message bodies, answer contents, prompts, document text, or government identifiers.
- Every request gets a correlation ID. External provider request IDs live on the corresponding domain record.
- Store no secrets, session cookies, signed URLs, auth tokens, or raw IP addresses in logs. If abuse analysis needs IP correlation, use a rotating keyed hash and a documented short retention period.
- Redaction is a privileged, reasoned operation. Domain content becomes a tombstone or new version; the audit event remains without retaining unnecessarily sensitive content.
- Database-admin access remains a trust boundary in the MVP. Do not claim that this log is cryptographically tamper-proof until immutable export/hash-chain controls actually exist.

### 7.4 Confidentiality, retention, and incident basics

- Turso states that Cloud databases are encrypted at rest at the volume layer, with optional BYOK on higher plans; transport and application access still need verification. See the [official encryption documentation](https://docs.turso.tech/cloud/encryption).
- Use a private object bucket, random keys, server-authorized short-lived download URLs, malware scanning, content-type/size limits, and encryption at rest. Never expose storage keys as authorization.
- Keep production, preview, test, and local data separate. Never copy real case data into preview environments or AI evaluation fixtures.
- Secrets belong in Vercel environment configuration or a secret manager, scoped per environment and rotated. Do not put client data or secrets in telemetry/error messages.
- Before selecting Turso region, Vercel region, object storage, auth, email, malware scan, and AI provider, document data locations and subprocessors. Indonesian PDP Law Article 56 imposes conditions on transfers outside Indonesia; provider selection cannot be treated as a purely technical choice.
- PDP Law Articles 35-39 require appropriate security/confidentiality controls, Article 46 provides a written breach-notification deadline of at most `3 x 24` hours, and Articles 42-45 cover ending processing/deletion/destruction subject to applicable law. Meridian needs an incident owner and written runbook before live confidential data.
- The KUP framework protects taxpayer-confidential information and contains a ten-year storage rule for specified books, records, and documents underlying bookkeeping/recordkeeping. It does **not** justify retaining every intake draft, chat, model payload, or analytics event for ten years. Counsel and a tax professional must map which Meridian records are legally/contractually required. See the official DJP [consolidated KUP text as amended through the HPP law](https://www.pajak.go.id/sites/default/files/2021-11/SDSN%20UU%20KUP%20stdtd%20UU%20HPP.pdf).

Provisional MVP policy pending legal approval:

- unsubmitted guest intake: expire access after 7 days and delete content after 30 days;
- submitted/active case: retain while needed to provide the engagement;
- closed case/recommendations/calculations/source evidence: retain according to an approved case-record schedule, potentially up to ten years only when the record category requires it;
- raw application/security logs: short, documented retention; audit events follow the case schedule but remain content-minimized;
- AI provider-side storage: disabled or lowest available retention, no training, with processor terms recorded;
- backups and object versions: included in deletion/expiry design with a documented delayed purge window.

The confidentiality sentence in `copy.md` claims all communications are protected under institutional NDAs. That statement is risky unless an NDA/engagement term is actually executed and applicable. Product/legal must either implement the contracting evidence or soften the claim before launch.

## 8. Authorization model

### 8.1 Permission summary

| Capability | Guest | Client case member | Assigned consultant | Assigned reviewer | Admin |
| --- | --- | --- | --- | --- | --- |
| Resume draft intake | Token-scoped only | Own intake | No | No | Recovery with reason |
| Create case | Submit scoped intake | For linked client account | On behalf with authority | Same as consultant | Yes |
| View client-safe case data | Receipt only until claim | Yes | Yes | Yes | After case assignment/self-assignment |
| View internal conversation/raw AI run | No | No | Yes | Yes | After case assignment/self-assignment |
| Send client message/upload | Intake only | Yes | Yes | Yes | When assigned |
| Add internal note | No | No | Yes | Yes | When assigned |
| Draft recommendation | No | No | Yes | Yes | When assigned and professionally allowed |
| Approve/publish human-required advice | No | No | No unless separate reviewer policy allows | Yes | Only if assigned and reviewer-qualified |
| Manage case members | No | Client collaborators only, if owner | Lead consultant | Lead/reviewer as policy permits | Yes, audited |
| Approve sources/templates | No | No | No | Designated reviewer only | Designated admin/reviewer |
| View audit trail | No | Limited client timeline later | Case-scoped | Case-scoped | Operational scope, audited |

### 8.2 Enforcement rules

- Central policy helpers operate on a trusted session actor plus the fetched resource: `canViewCase`, `canSendMessage`, `canViewInternal`, `canManageMembers`, `canApproveRecommendation`, and similar.
- Repositories accept an authorization scope or are called only from services that have already established it. Sensitive fetches should join `case_members` rather than fetching by ID and checking later.
- Client reads use explicit DTOs/column lists. Never serialize raw rows into Server/Client Component props or action responses.
- Server Actions and Route Handlers both authenticate, authorize the exact resource, validate input, and constrain output. An action ID or valid UUID is not permission.
- Proxy may redirect unauthenticated users optimistically, but it does no database authorization and is never the only check.
- All file-download signing goes through a fresh case/document authorization check and clean scan-state check.
- Authenticated account status, membership status, and case membership are checked on every sensitive operation so suspension/removal takes effect immediately.

### 8.3 Guest safety

- Generate at least 128 bits of cryptographic randomness; store only a keyed hash of the token.
- Put the token in a secure cookie or one-time claim link, not analytics, referrers, support logs, or database plaintext.
- Rate-limit intake creation, token verification, contact verification, uploads, and submission by multiple signals.
- Do not reveal whether a client/account/email exists. Do not allow guest search or sequential references.
- After submission, show a generic receipt. Require verified authentication before showing confidential conversations, documents, or recommendations.

### 8.4 Concurrency and consistency

Turso's current `@libsql/client` write transactions use `BEGIN IMMEDIATE`; writes to the primary do not operate in parallel. Turso also documents optional MVCC/concurrent writes with conflict retries, but the default single-writer behavior is adequate for this MVP. See the [TypeScript client transaction reference](https://docs.turso.tech/sdk/ts/reference) and [concurrent-write guidance](https://docs.turso.tech/tursodb/concurrent-writes).

- Keep write transactions short and indexed; do not enable MVCC until contention is measured.
- Add `row_version` optimistic locking to mutable aggregates (`cases`, `intake_sessions`). Update with `WHERE id = ? AND row_version = ?`, increment on success, and return a conflict rather than overwriting another user's change.
- Messages, recommendations, AI runs, calculation runs, and audit events are append-only, which naturally reduces lost updates.
- Use unique idempotency keys for intake submission, message send, AI trigger, recommendation publish, calculation execution, and provider callbacks.
- Enforce invariants in SQL constraints as well as TypeScript: unique published version transitions, one active member pair, one open escalation, valid JSON, and valid enum values.
- Retry only documented transient busy/conflict errors with bounded jitter. Never retry validation, permission, or business-rule failures.
- Do not assume Server Actions serialize all users. They are sequential per client dispatcher only; separate browsers and functions still race.
- External calls follow a claim/commit/call/conditional-finalize pattern: create a `running` record, commit, call provider, then finalize only if the expected state/version still matches.

## 9. Suggested backend folder structure

```text
src/
  app/
    api/
      intake/                 # guest JSON endpoints only if UI actions are insufficient
      uploads/                # signed upload creation/finalization
      webhooks/               # auth/storage/scan/provider callbacks
    .../actions.ts            # thin same-origin mutation adapters
  server/
    auth/
      session.ts              # verify provider session; server-only
      actor.ts                # trusted application actor
      policy.ts               # resource authorization helpers
    db/
      client.ts               # validated Turso client; server-only
      transaction.ts
      repositories/           # parameterized persistence; no HTTP/UI logic
    dal/
      cases.ts                # authorized reads and minimal DTOs
      clients.ts
      sources.ts
    domain/
      intake/
      cases/
      conversations/
      ai/
      escalations/
      recommendations/
      calculations/
      documents/
      regulations/
      audit/
    integrations/
      auth/
      ai/
      email/
      object-storage/
      malware-scan/
    validation/               # shared boundary schemas
    observability/            # correlation IDs and redacted errors
  proxy.ts                    # optional cheap redirects only; not authorization

db/
  migrations/                 # numbered SQL files, added during implementation
  seeds/                      # synthetic development data and approved fixtures only

tests/
  domain/
  authorization/
  integration/
  fixtures/                   # synthetic cases, source snippets, calculation goldens
```

### 9.1 Data access boundary

- Server Components call DAL functions directly. They must not make HTTP requests to the application's own Route Handlers.
- DAL modules import `server-only`, verify the session, enforce resource access near the query, select explicit columns, and return narrow DTOs.
- Domain services own state transitions and invariants. Repositories do not decide product policy.

### 9.2 Server Actions

Use Server Actions for small same-origin, authenticated UI mutations such as sending a message, changing a case state, assigning a consultant, or publishing an approved recommendation.

Every action remains thin: parse/validate input, call a domain service, return a minimal success/error DTO, and revalidate/redirect. It re-authenticates and re-authorizes; it never trusts IDs, roles, ownership, hidden fields, or client-provided row data. Do not upload confidential files through Server Actions; current Next.js actions have a 1 MB default body limit and direct signed uploads are safer.

### 9.3 Route Handlers

Use Route Handlers only when an HTTP contract is actually useful:

- guest intake create/resume/submit if it cannot use an authenticated action;
- signed upload creation/finalization and private download signing;
- auth/email/object-storage/malware-scan webhooks and callbacks;
- an idempotent AI-run trigger/retry endpoint if it must outlive a page action;
- future external integrations.

Handlers validate content type and size, rate-limit public/expensive operations, authenticate webhooks cryptographically, set timeouts, avoid sensitive error details, and call the same domain services as actions. `GET` never mutates.

### 9.4 Background jobs

Do **not** add Inngest, Trigger.dev, BullMQ, Kafka, a custom worker, or a `jobs` table for the first MVP.

- After case creation commits, triage may run synchronously with an explicit provider timeout. Failure leaves a durable retryable case/AI-run record and alerts the staff queue; an admin can retry idempotently.
- Long AI work is never part of the case-creation transaction.
- File malware scanning may be performed by the storage/security provider asynchronously. Its signed webhook updates `scan_status`; files remain quarantined until a clean result.
- Regulatory updates are manually ingested/reviewed for the MVP.
- Retention cleanup and stale-run recovery may start as an explicit admin script/runbook.

Introduce a managed durable queue only when measured provider latency, Vercel duration limits, lost browser requests, volume, or retry/SLA requirements make synchronous execution unreliable. At that point add an outbox/job design with leases, attempts, backoff, dead-letter handling, and idempotent consumers; do not rely on fire-and-forget promises in a serverless function.

## 10. MVP implementation phases

No phase should start until this plan is reviewed. Each phase below is future implementation, not work performed by this document.

### Phase 0: professional and provider decisions

- Have a tax consultant approve the supported tax topics, source hierarchy, escalation matrix, AI-first allowlist, wording, and first calculation template.
- Have counsel/security approve PDP processing basis/notices, provider/subprocessor locations, cross-border transfers, retention categories, incident process, and the NDA/confidentiality claim.
- Choose auth, object storage, malware scan, email, and AI providers using those constraints.
- Define synthetic acceptance cases and clearly unsafe/adversarial cases.

### Phase 1: secure backend foundation

- Add validated server-only environment/database configuration.
- Establish migration tooling and create identity, client, membership, case, and audit foundations.
- Integrate provider authentication and staff MFA policy.
- Implement session actor, case-scoped authorization, DTOs, input validation, idempotency, and redacted observability.
- Add authorization/invariant tests before exposing case data.

### Phase 2: intake and human case workflow

- Implement guest/authenticated intake sessions, answer locking, case creation, case members, lifecycle transitions, conversations/messages, and audit events.
- Add admin/consultant assignment and client claim flow.
- Prove concurrent edits, duplicate submissions, access removal, and client/internal separation.
- This phase can operate without AI and should already be a usable human-led backend.

### Phase 3: regulatory grounding and escalation

- Implement manual source/version/section ingestion with professional approval.
- Add deterministic pre-screen rules, AI-run evidence, strict output validation, citations, escalation, and recommendation versioning.
- Run an offline evaluation set and red-team prompt injection/source-conflict/missing-data cases.
- Keep all output human-reviewed until the approved low-risk release gates meet agreed metrics.

### Phase 4: calculations and documents

- Implement the first accountant-approved calculation in versioned TypeScript with golden fixtures and boundary/rounding tests.
- Add calculation template/run evidence and citations.
- Add private signed uploads, metadata, hashing, malware-scan callbacks, quarantined processing, download authorization, and access audit.
- Do not send document content to AI until scan, minimization, and prompt-injection controls pass.

### Phase 5: operational hardening and limited launch

- Test backup restore, data export/deletion, retention runbook, incident response, stale AI-run recovery, and provider failure modes.
- Perform an authorization/IDOR review across every action, handler, DAL query, and signed file URL.
- Add rate limits, security headers, secret rotation, staff offboarding, and audit review procedures.
- Launch with a narrow source/topic allowlist and monitored human fallback, then expand from evidence rather than aspiration.

## 11. Deferred / out-of-scope features

Do **not** build these yet:

- frontend pages, dashboards, component work, or design-system changes;
- generic multi-tenancy, organization hierarchies, dynamic RBAC/ABAC, or per-field ACLs;
- microservices, GraphQL, event sourcing, Kafka, a general queue, or distributed workflow orchestration;
- a vector database, autonomous web crawler, autonomous regulation updater, knowledge graph, or model fine-tuning;
- custom password authentication, custom MFA, SSO/SCIM, account impersonation, or consumer social login;
- automated high-risk advice, formal opinions, filing, e-signatures, authority integrations, tax payments, or legal representation;
- automated source approval, legal interpretation, escalation override, or calculation generation by an LLM;
- billing, invoices, payments, CRM synchronization, engagement-letter automation, or consultant marketplace features;
- OCR pipelines, spreadsheet ingestion, document generation, bulk exports, or email/WhatsApp ingestion;
- real-time collaborative editing, WebSockets, presence, read receipts, reactions, and notification preference systems;
- database-per-client, multi-region active-active, client BYOK, immutable ledger/WORM claims, SIEM, and automated legal hold;
- complex analytics, model-cost dashboards, experimentation platforms, provider fallback, and automatic eval pipelines;
- a database-backed form builder, prompt editor, rules editor, or calculation formula builder.

## 12. Open questions

### 12.1 Questions for product/operations

1. Does a guest case become visible only after email verification, or may a guest view a limited status page? The recommendation here is receipt/status only until claim.
2. Are both individuals and corporate clients in the first release? If corporate-only, `individual` remains harmless but intake/permissions can be narrower.
3. Should all client-account owners be able to invite case collaborators, or only the creator/primary contact?
4. What response-time promise is actually supportable for human escalation, and who owns the queue?
5. Which communication channels are required at MVP: in-app only, or transactional email as well?
6. Is bilingual content required for stored recommendations/source summaries, or only for display?

### 12.2 Questions requiring a tax consultant/accountant

1. Which exact Indonesian tax topics are safe for AI-first general information, and which are always human-required?
2. What risk/materiality thresholds, missing facts, deadlines, and entity/jurisdiction combinations trigger escalation?
3. What is the authority hierarchy when laws, regulations, circulars, rulings, court decisions, treaty text, and OECD materials differ?
4. How are publication, effective, transition, revocation, and tax-period dates determined for every source?
5. What claims require one citation versus multiple authorities, and what constitutes sufficient support?
6. What disclaimers distinguish general information, recommendation, formal opinion, and representation?
7. Which professional qualifications and segregation of author/reviewer are required for each case category?
8. What is the first deterministic calculation, including inputs, rates, thresholds, rounding, currency, effective dates, edge cases, and golden examples?
9. Which records are tax books/supporting records subject to the ten-year rule, and which are merely operational communications that should have shorter retention?
10. What resolution/closure reasons and reopening rules match real consulting practice?

### 12.3 Questions requiring legal/privacy/security input

1. What is the lawful basis for each intake field, document, model call, and staff audit event, and what notice/consent is required?
2. May any case data be processed outside Indonesia, and what transfer mechanism/contractual protections are required for each provider?
3. Which AI/auth/storage/email providers meet no-training, retention, security, subprocessor, breach, and deletion requirements?
4. Does the scale/type of automated triage require a formal data-protection impact assessment under PDP Law Article 34?
5. When is a data-protection officer/function required, and who owns the 3 x 24-hour breach process?
6. What is the approved retention/deletion schedule, backup purge window, legal-hold process, and data-subject request workflow?
7. Is the `copy.md` NDA statement accurate for every enquiry, or must it be replaced with a narrower confidentiality notice?
8. What authentication recovery, staff MFA, offboarding, and emergency case-access process is acceptable?

### 12.4 Risky technical assumptions to validate

1. Turso, Vercel, private object storage, and the chosen providers can be configured in acceptable regions with acceptable contracts and deletion controls.
2. The initial curated regulatory corpus is small enough for topic filters/SQLite text search and does not need vector retrieval.
3. Synchronous triage plus explicit retry is reliable within the chosen Vercel/model time limits; otherwise a durable queue moves forward sooner.
4. A single Turso writer is sufficient for expected hackathon/MVP traffic; contention tests should confirm this before enabling MVCC or changing databases.
5. Official source pages/PDFs can be retained and transformed for internal citation with reliable locators and acceptable usage terms.
6. The auth provider supports Next.js 16, server-verified sessions, staff MFA, webhook verification, account suspension, and auditable identity events.
7. The AI provider exposes a stable model identifier/request ID and contractually acceptable no-training/retention controls.
8. Client users can tolerate explicit per-case sharing instead of automatically seeing all cases belonging to their company.
9. Exact audit reproduction does not require retaining more personal data than the approved retention/privacy policy permits.

---

The next step is review and decision-making. No migration, route, auth, AI integration, dashboard, or UI work should begin until the open phase-zero items are resolved and this plan is approved.
