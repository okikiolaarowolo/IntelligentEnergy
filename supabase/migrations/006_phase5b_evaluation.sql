create table if not exists public.pilot_evaluations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  dataset_id uuid not null references public.pilot_datasets(id) on delete cascade,
  model_version text not null,
  assumptions jsonb not null,
  baseline_snapshot jsonb not null,
  optimized_snapshot jsonb not null,
  comparison_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists pilot_evaluations_project_created_idx
  on public.pilot_evaluations(project_id, created_at desc);

alter table public.pilot_evaluations enable row level security;

create policy "pilot evaluations owner read"
  on public.pilot_evaluations for select
  using (exists (
    select 1 from public.projects p
    where p.id = pilot_evaluations.project_id and p.owner_user_id = auth.uid()
  ));

create policy "pilot evaluations owner insert"
  on public.pilot_evaluations for insert
  with check (exists (
    select 1 from public.projects p
    where p.id = pilot_evaluations.project_id and p.owner_user_id = auth.uid()
  ));

after delete? -- placeholder removed by migration review
