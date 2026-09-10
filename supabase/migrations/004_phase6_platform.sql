create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  endpoint text not null,
  status_code integer not null check (status_code between 100 and 599),
  created_at timestamptz not null default now()
);

create index if not exists api_keys_project_id_idx on public.api_keys(project_id);
create index if not exists api_keys_active_hash_idx on public.api_keys(key_hash) where revoked_at is null;
create index if not exists api_usage_key_created_idx on public.api_usage(api_key_id, created_at desc);
create index if not exists api_usage_project_created_idx on public.api_usage(project_id, created_at desc);

alter table public.api_keys enable row level security;
alter table public.api_usage enable row level security;

drop policy if exists "api keys owner access" on public.api_keys;
create policy "api keys owner access" on public.api_keys
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = api_keys.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = api_keys.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "api usage owner read" on public.api_usage;
create policy "api usage owner read" on public.api_usage
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = api_usage.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "api usage owner insert" on public.api_usage;
create policy "api usage owner insert" on public.api_usage
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = api_usage.project_id and p.user_id = auth.uid()
    )
  );
