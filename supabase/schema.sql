-- =========================================================================
-- C & R Textiles Grievance App — Supabase schema
-- Run this entire file ONCE in: Supabase Dashboard -> SQL Editor -> New query
-- =========================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;

-- ---------- Tables ----------

-- Workers (one row per factory employee)
create table if not exists public.workers (
  id            text primary key,                              -- e.g. 'W-0042'
  name          text not null,
  floor         text,
  shift         text,
  phone         text,
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- HR users (people who use the HR dashboard)
create table if not exists public.hr_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  role        text not null default 'staff' check (role in ('staff','manager')),
  created_at  timestamptz not null default now()
);

-- Grievances
create table if not exists public.grievances (
  id                    text primary key,                       -- e.g. 'GR-2026-0042'
  worker_id             text references public.workers(id) on delete set null,
  submitted_by_auth_id  uuid not null references auth.users(id) on delete cascade,
  is_anonymous          boolean not null default false,
  category              text not null,
  title                 text not null,
  description           text not null,
  status                text not null default 'open'
                        check (status in ('open','in_progress','escalated','resolved')),
  assigned_to           text,
  sla_days              int  not null default 7,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  resolved_at           timestamptz
);

create index if not exists grievances_submitter_idx on public.grievances (submitted_by_auth_id);
create index if not exists grievances_status_idx    on public.grievances (status);
create index if not exists grievances_created_idx   on public.grievances (created_at desc);

-- Attachments (photos, files, audio)
create table if not exists public.grievance_attachments (
  id           uuid primary key default gen_random_uuid(),
  grievance_id text not null references public.grievances(id) on delete cascade,
  kind         text not null check (kind in ('photo','file','audio')),
  storage_path text not null,
  file_name    text,
  created_at   timestamptz not null default now()
);

create index if not exists attachments_grievance_idx on public.grievance_attachments (grievance_id);

-- Timeline (every status change / event the worker sees)
create table if not exists public.grievance_timeline (
  id           uuid primary key default gen_random_uuid(),
  grievance_id text not null references public.grievances(id) on delete cascade,
  event_en     text not null,
  event_hi     text not null,
  actor        text not null default 'system' check (actor in ('worker','hr','system')),
  created_at   timestamptz not null default now()
);

create index if not exists timeline_grievance_idx on public.grievance_timeline (grievance_id, created_at);

-- ---------- Auto-generate grievance IDs like 'GR-2026-0042' ----------

create sequence if not exists public.grievance_seq;

create or replace function public.set_grievance_id()
returns trigger language plpgsql as $$
declare
  next_n int;
begin
  if new.id is null or new.id = '' then
    next_n := nextval('public.grievance_seq');
    new.id := 'GR-' || extract(year from now())::int || '-' || lpad(next_n::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_grievance_id on public.grievances;
create trigger trg_grievance_id
  before insert on public.grievances
  for each row execute function public.set_grievance_id();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_grievance_touch on public.grievances;
create trigger trg_grievance_touch
  before update on public.grievances
  for each row execute function public.touch_updated_at();

-- ---------- Auto-write 'Submitted' timeline entry on insert ----------

create or replace function public.add_submitted_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.grievance_timeline (grievance_id, event_en, event_hi, actor)
  values (new.id, 'Submitted', 'दर्ज की गई', 'worker');
  return new;
end;
$$;

drop trigger if exists trg_grievance_submitted on public.grievances;
create trigger trg_grievance_submitted
  after insert on public.grievances
  for each row execute function public.add_submitted_timeline();

-- ---------- Status-change timeline entries ----------

create or replace function public.add_status_change_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  en text; hi text;
begin
  if new.status = old.status then return new; end if;
  case new.status
    when 'in_progress' then en := 'Marked in progress';     hi := 'प्रगति पर';
    when 'escalated'   then en := 'Escalated to HR Manager';hi := 'एचआर प्रबंधक को भेजी';
    when 'resolved'    then en := 'Resolved';               hi := 'समाधान हुआ';
    when 'open'        then en := 'Reopened';               hi := 'फिर से खोली गई';
    else en := 'Status: ' || new.status; hi := en;
  end case;
  insert into public.grievance_timeline (grievance_id, event_en, event_hi, actor)
  values (new.id, en, hi, 'hr');
  return new;
end;
$$;

drop trigger if exists trg_grievance_status on public.grievances;
create trigger trg_grievance_status
  after update of status on public.grievances
  for each row execute function public.add_status_change_timeline();

-- ---------- Helper: is the caller an HR user? ----------

create or replace function public.is_hr()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hr_users where id = auth.uid());
$$;

