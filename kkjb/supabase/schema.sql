-- KKJB ride-sharing schema (Supabase / Postgres)
-- Run in Supabase Dashboard > SQL Editor.
-- WARNING: drops the existing tables first (all rows are lost).

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();
drop table if exists match_results cascade;
drop table if exists ride_requests cascade;
drop table if exists rides cascade;
drop table if exists profiles cascade;

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

create table profiles (
                          id uuid primary key references auth.users(id) on delete cascade,
                          full_name text,
                          role text not null default 'passenger'
                              check (role in ('driver', 'passenger')),
                          created_at timestamptz not null default now()
);

create table rides (
                       id uuid primary key default gen_random_uuid(),
                       driver_id uuid not null references profiles(id) on delete cascade,
                       origin_lat float8 not null,
                       origin_lng float8 not null,
                       destination_lat float8 not null,
                       destination_lng float8 not null,
                       seats_available int not null check (seats_available >= 0),
                       departure_time timestamptz not null,
                       status text not null default 'active'
                           check (status in ('active', 'full', 'cancelled', 'completed')),
                       route_polyline text,
                       route_distance_m int,
                       est_duration_s int,
                       created_at timestamptz not null default now()
);

create table ride_requests (
                               id uuid primary key default gen_random_uuid(),
                               passenger_id uuid not null references profiles(id) on delete cascade,
                               ride_id uuid references rides(id) on delete set null, -- null until a ride is chosen
                               status text not null default 'pending'
                                   check (status in ('pending', 'accepted', 'declined', 'cancelled', 'completed')),
                               seats_needed int not null default 1 check (seats_needed > 0),
                               origin_lat float8 not null,
                               origin_lng float8 not null,
                               destination_lat float8 not null,
                               destination_lng float8 not null,
                               requested_time timestamptz not null,
                               created_at timestamptz not null default now()
);

create table match_results (
                               id uuid primary key default gen_random_uuid(),
                               request_id uuid not null references ride_requests(id) on delete cascade,
                               ride_id uuid not null references rides(id) on delete cascade,
                               pickup_distance_m float8,
                               detour_m float8,
                               time_diff_min int,
                               score float8,
                               created_at timestamptz not null default now(),
                               unique (request_id, ride_id)
);

-- ---------------------------------------------------------------
-- Indexes (foreign keys + the matching query)
-- ---------------------------------------------------------------

create index idx_rides_status_departure on rides (status, departure_time);
create index idx_rides_driver on rides (driver_id);
create index idx_requests_passenger on ride_requests (passenger_id);
create index idx_requests_ride on ride_requests (ride_id);
create index idx_matches_request on match_results (request_id);

-- ---------------------------------------------------------------
-- Auto-create a profile row when someone signs up
-- (signup screen passes full_name via options.data.full_name)
-- ---------------------------------------------------------------

create function handle_new_user()
    returns trigger
    language plpgsql
security definer
set search_path = public
as $$
begin
insert into profiles (id, full_name)
values (new.id, new.raw_user_meta_data ->> 'full_name');
return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------

alter table profiles enable row level security;
alter table rides enable row level security;
alter table ride_requests enable row level security;
alter table match_results enable row level security;

-- profiles
create policy "profiles: read when signed in"
  on profiles for select to authenticated using (true);
create policy "profiles: update own"
  on profiles for update to authenticated
                             using (id = auth.uid()) with check (id = auth.uid());

-- rides
create policy "rides: read when signed in"
  on rides for select to authenticated using (true);
create policy "rides: driver inserts own"
  on rides for insert to authenticated with check (driver_id = auth.uid());
create policy "rides: driver updates own"
  on rides for update to authenticated
                                 using (driver_id = auth.uid()) with check (driver_id = auth.uid());
create policy "rides: driver deletes own"
  on rides for delete to authenticated using (driver_id = auth.uid());

-- ride_requests: visible to the passenger and to the driver of the chosen ride
create policy "requests: passenger or ride driver can read"
  on ride_requests for select to authenticated
                                                               using (
                                                               passenger_id = auth.uid()
                                                               or exists (
                                                               select 1 from rides r
                                                               where r.id = ride_requests.ride_id and r.driver_id = auth.uid()
                                                               )
                                                           );
create policy "requests: passenger creates own"
  on ride_requests for insert to authenticated
  with check (passenger_id = auth.uid());
create policy "requests: passenger or ride driver can update"
  on ride_requests for update to authenticated
                                         using (
                                         passenger_id = auth.uid()
                                         or exists (
                                         select 1 from rides r
                                         where r.id = ride_requests.ride_id and r.driver_id = auth.uid()
                                         )
                                         )
                       with check (
                                         passenger_id = auth.uid()
                                         or exists (
                                         select 1 from rides r
                                         where r.id = ride_requests.ride_id and r.driver_id = auth.uid()
                                         )
                                         );

-- match_results: passengers can read their own; no write policies on purpose.
-- The edge function uses the service role key, which bypasses RLS, to insert.
create policy "matches: requesting passenger can read"
  on match_results for select to authenticated
                                  using (
                                  exists (
                                  select 1 from ride_requests q
                                  where q.id = match_results.request_id and q.passenger_id = auth.uid()
                                  )
                                  );