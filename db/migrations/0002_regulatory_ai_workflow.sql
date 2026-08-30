PRAGMA foreign_keys = OFF;

CREATE TABLE cases_v2 (
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
    CHECK (status IN (
      'received', 'human_review_required', 'consultant_working',
      'waiting_for_client', 'resolved', 'closed'
    )),
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

INSERT INTO cases_v2 (
  id, case_reference, intake_session_id, client_account_id, created_by_user_id,
  submission_idempotency_key, title, primary_jurisdiction, tax_topics_json,
  tax_period_start, tax_period_end, status, risk_level, resolution_code,
  resolution_note, row_version, received_at, resolved_at, closed_at,
  created_at, updated_at
)
SELECT
  id, case_reference, intake_session_id, client_account_id, created_by_user_id,
  submission_idempotency_key, title, primary_jurisdiction, tax_topics_json,
  tax_period_start, tax_period_end, status, risk_level, resolution_code,
  resolution_note, row_version, received_at, resolved_at, closed_at,
  created_at, updated_at
FROM cases;

DROP TABLE cases;
ALTER TABLE cases_v2 RENAME TO cases;

CREATE INDEX idx_cases_client_status ON cases(client_account_id, status);
CREATE INDEX idx_cases_status_updated ON cases(status, updated_at);

CREATE TABLE regulatory_sources (
  id TEXT PRIMARY KEY,
  official_identifier TEXT NOT NULL CHECK (length(official_identifier) BETWEEN 3 AND 200),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 500),
  authority TEXT NOT NULL CHECK (length(authority) BETWEEN 2 AND 240),
  jurisdiction TEXT NOT NULL CHECK (length(jurisdiction) BETWEEN 2 AND 80),
  source_type TEXT NOT NULL CHECK (length(source_type) BETWEEN 2 AND 80),
  canonical_url TEXT NOT NULL CHECK (length(canonical_url) BETWEEN 10 AND 2000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (authority, official_identifier),
  UNIQUE (canonical_url)
);

CREATE TABLE regulatory_source_versions (
  id TEXT PRIMARY KEY,
  regulatory_source_id TEXT NOT NULL REFERENCES regulatory_sources(id) ON DELETE RESTRICT,
  version_label TEXT NOT NULL CHECK (length(version_label) BETWEEN 1 AND 160),
  publication_date TEXT NOT NULL CHECK (publication_date GLOB '????-??-??'),
  effective_from TEXT NOT NULL CHECK (effective_from GLOB '????-??-??'),
  effective_to TEXT CHECK (effective_to IS NULL OR effective_to GLOB '????-??-??'),
  retrieved_at TEXT NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (length(content_sha256) = 64),
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'superseded')),
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TEXT,
  supersedes_version_id TEXT REFERENCES regulatory_source_versions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE (regulatory_source_id, version_label),
  CHECK (effective_to IS NULL OR effective_from <= effective_to),
  CHECK (
    (review_status = 'pending' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL) OR
    (review_status <> 'pending' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE TABLE regulatory_source_sections (
  id TEXT PRIMARY KEY,
  source_version_id TEXT NOT NULL REFERENCES regulatory_source_versions(id) ON DELETE RESTRICT,
  heading TEXT NOT NULL CHECK (length(heading) BETWEEN 1 AND 500),
  locator TEXT NOT NULL CHECK (length(locator) BETWEEN 1 AND 240),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  body_text TEXT NOT NULL CHECK (length(body_text) BETWEEN 1 AND 100000),
  body_sha256 TEXT NOT NULL CHECK (length(body_sha256) = 64),
  tax_topics_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tax_topics_json)),
  created_at TEXT NOT NULL,
  UNIQUE (source_version_id, locator, ordinal)
);