-- ---------- Row-Level Security ----------

alter table public.workers              enable row level security;
alter table public.hr_users             enable row level security;
alter table public.grievances           enable row level security;
alter table public.grievance_attachments enable row level security;
alter table public.grievance_timeline   enable row level security;

-- WORKERS: a worker can read own row; HR can read all
drop policy if exists workers_self_select on public.workers;
create policy workers_self_select on public.workers
  for select using (auth_user_id = auth.uid() or public.is_hr());

-- Only HR can insert/update worker rows (workers are pre-provisioned)
drop policy if exists workers_hr_write on public.workers;
create policy workers_hr_write on public.workers
  for all using (public.is_hr()) with check (public.is_hr());

-- HR_USERS: HR can see themselves and other HR
drop policy if exists hr_users_select on public.hr_users;
create policy hr_users_select on public.hr_users
  for select using (public.is_hr());

drop policy if exists hr_users_self_insert on public.hr_users;
create policy hr_users_self_insert on public.hr_users
  for insert with check (id = auth.uid());

-- GRIEVANCES: worker reads own (by submitter), HR reads all
drop policy if exists grievances_select on public.grievances;
create policy grievances_select on public.grievances
  for select using (submitted_by_auth_id = auth.uid() or public.is_hr());

-- Worker can insert grievance only as themselves
drop policy if exists grievances_insert on public.grievances;
create policy grievances_insert on public.grievances
  for insert with check (submitted_by_auth_id = auth.uid());

-- Only HR can update grievances (status, assignee)
drop policy if exists grievances_update on public.grievances;
create policy grievances_update on public.grievances
  for update using (public.is_hr()) with check (public.is_hr());

-- ATTACHMENTS: visible to the grievance owner and HR
drop policy if exists attachments_select on public.grievance_attachments;
create policy attachments_select on public.grievance_attachments
  for select using (
    public.is_hr() or
    exists (select 1 from public.grievances g
            where g.id = grievance_id and g.submitted_by_auth_id = auth.uid())
  );

-- Worker inserts attachment to own grievance
drop policy if exists attachments_insert on public.grievance_attachments;
create policy attachments_insert on public.grievance_attachments
  for insert with check (
    exists (select 1 from public.grievances g
            where g.id = grievance_id and g.submitted_by_auth_id = auth.uid())
  );

-- TIMELINE: visible to owner and HR
drop policy if exists timeline_select on public.grievance_timeline;
create policy timeline_select on public.grievance_timeline
  for select using (
    public.is_hr() or
    exists (select 1 from public.grievances g
            where g.id = grievance_id and g.submitted_by_auth_id = auth.uid())
  );

-- HR writes timeline entries (workers' submissions are auto-written by trigger)
drop policy if exists timeline_insert on public.grievance_timeline;
create policy timeline_insert on public.grievance_timeline
  for insert with check (public.is_hr());

-- ---------- Storage bucket for attachments ----------

insert into storage.buckets (id, name, public)
values ('grievance-attachments', 'grievance-attachments', false)
on conflict (id) do nothing;

-- Storage policies
-- Path convention: <auth.uid()>/<grievance_id>/<filename>
-- so workers can read/write only their own folder; HR reads all.

drop policy if exists "attachments read own"  on storage.objects;
create policy "attachments read own" on storage.objects
  for select to authenticated using (
    bucket_id = 'grievance-attachments'
    and (public.is_hr() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists "attachments insert own" on storage.objects;
create policy "attachments insert own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'grievance-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "attachments delete own" on storage.objects;
create policy "attachments delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'grievance-attachments'
    and (public.is_hr() or (storage.foldername(name))[1] = auth.uid()::text)
  );
