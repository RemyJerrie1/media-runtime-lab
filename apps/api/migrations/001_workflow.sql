CREATE TABLE IF NOT EXISTS render_jobs (
  id uuid PRIMARY KEY, tenant_id text NOT NULL, idempotency_key text NOT NULL,
  status text NOT NULL, tokens integer NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS render_jobs_tenant_status_idx ON render_jobs (tenant_id, status);
CREATE TABLE IF NOT EXISTS render_events (
  id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES render_jobs(id), tenant_id text NOT NULL,
  sequence integer NOT NULL, event_type text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, sequence)
);
CREATE TABLE IF NOT EXISTS render_outbox (
  id uuid PRIMARY KEY, job_id uuid NOT NULL UNIQUE REFERENCES render_jobs(id), tenant_id text NOT NULL,
  state text NOT NULL DEFAULT 'pending', attempt integer NOT NULL DEFAULT 0, worker_id text,
  lease_until timestamptz, last_error text, available_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS render_outbox_claim_idx ON render_outbox (state, available_at, lease_until);
CREATE TABLE IF NOT EXISTS artifacts (
  job_id uuid PRIMARY KEY REFERENCES render_jobs(id), tenant_id text NOT NULL, url text NOT NULL,
  checksum text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);