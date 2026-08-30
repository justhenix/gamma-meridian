CREATE TABLE staff_auth_verification_challenges (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL CHECK (length(email_normalized) BETWEEN 3 AND 320),
  code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
  verified_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 10),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_staff_auth_challenges_email_created
ON staff_auth_verification_challenges(email_normalized, created_at);
