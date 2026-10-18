-- Money is no longer rupees-only: amounts are in the trip's currency, so Tagalong can plan anywhere.
alter table public.stops rename column cost_inr to cost;
comment on column public.stops.cost is 'Per person, in the trip currency (trips.currency).';

alter table public.trips
  add column currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  add column country text check (country ~ '^[a-z]{2}$'),
  add column time_zone text;
comment on column public.trips.currency is 'ISO 4217 code. Every amount in the trip is in this currency.';
comment on column public.trips.time_zone is 'IANA zone of the destination, e.g. Asia/Kolkata, America/New_York.';
