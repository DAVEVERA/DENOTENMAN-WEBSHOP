-- Remote baseline for project luablfcmhzykjnxmtlqh ("nutty").
-- Captured read-only on 2026-05-15.

create schema if not exists extensions;
create schema if not exists vault;

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_stat_statements" with schema extensions;
create extension if not exists "hypopg" with schema extensions;
create extension if not exists "index_advisor" with schema extensions;
create extension if not exists "supabase_vault" with schema vault;
