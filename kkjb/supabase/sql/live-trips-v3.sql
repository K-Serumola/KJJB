-- ============================================================
-- PASSENGER CANCEL WITH A REASON: run ONCE in Supabase -> SQL Editor -> Run
-- (safe to run again)
-- ============================================================

-- 1. Where the reason is saved
alter table ride_requests add column if not exists cancel_reason text;

-- 2. Replace cancel_request so it also takes a reason
--    (the old one-argument version is removed so the app never gets confused)
drop function if exists public.cancel_request(uuid);

create or replace function public.cancel_request(p_request_id uuid, p_reason text default null)
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

  update ride_requests
  set status = 'cancelled',
      cancelled_by = 'passenger',
      cancel_reason = left(nullif(trim(p_reason), ''), 80)
  where id = p_request_id;

  -- an accepted seat goes back to the ride
  if r.status = 'accepted' and r.ride_id is not null then
    update rides
    set seats_available = seats_available + r.seats_needed,
        status = case when status = 'full' then 'active' else status end
    where id = r.ride_id;
  end if;
end $$;

revoke all on function public.cancel_request(uuid, text) from public, anon;
grant execute on function public.cancel_request(uuid, text) to authenticated;

-- 3. Tell Supabase to notice it right now
notify pgrst, 'reload schema';
