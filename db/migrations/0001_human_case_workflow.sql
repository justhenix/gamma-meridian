PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  auth_subject TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 160),
  global_role TEXT NOT NULL CHECK (global_role IN ('client', 'consultant', 'admin')),
  locale TEXT NOT NULL DEFAULT 'id' CHECK (locale IN ('id', 'en')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE client_accounts (
  id TEXT PRIMARY KEY,
  account_type TEXT NOT NULL CHECK (account_type IN ('individual', 'company')),
  legal_name TEXT NOT NULL CHECK (length(legal_name) BETWEEN 1 AND 240),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 240),
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  preferred_locale TEXT NOT NULL DEFAULT 'id' CHECK (preferred_locale IN ('id', 'en')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE client_account_members (
  id TEXT PRIMARY KEY,
  client_account_id TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  membership_role TEXT NOT NULL CHECK (membership_role IN ('owner', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  removed_at TEXT,
  UNIQUE (client_account_id, user_id),
  CHECK (
    (status = 'active' AND removed_at IS NULL) OR
    (status = 'removed' AND removed_at IS NOT NULL)
  )
);

CREATE TABLE intake_sessions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  guest_token_hash TEXT UNIQUE,
  intake_schema_version TEXT NOT NULL CHECK (length(intake_schema_version) BETWEEN 1 AND 80),
  locale TEXT NOT NULL DEFAULT 'id' CHECK (locale IN ('id', 'en')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'claimed', 'expired')),
  expires_at TEXT,
  submitted_at TEXT,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (owner_user_id IS NOT NULL AND guest_token_hash IS NULL AND expires_at IS NULL) OR
    (owner_user_id IS NULL AND guest_token_hash IS NOT NULL AND expires_at IS NOT NULL)
  ),
  CHECK (
    (status IN ('draft', 'expired') AND submitted_at IS NULL) OR
    (status IN ('submitted', 'claimed') AND submitted_at IS NOT NULL)
  )
);

CREATE TABLE intake_answers (
  id TEXT PRIMARY KEY,
  intake_session_id TEXT NOT NULL REFERENCES intake_sessions(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL CHECK (length(question_key) BETWEEN 1 AND 120),
  question_version TEXT NOT NULL CHECK (length(question_version) BETWEEN 1 AND 80),
  answer_json TEXT NOT NULL CHECK (json_valid(answer_json) AND length(answer_json) <= 65536),
  data_classification TEXT NOT NULL DEFAULT 'confidential'
    CHECK (data_classification IN ('internal', 'confidential', 'restricted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (intake_session_id, question_key)
);

CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  case_reference TEXT NOT NULL UNIQUE CHECK (length(case_reference) BETWEEN 8 AND 40),
  intake_session_id TEXT NOT NULL UNIQUE REFERENCES intake_sessions(id) ON DELETE RESTRICT,
  client_account_id TEXT REFERENCES client_accounts(id) ON DELETE RESTRICT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  submission_idempotency_key TEXT NOT NULL CHECK (length(submission_idempotency_key) BETWEEN 8 AND 160),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
  primary_jurisdiction TEXT NOT NULL CHECK (length(primary_jurisdiction) BETWEEN 2 AND 80),
  tax_topics_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tax_topics_json)),
  tax_period_start TEXT,
  tax_period_end TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'consultant_working', 'waiting_for_client', 'resolved', 'closed')),
  risk_level TEXT NOT NULL DEFAULT 'unknown' CHECK (risk_level IN ('unknown', 'low', 'medium', 'high')),
  resolution_code TEXT,
  resolution_note TEXT,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  received_at TEXT NOT NULL,
  resolved_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (tax_period_start IS NULL OR tax_period_end IS NULL OR tax_period_start <= tax_period_end),
  CHECK (
    (status NOT IN ('resolved', 'closed')) OR
    (resolved_at IS NOT NULL AND resolution_code IS NOT NULL)
  ),
  CHECK ((status <> 'closed') OR closed_at IS NOT NULL)
);

