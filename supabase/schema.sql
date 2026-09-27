-- Organizations, experiments, variants, append-only events, daily rollups, and API keys.
-- Apply this in the customer's Supabase project when SPLITLINE uses SUPABASE_URL.
-- The local dashboard uses a JSON file instead until those env vars are set.

create table if not exists organizations (
  id text primary key,
  name text not null,
  plan text not null default 'free' check (plan in ('free', 'starter', 'growth')),
  sanity_project_id text not null default '',
  vercel_project_id text not null default '',
  usage_month text not null default to_char(now() at time zone 'utc', 'YYYY-MM'),
  events_this_month integer not null default 0,
  edge_sync jsonb,
  created_at timestamptz not null default now()
);

create table if not exists experiments (
  id text primary key,
  org_id text not null references organizations (id) on delete cascade,
  key text not null,
  name text not null,
  description text not null default '',
  status text not null check (status in ('draft', 'running', 'paused', 'completed')),
  traffic_allocation integer not null default 100,
  experiment_group text,
  goal_event_name text not null default 'cta_click',
  started_at timestamptz,
  ended_at timestamptz,
  winner_variant_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, key)
);

create table if not exists variants (
  id text primary key,
  experiment_id text not null references experiments (id) on delete cascade,
  key text not null,
  name text not null,
  weight numeric not null,
  sanity_document_id text not null default '',
  payload jsonb not null default '{}'::jsonb,
  unique (experiment_id, key)
);

create table if not exists events (
  id text primary key,
  org_id text not null,
  experiment_id text not null,
  variant_id text not null,
  visitor_id text not null,
  event_type text not null check (event_type in ('exposure', 'conversion', 'custom')),
  event_name text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists events_experiment_time_idx on events (experiment_id, occurred_at desc);

create table if not exists results_daily (
  experiment_id text not null,
  variant_id text not null,
  date date not null,
  exposures integer not null default 0,
  conversions integer not null default 0,
  primary key (experiment_id, variant_id, date)
);

create table if not exists api_keys (
  id text primary key,
  org_id text not null references organizations (id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists teammates (
  id text primary key,
  org_id text not null references organizations (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  status text not null check (status in ('active', 'invited')),
  unique (org_id, email)
);

create table if not exists event_dedupe (
  dedupe_key text primary key,
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;
alter table experiments enable row level security;
alter table variants enable row level security;
alter table events enable row level security;
alter table results_daily enable row level security;
alter table api_keys enable row level security;
alter table teammates enable row level security;
alter table event_dedupe enable row level security;

-- The dashboard connects with the service role, which bypasses RLS.
-- No anon policies are granted; visitor browsers talk to the events API, not Postgres.
