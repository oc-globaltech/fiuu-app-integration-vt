-- Records Fiuu payment notifications (Notify URL / Callback URL with IPN).
--
-- Written only by the fiuu-notify Edge Function using the service role key.
-- RLS is on with no policies, so anon/authenticated clients cannot read or
-- write it directly - the function is the only way in or out. The secret key
-- needed to verify skey must never reach the app.

create table if not exists public.fiuu_payments (
  order_id    text primary key,
  txn_id      text,
  status      text not null,          -- '00' paid, '11' failed, '22' pending
  amount      numeric(12, 2),
  currency    text,
  channel     text,
  paydate     timestamptz,
  appcode     text,
  error_code  text,
  error_desc  text,
  verified    boolean not null default false,  -- skey matched
  raw         jsonb   not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.fiuu_payments is
  'One row per Fiuu order, upserted from the payment gateway webhook. verified=false means the skey did not match and the row must not be trusted.';

create index if not exists fiuu_payments_status_idx on public.fiuu_payments (status);
create index if not exists fiuu_payments_created_at_idx on public.fiuu_payments (created_at desc);

alter table public.fiuu_payments enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fiuu_payments_updated_at on public.fiuu_payments;
create trigger fiuu_payments_updated_at
  before update on public.fiuu_payments
  for each row execute function public.set_updated_at();
