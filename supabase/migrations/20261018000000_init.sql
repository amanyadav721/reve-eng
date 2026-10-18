-- Tagalong: initial schema.
--
-- Auth is Clerk, connected through Supabase third-party auth. Clerk user IDs ("user_…") arrive in
-- auth.jwt()->>'sub', so every user_id column is TEXT (not uuid) and RLS compares against the JWT,
-- never auth.uid(). Each table carries user_id directly so every policy is one cheap comparison.

create extension if not exists pgcrypto;

create or replace function public.requesting_user_id() returns text
  language sql stable
  as $$ select nullif(auth.jwt()->>'sub', '') $$;

-- ─── Travelers ────────────────────────────────────────────────────────────────

create table public.profiles (
  user_id      text primary key default public.requesting_user_id(),
  first_name   text,
  language     text not null default 'en',
  points       integer not null default 0 check (points >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── Trips and plans ──────────────────────────────────────────────────────────

create table public.trips (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null default public.requesting_user_id(),
  city         text not null,
  start_date   date not null,
  end_date     date not null check (end_date >= start_date),
  status       text not null default 'planned' check (status in ('planned', 'active', 'past')),
  -- Quiz answers for this trip (TripPreferences in packages/shared).
  preferences  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index trips_user_idx on public.trips (user_id, start_date desc);

create table public.trip_members (
  trip_id      uuid not null references public.trips (id) on delete cascade,
  user_id      text not null default public.requesting_user_id(),
  name         text not null,
  -- A companion's memory row ("Priya: vegan, carsick"), if the traveler shared one.
  memory_id    uuid,
  primary key (trip_id, name)
);

create table public.trip_days (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  user_id      text not null default public.requesting_user_id(),
  day_number   integer not null check (day_number >= 1),
  date         date not null,
  unique (trip_id, day_number)
);

create table public.stops (
  id            uuid primary key default gen_random_uuid(),
  day_id        uuid not null references public.trip_days (id) on delete cascade,
  user_id       text not null default public.requesting_user_id(),
  position      integer not null,
  -- Google place ID. The planner refuses stops without one.
  place_id      text,
  name          text not null,
  category      text not null check (category in ('food', 'sight', 'transport', 'nature', 'culture', 'shopping')),
  icon          text not null default '📍',
  start_time    time not null,
  duration_min  integer not null check (duration_min > 0),
  cost_inr      integer check (cost_inr >= 0),
  -- { mode, minutes, fareMinInr, fareMaxInr, tip }
  hop           jsonb,
  reason        text,
  points        integer not null default 0,
  status        text not null default 'upcoming' check (status in ('done', 'now', 'upcoming', 'skipped')),
  updated_at    timestamptz not null default now(),
  unique (day_id, position) deferrable initially deferred
);
create index stops_day_idx on public.stops (day_id, position);

create table public.checkins (
  id           uuid primary key default gen_random_uuid(),
  stop_id      uuid not null references public.stops (id) on delete cascade,
  user_id      text not null default public.requesting_user_id(),
  -- Where the phone was. Check-in counts only within ~100 m of the place.
  lat          double precision,
  lng          double precision,
  distance_m   integer,
  points       integer not null default 0,
  created_at   timestamptz not null default now()
);

create table public.dishes_tasted (
  user_id      text not null default public.requesting_user_id(),
  city         text not null,
  dish         text not null,
  place_id     text,
  tasted_at    timestamptz not null default now(),
  primary key (user_id, city, dish)
);

-- ─── Memory: Laddoo never forgets ────────────────────────────────────────────
-- One durable fact per row. The planner loads the core profile in full plus the memories most
-- relevant to the request. Every row says where it came from, and "forget" deletes it for real.
-- Semantic recall (pgvector) is added once we pick the embedding model, since the column needs a
-- fixed dimension.

create table public.memories (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null default public.requesting_user_id(),
  kind         text not null check (kind in ('fact', 'habit', 'love', 'skip', 'person', 'promise')),
  text         text not null,
  -- In the user's words: "You skipped laal maas twice".
  evidence     text not null,
  source       text not null check (source in ('quiz', 'chat', 'checkins', 'edits')),
  icon         text,
  -- Health, religion, money, other people. Stored only after the user agreed.
  sensitive    boolean not null default false,
  consented_at timestamptz,
  confidence   real not null default 1 check (confidence between 0 and 1),
  -- Where to trace it back to: a chat message, a check-in, a stop.
  source_ref   jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint sensitive_needs_consent check (not sensitive or consented_at is not null)
);
create index memories_user_idx on public.memories (user_id, kind);

alter table public.trip_members
  add constraint trip_members_memory_fk foreign key (memory_id) references public.memories (id) on delete set null;

-- Raw conversation history, so any memory can be traced to what was actually said.
create table public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null default public.requesting_user_id(),
  trip_id      uuid references public.trips (id) on delete set null,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  created_at   timestamptz not null default now()
);
create index chat_messages_user_idx on public.chat_messages (user_id, created_at desc);

-- ─── Shared place cache (server-only) ────────────────────────────────────────
-- Filled by the API with the service role. Respect Google's caching terms: place_id may be kept
-- indefinitely; other fields are refreshed, so fetched_at drives expiry.

create table public.place_cache (
  place_id     text primary key,
  provider     text not null default 'google',
  data         jsonb not null,
  fetched_at   timestamptz not null default now()
);

-- ─── updated_at ──────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at() returns trigger
  language plpgsql
  as $$ begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger stops_touch before update on public.stops for each row execute function public.touch_updated_at();
create trigger memories_touch before update on public.memories for each row execute function public.touch_updated_at();

-- ─── Row-level security ──────────────────────────────────────────────────────
-- Owner-only on every user table. place_cache has RLS on and no policies, so only the service
-- role (the API) can touch it.

do $$
declare t text;
begin
  foreach t in array array['profiles', 'trips', 'trip_members', 'trip_days', 'stops', 'checkins', 'dishes_tasted', 'memories', 'chat_messages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner can do everything" on public.%I for all to authenticated
         using ((select public.requesting_user_id()) = user_id)
         with check ((select public.requesting_user_id()) = user_id)', t);
  end loop;
end $$;

alter table public.place_cache enable row level security;
