create table if not exists documents (
  id bigserial primary key,
  key text unique not null,
  name text not null,
  content text not null default '',
  document_type text not null default 'text',
  tags text not null default '[]',
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

-- SQLite does not enforce foreign keys by default, so the on delete/update
-- cascade below only fires on Postgres; version rows are removed or migrated
-- in application code (deleteDocument / the admin key change) for the dev
-- adapter.
create table if not exists document_versions (
  id bigserial primary key,
  document_id text not null references documents(key) on update cascade on delete cascade,
  content text not null,
  document_type text not null default 'text',
  created_by text not null,
  created_at timestamptz not null default current_timestamp
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
