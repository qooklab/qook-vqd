-- Run once in Supabase SQL Editor. Service role access only.
create table if not exists public.dart_financial_cache(
 code text primary key,
 profit_score integer check(profit_score between 0 and 10),
 balance_score integer check(balance_score between 0 and 10),
 growth_score integer check(growth_score between 0 and 10),
 note text,
 checked_at timestamptz not null default now()
);
alter table public.dart_financial_cache enable row level security;
revoke all on public.dart_financial_cache from anon, authenticated;
create table if not exists public.dart_corp_cache(
 stock_code text primary key,
 corp_code text not null,
 checked_at timestamptz not null default now()
);
alter table public.dart_corp_cache enable row level security;
revoke all on public.dart_corp_cache from anon, authenticated;
