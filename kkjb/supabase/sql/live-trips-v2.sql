-- ============================================================
-- LIVE TRIPS, PART 2: run this ONCE in Supabase -> SQL Editor -> Run
-- (run live-trips.sql first if you haven't; safe to run again)
-- ============================================================

-- 1. Clean up old test data so nothing blocks you
--    (a) rides still "open" long after they should have left
update rides
set status = 'cancelled'
where status in ('active', 'full')
  and departure_time < now() - interval '3 hours';

--    (b) requests stuck on rides that are already cancelled/completed
update ride_requests rr
set status = 'completed'
from rides r
where rr.ride_id = r.id
  and r.status in ('cancelled', 'completed')
  and rr.status = 'accepted'
  and rr.picked_up_at is not null;

update ride_requests rr
set status = 'cancelled', cancelled_by = 'driver'
from rides r
where rr.ride_id = r.id
  and r.status in ('cancelled', 'completed')
  and rr.status in ('pending', 'accepted')
  and rr.picked_up_at is null;

-- 2. A passenger can only have ONE open request at a time
create or replace function public.one_open_request_per_passenger()
returns trigger
language plpgsql
as $$
begin
  if new.ride_id is not null
     and new.status in ('pending', 'accepted')
     and (tg_op = 'INSERT' or new.ride_id is distinct from old.ride_id) then
    if exists (
      select 1 from ride_requests
      where passenger_id = new.passenger_id
        and id <> new.id
        and ride_id is not null
        and status in ('pending', 'accepted')
    ) then
      raise exception 'You already have an open request. Cancel it first.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists one_open_request on ride_requests;
create trigger one_open_request
  before insert or update of ride_id on ride_requests
  for each row execute function public.one_open_request_per_passenger();

-- 3. Driver accepts a request: check it, take the seat, mark accepted - all in ONE step
create or replace function public.accept_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r  ride_requests%rowtype;
  rd rides%rowtype;
begin
  select * into r from ride_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;

  select * into rd from rides
  where id = r.ride_id and driver_id = auth.uid()
  for update;
  if not found then
    raise exception 'This is not your ride';
  end if;

  if r.status <> 'pending' then
    raise exception 'This request is no longer pending';
  end if;
  if rd.status <> 'active' then
    raise exception 'This ride is not open any more';
  end if;
  if rd.seats_available < r.seats_needed then
    raise exception 'Not enough seats left';
  end if;

  update rides
  set seats_available = seats_available - r.seats_needed,
      status = case when seats_available - r.seats_needed <= 0 then 'full' else status end
  where id = rd.id;

  update ride_requests set status = 'accepted' where id = r.id;
end $$;

revoke all on function public.accept_request(uuid) from public, anon;
grant execute on function public.accept_request(uuid) to authenticated;

-- 4. Tell Supabase to notice the new functions right now
notify pgrst, 'reload schema';
