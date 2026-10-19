-- The app now runs on real trips: what a stop needs to show on the map and be re-planned, a city per
-- day (trips can span several cities), and no duplicate memories when the quiz is taken again.

alter table public.trips
  add column destination text,
  -- The outline: [{ city, country, days, why, startDate, endDate }] in travel order.
  add column legs jsonb not null default '[]'::jsonb;
comment on column public.trips.destination is 'What the traveler typed: "Rajasthan", "Miami", "Japan for 10 days".';

alter table public.trip_days
  add column city text,
  add column country text check (country ~ '^[a-z]{2}$'),
  add column time_zone text,
  add column currency text check (currency ~ '^[A-Z]{3}$'),
  -- Set once the planner has filled the day.
  add column planned_at timestamptz;

alter table public.stops
  add column location jsonb,
  add column moment text check (moment in ('sunrise', 'sunset', 'evening_aarti')),
  add column distance_km real,
  add column open_until text;
comment on column public.stops.hop is '{ mode, minutes, fareMin, fareMax, estimated, tip }, fares in the trip currency.';

-- One row per thing Laddoo knows. Taking the quiz again must not repeat "Vegetarian".
create unique index memories_user_text_idx on public.memories (user_id, lower(text));
