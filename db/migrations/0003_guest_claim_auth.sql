PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS messages_prevent_update_v2;
DROP TRIGGER IF EXISTS messages_prevent_delete_v2;

CREATE TABLE messages_v3 (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'ai', 'system')),
  author_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  author_guest_session_id TEXT REFERENCES intake_sessions(id) ON DELETE RESTRICT,
  ai_run_id TEXT REFERENCES ai_runs(id) ON DELETE RESTRICT,
  body_markdown TEXT NOT NULL CHECK (length(body_markdown) BETWEEN 1 AND 20000),
  language TEXT NOT NULL CHECK (language IN ('id', 'en')),
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 160),
  created_at TEXT NOT NULL,
  UNIQUE (conversation_id, client_request_id),
  CHECK (
    (author_type = 'user' AND ai_run_id IS NULL AND (
      (author_user_id IS NOT NULL AND author_guest_session_id IS NULL) OR
      (author_user_id IS NULL AND author_guest_session_id IS NOT NULL)
    )) OR
    (author_type = 'ai' AND author_user_id IS NULL AND author_guest_session_id IS NULL AND ai_run_id IS NOT NULL) OR
    (author_type = 'system' AND author_user_id IS NULL AND author_guest_session_id IS NULL AND ai_run_id IS NULL)
  )
);

INSERT INTO messages_v3 (
  id, conversation_id, author_type, author_user_id, author_guest_session_id,
  ai_run_id, body_markdown, language, client_request_id, created_at
)
SELECT
  id, conversation_id, author_type, author_user_id, NULL,
  ai_run_id, body_markdown, language, client_request_id, created_at
FROM messages;

DROP TABLE messages;
ALTER TABLE messages_v3 RENAME TO messages;
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at, id);
CREATE INDEX idx_messages_ai_run ON messages(ai_run_id) WHERE ai_run_id IS NOT NULL;
CREATE INDEX idx_messages_guest_session ON messages(author_guest_session_id)
WHERE author_guest_session_id IS NOT NULL;

CREATE TRIGGER messages_prevent_update_v3
BEFORE UPDATE ON messages
BEGIN
  SELECT RAISE(ABORT, 'messages are append-only');
END;

CREATE TRIGGER messages_prevent_delete_v3
BEFORE DELETE ON messages
BEGIN
  SELECT RAISE(ABORT, 'messages are append-only');
END;

CREATE TABLE auth_verification_challenges (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL CHECK (length(email_normalized) BETWEEN 3 AND 320),
  code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
  full_name TEXT CHECK (full_name IS NULL OR length(full_name) BETWEEN 2 AND 200),
  company_name TEXT CHECK (company_name IS NULL OR length(company_name) BETWEEN 1 AND 240),
  purpose TEXT NOT NULL CHECK (purpose IN ('claim', 'consultations')),
  guest_intake_session_id TEXT REFERENCES intake_sessions(id) ON DELETE RESTRICT,
  verified_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 10),
  created_at TEXT NOT NULL,
  CHECK (
    (purpose = 'claim' AND guest_intake_session_id IS NOT NULL) OR
    (purpose = 'consultations' AND guest_intake_session_id IS NULL)
  )
);

CREATE INDEX idx_auth_challenges_email_created
ON auth_verification_challenges(email_normalized, created_at);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX idx_auth_sessions_user_active
ON auth_sessions(user_id, expires_at) WHERE revoked_at IS NULL;

PRAGMA foreign_keys = ON;
