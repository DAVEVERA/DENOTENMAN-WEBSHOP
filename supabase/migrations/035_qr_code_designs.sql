create table if not exists public.qr_code_designs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  target_type text not null default 'url' check (
    target_type in ('product', 'category', 'discount', 'whatsapp', 'email', 'wifi', 'url', 'text')
  ),
  target_config jsonb not null default '{}'::jsonb,
  design_config jsonb not null default '{}'::jsonb,
  label_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qr_code_designs_status_idx on public.qr_code_designs(status);
create index if not exists qr_code_designs_updated_at_idx on public.qr_code_designs(updated_at desc);
