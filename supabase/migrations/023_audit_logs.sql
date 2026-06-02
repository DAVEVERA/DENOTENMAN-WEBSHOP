create table if not exists public.audit_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

alter table public.audit_logs enable row level security;
grant all on table public.audit_logs to service_role;

drop policy if exists "Service role can manage audit logs." on public.audit_logs;
create policy "Service role can manage audit logs."
  on public.audit_logs for all to service_role using (true) with check (true);
