create table if not exists public.consent_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  customer_email text,
  consent_type text not null,
  granted boolean not null,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists consent_logs_customer_email_idx on public.consent_logs(customer_email);

alter table public.consent_logs enable row level security;
grant all on table public.consent_logs to service_role;

drop policy if exists "Service role can manage consent logs." on public.consent_logs;
create policy "Service role can manage consent logs."
  on public.consent_logs for all to service_role using (true) with check (true);
