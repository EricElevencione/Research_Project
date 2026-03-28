-- ============================================================
-- Land History Duplicate Guard + Cleanup
-- Run in Supabase SQL Editor
-- ============================================================

begin;

-- Safety backup (one-time)
create table if not exists public.land_history_backup_fix_2026_02_25 as
select * from public.land_history;

-- Keep only one current row per farm_parcel_id (on insert/update)
create or replace function public.land_history_keep_single_current()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.is_current, false) = true
     and new.farm_parcel_id is not null then
    update public.land_history lh
    set
      is_current = false,
      period_end_date = coalesce(lh.period_end_date, coalesce(new.period_start_date, current_date)),
      updated_at = now()
    where lh.farm_parcel_id = new.farm_parcel_id
      and lh.is_current = true
      and lh.id <> coalesce(new.id, -1);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_land_history_single_current_ins on public.land_history;
create trigger trg_land_history_single_current_ins
before insert on public.land_history
for each row
execute function public.land_history_keep_single_current();

drop trigger if exists trg_land_history_single_current_upd on public.land_history;
create trigger trg_land_history_single_current_upd
before update of is_current, farm_parcel_id on public.land_history
for each row
when (new.is_current = true)
execute function public.land_history_keep_single_current();

-- Cleanup existing duplicates: keep newest current row, close the rest
with ranked as (
  select
    id,
    row_number() over (
      partition by farm_parcel_id
      order by coalesce(updated_at, created_at, now()) desc, id desc
    ) as rn
  from public.land_history
  where is_current = true
    and farm_parcel_id is not null
)
update public.land_history lh
set
  is_current = false,
  period_end_date = coalesce(lh.period_end_date, current_date),
  updated_at = now()
from ranked r
where lh.id = r.id
  and r.rn > 1;

-- Enforce at DB level
create unique index if not exists ux_land_history_one_current_per_farm_parcel
on public.land_history (farm_parcel_id)
where is_current = true and farm_parcel_id is not null;

commit;

-- Verify (should return 0 rows)
select farm_parcel_id, count(*) as current_rows
from public.land_history
where is_current = true
  and farm_parcel_id is not null
group by farm_parcel_id
having count(*) > 1;
