-- Members can invite friends without exposing membership writes to the client.
-- Apply after 001_initial.sql and 002_restrict_auto_rls.sql.

alter table public.group_members
  add column if not exists display_name text
  check (display_name is null or char_length(display_name) between 1 and 80);

grant update (display_name), delete on public.group_members to authenticated;

create policy "Members can edit their own name"
  on public.group_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Members can leave their group"
  on public.group_members for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  code text not null unique check (code ~ '^[A-F0-9]{32}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  uses integer not null default 0 check (uses >= 0),
  max_uses integer not null default 10 check (max_uses between 1 and 100),
  revoked_at timestamptz
);

create index group_invites_group_idx on public.group_invites (group_id, expires_at);
alter table public.group_invites enable row level security;
revoke all on public.group_invites from public, anon, authenticated;

create function public.create_group_invite(p_group_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'Du bist kein Mitglied dieser Gruppe.';
  end if;

  -- A newly generated code replaces the caller's earlier active codes.
  update public.group_invites set revoked_at = now()
  where group_id = p_group_id and created_by = auth.uid() and revoked_at is null;

  v_code := upper(replace(gen_random_uuid()::text, '-', ''));
  insert into public.group_invites (group_id, code, created_by, expires_at)
  values (p_group_id, v_code, auth.uid(), now() + interval '7 days');
  return v_code;
end;
$$;

create function public.join_group_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invite public.group_invites%rowtype;
declare v_joined boolean;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich zuerst an.'; end if;
  select * into v_invite from public.group_invites
  where code = upper(regexp_replace(coalesce(p_code, ''), '[^a-fA-F0-9]', '', 'g'))
  for update;
  if not found or v_invite.revoked_at is not null
    or v_invite.expires_at <= now() or v_invite.uses >= v_invite.max_uses
    or not exists (
      select 1 from public.group_members
      where group_id = v_invite.group_id and user_id = v_invite.created_by
    ) then
    raise exception 'Der Einladungscode ist ungültig oder abgelaufen.';
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_invite.group_id, auth.uid()) on conflict do nothing;
  v_joined := found;
  if v_joined then
    update public.group_invites set uses = uses + 1 where id = v_invite.id;
  end if;
  return v_invite.group_id;
end;
$$;

create function public.list_group_members(p_group_id uuid)
returns table(user_id uuid, display_name text, joined_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = auth.uid()
  ) then
    raise exception 'Du bist kein Mitglied dieser Gruppe.';
  end if;
  return query select m.user_id, m.display_name, m.joined_at
    from public.group_members m where m.group_id = p_group_id
    order by m.joined_at;
end;
$$;

revoke execute on function public.create_group_invite(uuid) from public, anon;
revoke execute on function public.join_group_by_code(text) from public, anon;
revoke execute on function public.list_group_members(uuid) from public, anon;
grant execute on function public.create_group_invite(uuid) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.list_group_members(uuid) to authenticated;
