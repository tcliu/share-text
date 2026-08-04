create table if not exists documents (
  id bigserial primary key,
  key text unique not null,
  name text not null,
  content text not null default '',
  document_type text not null default 'text',
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default current_timestamp
);

drop index if exists documents_updated_at_idx;

create index if not exists idx_documents_updated_at on documents (updated_at desc);