CREATE TABLE case_members (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  case_role TEXT NOT NULL CHECK (
    case_role IN ('client_owner', 'client_collaborator', 'lead_consultant', 'consultant', 'reviewer')
  ),
  added_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL,
  removed_at TEXT,
  UNIQUE (case_id, user_id)
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL CHECK (channel IN ('client', 'internal')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  closed_at TEXT,
  UNIQUE (case_id, channel),
  CHECK (
    (status = 'open' AND closed_at IS NULL) OR
    (status = 'closed' AND closed_at IS NOT NULL)
  )
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'system')),
  author_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  body_markdown TEXT NOT NULL CHECK (length(body_markdown) BETWEEN 1 AND 20000),
  language TEXT NOT NULL CHECK (language IN ('id', 'en')),
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 160),
  created_at TEXT NOT NULL,
  UNIQUE (conversation_id, client_request_id),
  CHECK (
    (author_type = 'user' AND author_user_id IS NOT NULL) OR
    (author_type = 'system' AND author_user_id IS NULL)
  )
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id) ON DELETE RESTRICT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'guest', 'system')),
  actor_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  actor_reference_id TEXT,
  event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 1 AND 120),
  target_type TEXT NOT NULL CHECK (length(target_type) BETWEEN 1 AND 80),
  target_id TEXT NOT NULL CHECK (length(target_id) BETWEEN 1 AND 160),
  request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 8 AND 160),
  reason_code TEXT,
  changed_fields_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(changed_fields_json)),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL,
  CHECK (
    (actor_type = 'user' AND actor_user_id IS NOT NULL) OR
    (actor_type IN ('guest', 'system') AND actor_user_id IS NULL)
  )
);

CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_client_accounts_status ON client_accounts(status);
CREATE INDEX idx_client_account_members_user ON client_account_members(user_id, status);
CREATE INDEX idx_intake_sessions_owner ON intake_sessions(owner_user_id, status);
CREATE INDEX idx_intake_answers_session ON intake_answers(intake_session_id);
CREATE INDEX idx_cases_client_status ON cases(client_account_id, status);
CREATE INDEX idx_cases_status_updated ON cases(status, updated_at);
CREATE INDEX idx_case_members_user_active ON case_members(user_id, case_id) WHERE removed_at IS NULL;
CREATE INDEX idx_conversations_case ON conversations(case_id, channel);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at, id);
CREATE INDEX idx_audit_events_case_created ON audit_events(case_id, created_at, id);
CREATE INDEX idx_audit_events_target ON audit_events(target_type, target_id, created_at);

CREATE TRIGGER intake_answers_insert_only_while_draft
BEFORE INSERT ON intake_answers
FOR EACH ROW
WHEN (SELECT status FROM intake_sessions WHERE id = NEW.intake_session_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'submitted intake answers are immutable');
END;

CREATE TRIGGER intake_answers_update_only_while_draft
BEFORE UPDATE ON intake_answers
FOR EACH ROW
WHEN (SELECT status FROM intake_sessions WHERE id = OLD.intake_session_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'submitted intake answers are immutable');
END;

CREATE TRIGGER intake_answers_delete_only_while_draft
BEFORE DELETE ON intake_answers
FOR EACH ROW
WHEN (SELECT status FROM intake_sessions WHERE id = OLD.intake_session_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'submitted intake answers are immutable');
END;

CREATE TRIGGER messages_prevent_update
BEFORE UPDATE ON messages
BEGIN
  SELECT RAISE(ABORT, 'messages are append-only');
END;

CREATE TRIGGER messages_prevent_delete
BEFORE DELETE ON messages
BEGIN
  SELECT RAISE(ABORT, 'messages are append-only');
END;

CREATE TRIGGER audit_events_prevent_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;

CREATE TRIGGER audit_events_prevent_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;
