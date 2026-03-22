-- Täglicher Server-Snapshot: Immo-News → Bundesland-Scores für Investor-Landkarte (öffentlich lesbar)
create table if not exists public.news_investor_map_snapshots (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_investor_map_snapshots_day_desc_idx
  on public.news_investor_map_snapshots (day desc);

alter table public.news_investor_map_snapshots enable row level security;

create policy "news_investor_map_snapshots_select_public"
  on public.news_investor_map_snapshots
  for select
  to anon, authenticated
  using (true);

comment on table public.news_investor_map_snapshots is 'Tägliche Aggregation aus RSS (Edge news-daily-aggregate); Schreiben nur via Service Role.';
