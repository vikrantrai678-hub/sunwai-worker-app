-- =========================================================================
-- Seed test worker rows in public.workers, linked to auth.users
-- PRE-REQUISITE: you have already created these accounts in
--   Supabase Dashboard -> Authentication -> Users -> "Add user"
--   with these exact emails. PIN = the password you set.
--
-- Suggested test accounts:
--   email: w0042@workers.crtextiles.local   password: 1234
--   email: w0043@workers.crtextiles.local   password: 1234
--   email: w0044@workers.crtextiles.local   password: 1234
--
-- Then run THIS file in SQL Editor.
-- =========================================================================

insert into public.workers (id, name, floor, shift, auth_user_id)
select 'W-0042', 'Ramesh Kumar', 'Floor 3', 'Morning', u.id
from auth.users u where u.email = 'w0042@workers.crtextiles.local'
on conflict (id) do update
  set auth_user_id = excluded.auth_user_id,
      name = excluded.name,
      floor = excluded.floor,
      shift = excluded.shift;

insert into public.workers (id, name, floor, shift, auth_user_id)
select 'W-0043', 'Sunita Devi', 'Floor 2', 'Evening', u.id
from auth.users u where u.email = 'w0043@workers.crtextiles.local'
on conflict (id) do update
  set auth_user_id = excluded.auth_user_id,
      name = excluded.name,
      floor = excluded.floor,
      shift = excluded.shift;

insert into public.workers (id, name, floor, shift, auth_user_id)
select 'W-0044', 'Mohammad Aslam', 'Floor 1', 'Night', u.id
from auth.users u where u.email = 'w0044@workers.crtextiles.local'
on conflict (id) do update
  set auth_user_id = excluded.auth_user_id,
      name = excluded.name,
      floor = excluded.floor,
      shift = excluded.shift;

-- Quick check
select id, name, floor, shift, auth_user_id is not null as linked
from public.workers
order by id;
