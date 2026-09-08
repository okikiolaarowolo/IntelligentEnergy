create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  generation_profile jsonb not null,
  demand_profile jsonb not null,
  battery_capacity_kwh double precision not null check (battery_capacity_kwh >= 0),
  initial_soc_kwh double precision not null check (initial_soc_kwh >= 0),
  charge_efficiency double precision not null check (charge_efficiency > 0 and charge_efficiency <= 1),
  discharge_efficiency double precision not null check (discharge_efficiency > 0 and discharge_efficiency <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (initial_soc_kwh <= battery_capacity_kwh)
);

create table public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  status text not null check (status in ('completed','failed')),
  simulator_version text not null,
  input_snapshot jsonb not null,
  result_snapshot jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'completed' and result_snapshot is not null and error_message is null) or (status = 'failed' and error_message is not null))
);

create index scenarios_project_id_idx on public.scenarios(project_id);
create index simulation_runs_scenario_id_idx on public.simulation_runs(scenario_id);

alter table public.projects enable row level security;
alter table public.scenarios enable row level security;
alter table public.simulation_runs enable row level security;

create policy "owners can manage projects" on public.projects for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "owners can manage scenarios" on public.scenarios for all using (exists (select 1 from public.projects p where p.id = project_id and p.owner_user_id = auth.uid())) with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_user_id = auth.uid()));
create policy "owners can manage simulation runs" on public.simulation_runs for all using (exists (select 1 from public.scenarios s join public.projects p on p.id = s.project_id where s.id = scenario_id and p.owner_user_id = auth.uid())) with check (exists (select 1 from public.scenarios s join public.projects p on p.id = s.project_id where s.id = scenario_id and p.owner_user_id = auth.uid()));
