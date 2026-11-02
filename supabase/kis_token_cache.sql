-- Run once in Supabase SQL Editor. Keep this table inaccessible to browser clients.
create table if not exists public.kis_token_cache (
 id text primary key,
 access_token text,
 expires_at timestamptz,
 lock_until timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.kis_token_cache enable row level security;
revoke all on public.kis_token_cache from anon, authenticated;
-- Atomic lease acquisition prevents multiple Vercel instances issuing a token at once.
create or replace function public.acquire_kis_token_lease(p_id text, p_lease_seconds integer default 30)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
 insert into public.kis_token_cache(id) values(p_id) on conflict(id) do nothing;
 update public.kis_token_cache
 set lock_until=now()+make_interval(secs=>least(greatest(p_lease_seconds,5),60)),updated_at=now()
 where id=p_id and (lock_until is null or lock_until<now())
 and (access_token is null or expires_at is null or expires_at<=now()+interval '5 minutes');
 get diagnostics v_count=row_count;
 return v_count=1;
end $$;
revoke all on function public.acquire_kis_token_lease(text,integer) from public,anon,authenticated;
grant execute on function public.acquire_kis_token_lease(text,integer) to service_role;
