-- ============================================================
-- LIVE TRIPS: run this ONCE in Supabase -> SQL Editor -> Run
-- (safe to run again, it will not break anything)
-- ============================================================

-- 1. Remember who cancelled a request ('driver' or 'passenger')
alter table ride_requests add column if not exists cancelled_by text;

-- 2. Switch on live updates (Realtime) for the two tables
do $$ begin
  alter publication supabase_realtime add table ride_requests;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table rides;
exception when duplicate_object then null; end $$;

-- 3. Clear old test rides that were never finished, so they don't block drivers
update rides
set status = 'cancelled'
where status in ('active', 'full')
  and departure_time < now() - interval '3 hours';

-- 4. A driver can only have ONE open ride at a time
create or replace function public.one_active_ride_per_driver()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from rides
    where driver_id = new.driver_id
      and status in ('active', 'full')
  ) then
    raise exception 'You already have an open ride. Cancel or finish it first.';
  end if;
  return new;
end $$;

drop trigger if exists one_active_ride on rides;
create trigger one_active_ride
  before insert on rides
  for each row execute function public.one_active_ride_per_driver();

-- 5. Driver cancels a ride: the ride AND every pending/accepted request on it
create or replace function public.cancel_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update rides set status = 'cancelled'
  where id = p_ride_id and driver_id = auth.uid() and status in ('active', 'full');
  if not found then
    raise exception 'Ride not found or already finished';
  end if;

  update ride_requests set status = 'cancelled', cancelled_by = 'driver'
  where ride_id = p_ride_id and status in ('pending', 'accepted');
end $$;

-- 6. Driver finishes a ride: picked-up passengers = completed, everyone else = cancelled
create or replace function public.finish_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update rides set status = 'completed'
  where id = p_ride_id and driver_id = auth.uid() and status in ('active', 'full');
  if not found then
    raise exception 'Ride not found or already finished';
  end if;

  update ride_requests set status = 'completed'
  where ride_id = p_ride_id and status = 'accepted' and picked_up_at is not null;

  update ride_requests set status = 'cancelled', cancelled_by = 'driver'
  where ride_id = p_ride_id and status in ('pending', 'accepted');
end $$;

-- 7. Passenger cancels a request: an accepted seat goes back to the ride
create or replace function public.cancel_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r ride_requests%rowtype;
begin
  select * into r from ride_requests
  where id = p_request_id and passenger_id = auth.uid()
  for update;
  if not found then
    raise exception 'Request not found';
  end if;

  if r.status not in ('pending', 'accepted') then
    return; -- already finished or cancelled, nothing to do
  end if;
  if r.picked_up_at is not null then
    raise exception 'The trip has already started';
  end if;

  update ride_requests set status = 'cancelled', cancelled_by = 'passenger'
  where id = p_request_id;

  if r.status = 'accepted' and r.ride_id is not null then
    update rides
    set seats_available = seats_available + r.seats_needed,
        status = case when status = 'full' then 'active' else status end
    where id = r.ride_id;
  end if;
end $$;

-- 8. Only signed-in users may call these
revoke all on function public.cancel_ride(uuid) from public, anon;
revoke all on function public.finish_ride(uuid) from public, anon;
revoke all on function public.cancel_request(uuid) from public, anon;
grant execute on function public.cancel_ride(uuid) to authenticated;
grant execute on function public.finish_ride(uuid) to authenticated;
grant execute on function public.cancel_request(uuid) to authenticated;