CREATE VIRTUAL TABLE regulatory_source_sections_fts USING fts5(
  section_id UNINDEXED,
  heading,
  locator,
  body_text,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER regulatory_sections_fts_insert
AFTER INSERT ON regulatory_source_sections
BEGIN
  INSERT INTO regulatory_source_sections_fts(section_id, heading, locator, body_text)
  VALUES (NEW.id, NEW.heading, NEW.locator, NEW.body_text);
END;

CREATE TRIGGER regulatory_sections_fts_update
AFTER UPDATE ON regulatory_source_sections
BEGIN
  DELETE FROM regulatory_source_sections_fts WHERE section_id = OLD.id;
  INSERT INTO regulatory_source_sections_fts(section_id, heading, locator, body_text)
  VALUES (NEW.id, NEW.heading, NEW.locator, NEW.body_text);
END;

CREATE TRIGGER regulatory_sections_fts_delete
AFTER DELETE ON regulatory_source_sections
BEGIN
  DELETE FROM regulatory_source_sections_fts WHERE section_id = OLD.id;
END;

CREATE TRIGGER approved_regulatory_sections_prevent_insert
BEFORE INSERT ON regulatory_source_sections
WHEN (
  SELECT review_status FROM regulatory_source_versions WHERE id = NEW.source_version_id
) <> 'pending'
BEGIN
  SELECT RAISE(ABORT, 'sections may only be added to pending source versions');
END;

CREATE TRIGGER approved_regulatory_sections_prevent_update
BEFORE UPDATE ON regulatory_source_sections
WHEN (
  SELECT review_status FROM regulatory_source_versions WHERE id = OLD.source_version_id
) <> 'pending'
BEGIN
  SELECT RAISE(ABORT, 'reviewed regulatory sections are immutable');
END;

CREATE TRIGGER approved_regulatory_sections_prevent_delete
BEFORE DELETE ON regulatory_source_sections
WHEN (
  SELECT review_status FROM regulatory_source_versions WHERE id = OLD.source_version_id
) <> 'pending'
BEGIN
  SELECT RAISE(ABORT, 'reviewed regulatory sections are immutable');
END;

CREATE TABLE ai_runs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (purpose IN ('answer_case_question', 'handoff_summary')),
  trigger_type TEXT NOT NULL CHECK (length(trigger_type) BETWEEN 1 AND 80),
  trigger_id TEXT NOT NULL CHECK (length(trigger_id) BETWEEN 1 AND 160),
  requested_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'invalid', 'escalated')),
  provider TEXT NOT NULL CHECK (length(provider) BETWEEN 1 AND 80),
  model TEXT NOT NULL CHECK (length(model) BETWEEN 1 AND 160),
  provider_request_id TEXT,
  prompt_key TEXT NOT NULL CHECK (length(prompt_key) BETWEEN 1 AND 120),
  prompt_version TEXT NOT NULL CHECK (length(prompt_version) BETWEEN 1 AND 80),
  ruleset_version TEXT NOT NULL CHECK (length(ruleset_version) BETWEEN 1 AND 80),
  input_snapshot_json TEXT NOT NULL CHECK (json_valid(input_snapshot_json)),
  input_sha256 TEXT NOT NULL CHECK (length(input_sha256) = 64),
  output_json TEXT CHECK (output_json IS NULL OR json_valid(output_json)),
  output_sha256 TEXT CHECK (output_sha256 IS NULL OR length(output_sha256) = 64),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  error_code TEXT,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 160),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (conversation_id, idempotency_key)
);

CREATE TABLE ai_run_sources (
  ai_run_id TEXT NOT NULL REFERENCES ai_runs(id) ON DELETE RESTRICT,
  source_section_id TEXT NOT NULL REFERENCES regulatory_source_sections(id) ON DELETE RESTRICT,
  context_ordinal INTEGER NOT NULL CHECK (context_ordinal >= 0),
  context_sha256 TEXT NOT NULL CHECK (length(context_sha256) = 64),
  retrieval_method TEXT NOT NULL CHECK (retrieval_method IN ('fts5_bm25', 'metadata')),
  retrieval_score REAL,
  PRIMARY KEY (ai_run_id, source_section_id),
  UNIQUE (ai_run_id, context_ordinal)
);

CREATE TABLE messages_v2 (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'ai', 'system')),
  author_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  ai_run_id TEXT REFERENCES ai_runs(id) ON DELETE RESTRICT,
  body_markdown TEXT NOT NULL CHECK (length(body_markdown) BETWEEN 1 AND 20000),
  language TEXT NOT NULL CHECK (language IN ('id', 'en')),
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 160),
  created_at TEXT NOT NULL,
  UNIQUE (conversation_id, client_request_id),
  CHECK (
    (author_type = 'user' AND author_user_id IS NOT NULL AND ai_run_id IS NULL) OR
    (author_type = 'ai' AND author_user_id IS NULL AND ai_run_id IS NOT NULL) OR
    (author_type = 'system' AND author_user_id IS NULL AND ai_run_id IS NULL)
  )
);

