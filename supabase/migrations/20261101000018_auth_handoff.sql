-- One-time handoff of a signed-in session from the mobile browser to the installed app (PWA).
-- On iOS the browser and the home-screen app have separate storage, so the browser parks its refresh token behind a
-- short single-use code (15 minutes); the app claims it once and starts its own session. Nobody can read the table
-- directly: only the two functions below touch it.
create table if not exists public.auth_handoffs (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  refresh_token text not null,
  expires_at timestamptz not null default (now() + interval '15 minutes')
);
alter table public.auth_handoffs enable row level security;
revoke all on public.auth_handoffs from anon, authenticated;

create or replace function public.create_handoff(p_refresh_token text) returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  c text := '';
  i int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.auth_handoffs where user_id = auth.uid() or expires_at < now();
  for i in 0..9 loop c := c || substr(alphabet, 1 + (get_byte(bytes, i) % 31), 1); end loop;
  insert into public.auth_handoffs (code, user_id, refresh_token) values (c, auth.uid(), p_refresh_token);
  return c;
end $$;

create or replace function public.claim_handoff(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  delete from public.auth_handoffs
   where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and expires_at > now()
  returning refresh_token into t;
  return t;
end $$;

revoke all on function public.create_handoff(text) from public, anon;
revoke all on function public.claim_handoff(text) from public;
grant execute on function public.create_handoff(text) to authenticated;
grant execute on function public.claim_handoff(text) to anon, authenticated;
