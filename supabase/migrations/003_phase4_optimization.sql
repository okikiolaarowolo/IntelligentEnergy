create table if not exists public.optimization_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  forecast_run_id uuid references public.forecast_runs(id) on delete set null,
  model_version text not null,
  horizon_steps integer not null check (horizon_steps between 1 and 48),
  input_snapshot jsonb not null,
  result_snapshot jsonb not null,
  objective_cost double precision not null check (objective_cost >= 0),
  created_at timestamptz not null default now()
);

create index if not exists optimization_runs_project_id_idx on public.optimization_runs(project_id);
create index if not exists optimization_runs_forecast_run_id_idx on public.optimization_runs(forecast_run_id);

alter table public.optimization_runs enable row level security;

revoke all on table public.optimization_runs from anon, authenticated;
grant select, insert, update, delete on table public.optimization_runs to authenticated;

create policy "Users can view optimization runs for their projects"
on public.optimization_runs
for select
to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = optimization_runs.project_id
      and p.owner_user_id = (select auth.uid())
  )
);

create policy "Users can create optimization runs for their projects"
on public.optimization_runs
for insert
to authenticated
with check (
  exists (
    select 1 from public.projects p
    where p.id = optimization_runs.project_id
      and p.owner_user_id = (select auth.uid())
  )
);

create policy "Users can update optimization runs for their projects"
on public.optimization_runs
for update
to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = optimization_runs.project_id
      and p.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = optimization_runs.project_id
      and p.owner_user_id = (select auth.uid())
  )
);

create policy "Users can delete optimization runs for their projects"
on public.optimization_runs
for delete
to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = optimization_runs.project_id
      and p.owner_user_id = (select auth.uid())
  )
);