INSERT INTO messages_v2 (
  id, conversation_id, author_type, author_user_id, ai_run_id,
  body_markdown, language, client_request_id, created_at
)
SELECT
  id, conversation_id, author_type, author_user_id, NULL,
  body_markdown, language, client_request_id, created_at
FROM messages;

DROP TABLE messages;
ALTER TABLE messages_v2 RENAME TO messages;
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at, id);
CREATE INDEX idx_messages_ai_run ON messages(ai_run_id) WHERE ai_run_id IS NOT NULL;

CREATE TRIGGER messages_prevent_update_v2
BEFORE UPDATE ON messages
BEGIN
  SELECT RAISE(ABORT, 'messages are append-only');
END;

CREATE TRIGGER messages_prevent_delete_v2
BEFORE DELETE ON messages
BEGIN
  SELECT RAISE(ABORT, 'messages are append-only');
END;

CREATE TABLE escalations (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
  ai_run_id TEXT REFERENCES ai_runs(id) ON DELETE RESTRICT,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('rule', 'ai_validation', 'client_request', 'consultant', 'system_failure')),
  reason_codes_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reason_codes_json)),
  reason_text TEXT NOT NULL CHECK (length(reason_text) BETWEEN 1 AND 2000),
  handoff_summary_json TEXT NOT NULL CHECK (json_valid(handoff_summary_json)),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'resolved', 'cancelled')),
  assigned_to_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  resolved_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  resolution_code TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL,
  assigned_at TEXT,
  resolved_at TEXT
);

CREATE UNIQUE INDEX idx_escalations_one_active_case
ON escalations(case_id)
WHERE status IN ('open', 'assigned');
CREATE INDEX idx_escalations_status_created ON escalations(status, created_at);

CREATE TABLE recommendation_versions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  origin TEXT NOT NULL CHECK (origin IN ('ai', 'human', 'hybrid')),
  ai_run_id TEXT REFERENCES ai_runs(id) ON DELETE RESTRICT,
  author_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  language TEXT NOT NULL CHECK (language IN ('id', 'en')),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  content_sha256 TEXT NOT NULL CHECK (length(content_sha256) = 64),
  status TEXT NOT NULL
    CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'superseded', 'withdrawn')),
  supersedes_version_id TEXT REFERENCES recommendation_versions(id) ON DELETE RESTRICT,
  approved_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TEXT,
  published_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (case_id, version_number),
  CHECK ((status <> 'published') OR published_at IS NOT NULL)
);

CREATE TABLE recommendation_citations (
  id TEXT PRIMARY KEY,
  recommendation_version_id TEXT NOT NULL REFERENCES recommendation_versions(id) ON DELETE RESTRICT,
  source_section_id TEXT NOT NULL REFERENCES regulatory_source_sections(id) ON DELETE RESTRICT,
  claim_key TEXT NOT NULL CHECK (length(claim_key) BETWEEN 1 AND 160),
  claim_text TEXT NOT NULL CHECK (length(claim_text) BETWEEN 1 AND 2000),
  locator_snapshot TEXT NOT NULL CHECK (length(locator_snapshot) BETWEEN 1 AND 240),
  excerpt_snapshot TEXT NOT NULL CHECK (length(excerpt_snapshot) BETWEEN 1 AND 4000),
  support_status TEXT NOT NULL CHECK (support_status IN ('pending', 'verified', 'rejected')),
  verified_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  verified_at TEXT,
  display_order INTEGER NOT NULL CHECK (display_order >= 0),
  UNIQUE (recommendation_version_id, claim_key, source_section_id)
);

CREATE INDEX idx_regulatory_sources_jurisdiction_status
ON regulatory_sources(jurisdiction, status);
CREATE INDEX idx_regulatory_versions_effective_review
ON regulatory_source_versions(review_status, effective_from, effective_to);
CREATE INDEX idx_regulatory_sections_version ON regulatory_source_sections(source_version_id, ordinal);
CREATE INDEX idx_ai_runs_case_created ON ai_runs(case_id, created_at);
CREATE INDEX idx_ai_runs_conversation_created ON ai_runs(conversation_id, created_at);
CREATE INDEX idx_ai_run_sources_section ON ai_run_sources(source_section_id);
CREATE INDEX idx_recommendations_case_status ON recommendation_versions(case_id, status, version_number);
CREATE INDEX idx_recommendation_citations_version
ON recommendation_citations(recommendation_version_id, display_order);

PRAGMA foreign_keys = ON;
