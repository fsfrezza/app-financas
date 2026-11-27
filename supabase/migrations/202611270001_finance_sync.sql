-- Personal financial data: all access is scoped to auth.uid().
create table public.finance_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint payload_size check (octet_length(payload::text) <= 5000000),
  constraint payload_shape check (coalesce(
    jsonb_typeof(payload) = 'object' and payload->>'schema' = '1' and
    jsonb_typeof(payload->'transactions') = 'array' and
    jsonb_typeof(payload->'categories') = 'array' and
    jsonb_typeof(payload->'accounts') = 'array' and
    jsonb_typeof(payload->'consumables') = 'array'
  ,false))
);
alter table public.finance_vaults enable row level security;
revoke all on public.finance_vaults from anon, authenticated;
grant select on public.finance_vaults to authenticated;
create policy vault_owner_read on public.finance_vaults for select to authenticated using ((select auth.uid()) = user_id);
-- The only write path is a revision-checked operation. The authenticated user ID
-- comes from the session; the client cannot choose the owner of a vault.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create function private.save_finance_vault(expected_revision bigint, next_payload jsonb, expected_user uuid)
returns table(revision bigint, payload jsonb, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or uid is distinct from expected_user then raise exception 'Authentication required' using errcode = '28000'; end if;
  if expected_revision < 0 or expected_revision is null then raise exception 'Invalid revision'; end if;
  if next_payload is null or pg_catalog.octet_length(next_payload::text) > 5000000 then raise exception 'Invalid payload'; end if;
  if expected_revision = 0 then
    return query insert into public.finance_vaults as v (user_id,payload)
      values (uid,next_payload) on conflict (user_id) do nothing
      returning v.revision,v.payload,v.updated_at;
  else
    return query update public.finance_vaults as v
      set payload=next_payload, revision=v.revision+1, updated_at=pg_catalog.now()
      where v.user_id=uid and v.revision=expected_revision
      returning v.revision,v.payload,v.updated_at;
  end if;
  -- Zero rows mean a competing device has already written. Clients must fetch
  -- and merge again, never repeat an unconditional update.
end;
$$;
revoke all on function private.save_finance_vault(bigint,jsonb,uuid) from public,anon;
grant execute on function private.save_finance_vault(bigint,jsonb,uuid) to authenticated;

-- Expose only an invoker wrapper through the REST API; privileged SQL is kept
-- in a schema that is not exposed. The inner function always verifies auth.uid.
create function public.save_finance_vault(expected_revision bigint, next_payload jsonb, expected_user uuid)
returns table(revision bigint,payload jsonb,updated_at timestamptz)
language sql security invoker set search_path = '' as $$
  select * from private.save_finance_vault(expected_revision,next_payload,expected_user);
$$;
revoke all on function public.save_finance_vault(bigint,jsonb,uuid) from public,anon;
grant execute on function public.save_finance_vault(bigint,jsonb,uuid) to authenticated;
