CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  coordinator_id TEXT NOT NULL,
  budget_total NUMERIC(18, 6) NOT NULL,
  status TEXT NOT NULL,
  phase TEXT NOT NULL,
  execution_deadline_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS missions (
  room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  raw_input TEXT NOT NULL,
  structured JSONB NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  identity_ref TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  charter_signed BOOLEAN NOT NULL DEFAULT FALSE,
  charter_signed_at TIMESTAMPTZ,
  stake_locked NUMERIC(18, 6) NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, member_id)
);

CREATE TABLE IF NOT EXISTS charters (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  baseline_split JSONB NOT NULL,
  bonus_pool_pct NUMERIC(8, 6) NOT NULL,
  malus_pool_pct NUMERIC(8, 6) NOT NULL,
  consensus_config JSONB NOT NULL,
  timeout_rules JSONB NOT NULL,
  status TEXT NOT NULL,
  sign_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS charter_tasks (
  id UUID PRIMARY KEY,
  charter_id UUID NOT NULL REFERENCES charters(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  deliverable_spec TEXT NOT NULL,
  effort_estimate TEXT NOT NULL,
  weight NUMERIC(8, 4) NOT NULL,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_to TEXT,
  status TEXT NOT NULL,
  claim_deadline TIMESTAMPTZ,
  delivery_deadline TIMESTAMPTZ,
  artifact_id UUID,
  review_status TEXT,
  delivery_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES charter_tasks(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL,
  content_ref TEXT NOT NULL,
  content_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  review_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_reviews (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES charter_tasks(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  verdict TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_events (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  signature_metadata JSONB,
  UNIQUE (room_id, seq),
  UNIQUE (room_id, hash)
);

CREATE INDEX IF NOT EXISTS room_events_room_id_timestamp_idx
  ON room_events (room_id, timestamp);

CREATE TABLE IF NOT EXISTS peer_ratings (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  rater_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  signal SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, rater_id, target_id)
);

CREATE TABLE IF NOT EXISTS requester_ratings (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  rating SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, requester_id, target_id)
);

CREATE TABLE IF NOT EXISTS contrib_records (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  task_weight_sum NUMERIC(12, 6) NOT NULL DEFAULT 0,
  peer_adjustment NUMERIC(12, 6) NOT NULL DEFAULT 0,
  requester_adjustment NUMERIC(12, 6) NOT NULL DEFAULT 0,
  final_share NUMERIC(12, 6) NOT NULL DEFAULT 0,
  computation_log JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, agent_id)
);

CREATE TABLE IF NOT EXISTS settlement_proposals (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  allocations JSONB NOT NULL,
  bonus_pool_used NUMERIC(18, 6) NOT NULL DEFAULT 0,
  malus_pool_reclaimed NUMERIC(18, 6) NOT NULL DEFAULT 0,
  computation_log JSONB NOT NULL,
  signature_payload JSONB,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS settlement_votes (
  id UUID PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES settlement_proposals(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  vote TEXT NOT NULL,
  reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_id, agent_id)
);

CREATE TABLE IF NOT EXISTS dispute_cases (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  sub_type TEXT NOT NULL,
  claimant_id TEXT NOT NULL,
  respondent_id TEXT NOT NULL,
  filing_stake NUMERIC(18, 6) NOT NULL DEFAULT 0,
  remedy_sought TEXT NOT NULL,
  status TEXT NOT NULL,
  cooling_off_expires_at TIMESTAMPTZ NOT NULL,
  response_deadline_at TIMESTAMPTZ,
  panel_deadline_at TIMESTAMPTZ,
  resolution JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispute_evidence (
  id UUID PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES dispute_cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  ledger_ref TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispute_panel_members (
  dispute_id UUID NOT NULL REFERENCES dispute_cases(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  PRIMARY KEY (dispute_id, member_id)
);

CREATE TABLE IF NOT EXISTS payment_handoffs (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES settlement_proposals(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  payload JSONB NOT NULL,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 10,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_queue_run_at_idx
  ON job_queue (status, run_at);
