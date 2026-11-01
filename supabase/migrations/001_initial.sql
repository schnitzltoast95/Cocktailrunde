-- Private group sync for the cocktail app.
-- Apply to a dedicated Supabase project. Group membership is provisioned by
-- the project administrator for the first release.

create table if not exists public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id, group_id);

create table if not exists public.drink_ratings (
  id uuid primary key,
  group_id uuid not null references public.friend_groups(id),
  user_id uuid not null references auth.users(id),
  author_name text not null check (char_length(author_name) between 1 and 80),
  cocktail_id text not null check (char_length(cocktail_id) between 1 and 120),
  liked text not null check (liked in ('yes', 'mixed', 'no')),
  variant text check (variant is null or char_length(variant) between 1 and 80),
  sweetness smallint check (sweetness between 1 and 5),
  fruitiness smallint check (fruitiness between 1 and 5),
  sourness smallint check (sourness between 1 and 5),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists drink_ratings_group_updated_idx
  on public.drink_ratings (group_id, updated_at desc);

alter table public.friend_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.drink_ratings enable row level security;

revoke all on public.friend_groups from anon, authenticated;
revoke all on public.group_members from anon, authenticated;
revoke all on public.drink_ratings from anon, authenticated;

grant select on public.friend_groups to authenticated;
grant select on public.group_members to authenticated;
grant select, insert, update on public.drink_ratings to authenticated;

create policy "Members can read their own membership"
  on public.group_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members can read their groups"
  on public.friend_groups for select to authenticated
  using (
    exists (
      select 1 from public.group_members m
      where m.group_id = id and m.user_id = (select auth.uid())
    )
  );

create policy "Members can read group ratings"
  on public.drink_ratings for select to authenticated
  using (
    exists (
      select 1 from public.group_members m
      where m.group_id = drink_ratings.group_id and m.user_id = (select auth.uid())
    )
  );

create policy "Members can add their ratings"
  on public.drink_ratings for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.group_members m
      where m.group_id = drink_ratings.group_id and m.user_id = (select auth.uid())
    )
  );

create policy "Authors can update their ratings"
  on public.drink_ratings for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.group_members m
      where m.group_id = drink_ratings.group_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.group_members m
      where m.group_id = drink_ratings.group_id and m.user_id = (select auth.uid())
    )
  );
