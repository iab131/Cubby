-- Cubby database.
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Safe to run again after changes: it only adds or replaces things.

-- ---------- rooms: one per signed-in person ----------
create table if not exists public.rooms (
  owner      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  px         int  not null check (px between -60 and 60),
  pz         int  not null check (pz between -60 and 60),
  recipe     jsonb not null check (
               jsonb_typeof(recipe) = 'object'
               and pg_column_size(recipe) < 65536
               and jsonb_typeof(recipe -> 'objects') = 'array'
               and jsonb_array_length(recipe -> 'objects') between 1 and 10
             ),
  hidden     boolean not null default false,  -- set to true (Table Editor) to hide a room
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (px, pz),                    -- one room per square
  check (not (px = 0 and pz = 0))     -- the centre square is the home room
);
-- for databases made with the first version of this file
alter table public.rooms add column if not exists hidden boolean not null default false;
alter table public.rooms drop constraint if exists rooms_px_check;
alter table public.rooms drop constraint if exists rooms_pz_check;
alter table public.rooms add constraint rooms_px_check check (px between -60 and 60);
alter table public.rooms add constraint rooms_pz_check check (pz between -60 and 60);

alter table public.rooms enable row level security;

-- a real (Google) sign-in, not a guest one
create or replace function public.is_real_user() returns boolean
language sql stable as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

drop policy if exists "anyone can see rooms" on public.rooms;
drop policy if exists "you can add your own room" on public.rooms;
drop policy if exists "you can change your own room" on public.rooms;
drop policy if exists "you can delete your own room" on public.rooms;

-- everyone can look, even without signing in (hidden rooms only show to their owner)
create policy "anyone can see rooms" on public.rooms for select
  using (not hidden or auth.uid() = owner);
-- only signed-in people can add, change or delete, and only their own room
create policy "you can add your own room" on public.rooms for insert to authenticated
  with check (public.is_real_user() and auth.uid() = owner and hidden = false);
create policy "you can change your own room" on public.rooms for update to authenticated
  using (auth.uid() = owner) with check (public.is_real_user() and auth.uid() = owner and hidden = false);
create policy "you can delete your own room" on public.rooms for delete to authenticated
  using (auth.uid() = owner);

-- the grid grows one ring at a time: a room must sit at most one ring past the farthest room
create or replace function public.rooms_check_square() returns trigger
language plpgsql security definer set search_path = public as $$
declare far int;
begin
  -- a room that isn't moving can always be edited
  if tg_op = 'UPDATE' and new.px = old.px and new.pz = old.pz then new.updated_at := now(); return new; end if;
  select coalesce(max(greatest(abs(px), abs(pz))), 0) into far
    from public.rooms where owner <> new.owner and not hidden;
  if greatest(abs(new.px), abs(new.pz)) > greatest(far + 1, 3) then
    raise exception 'That square is too far out. Pick a glowing square closer to the middle.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists rooms_check_square on public.rooms;
create trigger rooms_check_square before insert or update of px, pz, recipe on public.rooms
  for each row execute function public.rooms_check_square();

-- ---------- reports: 3 reports from different people hide a room ----------
create table if not exists public.reports (
  room_owner uuid not null references public.rooms(owner) on delete cascade,
  reporter   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason     text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (room_owner, reporter)
);
alter table public.reports enable row level security;
drop policy if exists "signed-in people can report" on public.reports;
create policy "signed-in people can report" on public.reports for insert to authenticated
  with check (public.is_real_user() and auth.uid() = reporter and reporter <> room_owner);
-- no read policy on purpose: only you (in the Supabase dashboard) can read reports

create or replace function public.reports_autohide() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports where room_owner = new.room_owner) >= 3 then
    update public.rooms set hidden = true where owner = new.room_owner;
  end if;
  return new;
end $$;
drop trigger if exists reports_autohide on public.reports;
create trigger reports_autohide after insert on public.reports
  for each row execute function public.reports_autohide();

-- ---------- home room owner: the Google account that owns the centre room ----------
-- Add your email once in the SQL Editor (it stays private, the site never sees it):
--   insert into public.home_owner (email) values ('you@gmail.com') on conflict do nothing;
create table if not exists public.home_owner (email text primary key);
alter table public.home_owner enable row level security;
-- no policies on purpose: nobody can read this table from the site

create or replace function public.is_home_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_real_user() and exists (
    select 1 from public.home_owner where lower(email) = lower(auth.jwt() ->> 'email')
  )
$$;
revoke execute on function public.is_home_owner() from public, anon;
grant execute on function public.is_home_owner() to authenticated;

-- send live updates to everyone when a room is added, changed or deleted
do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null; end $$;
