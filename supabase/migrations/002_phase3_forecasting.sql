create table public.forecast_datasets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  observations jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.forecast_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.forecast_datasets(id) on delete cascade,
  target text not null check (target in ('demand','generation','both')),
  horizon_steps integer not null check (horizon_steps between 1 and 48),
  lag_count integer not null check (lag_count between 2 and 48),
  model_version text not null,
  input_snapshot jsonb not null,
  result_snapshot jsonb not null,
  metrics_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index forecast_datasets_project_id_idx on public.forecast_datasets(project_id);
create index forecast_runs_dataset_id_idx on public.forecast_runs(dataset_id);

alter table public.forecast_datasets enable row level security;
alter table public.forecast_runs enable row level security;

create policy "owners can manage forecast datasets" on public.forecast_datasets
  for all using (exists (select 1 from public.projects p where p.id = project_id and p.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_user_id = auth.uid()));

create policy "owners can manage forecast runs" on public.forecast_runs
  for all using (exists (
    select 1 from public.forecast_datasets d
    join public.projects p on p.id = d.project_id
    where d.id = dataset_id and p.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.forecast_datasets d
    join public.projects p on p.id = d.project_id
    where d.id = dataset_id and p.owner_user_id = auth.uid()
  ));
