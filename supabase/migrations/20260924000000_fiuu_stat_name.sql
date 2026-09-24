-- Fiuu's own status name (captured, settled, cancelled, chargeback, ...).
-- StatCode alone folds a voided sale into "11 failed"; the name keeps them apart.
-- Filled by the Daily Transaction Report sync; notifications do not carry it.
alter table public.fiuu_payments add column if not exists stat_name text;

-- Notifications were stored as if paydate were UTC, but Fiuu sends Malaysia
-- time (UTC+8). Shift the rows written before the fix back by eight hours.
update public.fiuu_payments
set paydate = paydate - interval '8 hours'
where paydate is not null and stat_name is null;
