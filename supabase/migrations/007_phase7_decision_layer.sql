create table if not exists public.energy_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  optimization_run_id uuid not null references public.optimization_runs(id) on delete cascade,
  model_version text not null,
  summary text not null,
  confidence text not null check (confidence in ('high','medium','low')),
  recommendations jsonb not null,
  limitations jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists energy_decisions_project_created_idx on public.energy_decisions(project_id, created_at desc);

alter table public.energy_decisions enable row level security;

create policy "Owners can read energy decisions"
  on public.energy_decisions for select
  using (exists (select 1 from public.projects p where p.id = energy_decisions.project_id and p.owner_user_id = auth.uid()));

create policy "Owners can create energy decisions"
  on public.energy_decisions for insert
  with check (exists (select 1 from public.projects p where p.id = energy_decisions.project_id and p.owner_user_id = auth.uid()));
