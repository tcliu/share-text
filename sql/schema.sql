create table if not exists users (
  id bigserial primary key,
  username text unique not null,
  email text unique not null,
  password_hash text not null,
  status text not null default 'active',
  created_at timestamptz not null default current_timestamp
);

create table if not exists documents (
  id bigserial primary key,
  key text unique not null,
  name text not null,
  content text not null default '',
  document_type text not null default 'text',
  tags text not null default '[]',
  created_by text not null,
  updated_by text not null,
  owner_user_id bigint references users(id) on delete set null,
  is_public boolean not null default true,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

-- SQLite does not enforce foreign keys by default, so the on delete cascade
-- below only fires on Postgres; version rows are removed in application code
-- (deleteDocument) for the dev adapter. The numeric documents.id is immutable,
-- so key changes never require migrating version rows.
create table if not exists document_versions (
  id bigserial primary key,
  document_id bigint not null references documents(id) on delete cascade,
  content text not null,
  document_type text not null default 'text',
  created_by text not null,
  created_at timestamptz not null default current_timestamp
);

create table if not exists document_shares (
  document_id bigint not null references documents(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default current_timestamp,
  primary key (document_id, user_id)
);

create table if not exists user_config (
  user_id bigint not null references users(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default current_timestamp,
  primary key (user_id, key)
);

create table if not exists user_preferences (
  user_id bigint not null references users(id) on delete cascade,
  preferred_language text not null default 'en',
  updated_at timestamptz not null default current_timestamp,
  primary key (user_id)
);


create table if not exists admin_preferences (
  username text primary key,
  preferred_language text not null default 'en',
  updated_at timestamptz not null default current_timestamp
);

create table if not exists login_attempts (
  ip text primary key,
  attempt_count integer not null default 0,
  reset_at timestamptz not null
);

create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default current_timestamp
);

drop index if exists idx_documents_updated_at;

create index if not exists idx_documents_updated_at on documents (updated_at desc);

drop index if exists idx_document_versions_document_id_created_at;

create index if not exists idx_document_versions_document_id_created_at
  on document_versions (document_id, created_at desc);
