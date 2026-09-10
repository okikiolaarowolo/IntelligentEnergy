create table public.pilot_datasets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  source_filename text not null check (char_length(trim(source_filename)) between 1 and 255),
  row_count integer not null check (row_count between 1 and 10000),
  start_timestamp timestamptz not null,
  end_timestamp timestamptz not null,
  interval_minutes numeric not null check (interval_minutes > 0),
  baseline_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_timestamp >= start_timestamp)
);

create table public.pilot_observations (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.pilot_datasets(id) on delete cascade,
  timestamp timestamptz not null,
  demand_kwh double precision not null check (demand_kwh >= 0),
  generation_kwh double precision not null check (generation_kwh >= 0),
  created_at timestamptz not null default now(),
  unique (dataset_id, timestamp)
);

create index pilot_datasets_project_id_idx on public.pilot_datasets(project_id);
create index pilot_observations_dataset_timestamp_idx on public.pilot_observations(dataset_id, timestamp);

alter table public.pilot_datasets enable row level security;
alter table public.pilot_observations enable row level security;

create policy "owners can manage pilot datasets" on public.pilot_datasets
  for all using (exists (
    select 1 from public.projects p where p.id = project_id and p.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p where p.id = project_id and p.owner_user_id = auth.uid()
  ));

create policy "owners can manage pilot observations" on public.pilot_observations
  for all using (exists (
    select 1
    from public.pilot_datasets d
    join public.projects p on p.id = d.project_id
    where d.id = dataset_id and p.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.pilot_datasets d
    join public.projects p on p.id = d.project_id
    where d.id = dataset_id and p.owner_user_id = auth.uid()
  ));
