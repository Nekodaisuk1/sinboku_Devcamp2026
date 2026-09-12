-- Build 26: identity, a user-owned workspace, and the editorial catalog.
-- This migration only adds tables. It does not alter or remove existing user data.

create type public.app_role as enum ('student', 'guardian', 'editor', 'admin');
create type public.resource_status as enum ('draft', 'review', 'published', 'rejected', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  display_name text check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique check (stable_key ~ '^[a-z0-9][a-z0-9-]{1,99}$'),
  published_version_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.resource_versions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  version integer not null check (version > 0),
  status public.resource_status not null default 'draft',
  name text not null check (char_length(name) between 1 and 160),
  summary text not null check (char_length(summary) between 1 and 1000),
  url text not null check (url ~ '^https://'),
  source_name text not null check (char_length(source_name) between 1 and 160),
  checked_on date not null,
  category text not null check (char_length(category) between 1 and 80),
  kind text not null check (char_length(kind) between 1 and 80),
  online boolean not null,
  free boolean not null,
  prefecture text,
  grades jsonb not null default '[]'::jsonb,
  domains jsonb not null default '[]'::jsonb,
  verbs jsonb not null default '[]'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  reason text not null check (char_length(reason) between 1 and 2000),
  first_step text not null check (char_length(first_step) between 1 and 500),
  deadline text,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (resource_id, version),
  check (jsonb_typeof(grades) = 'array'),
  check (jsonb_typeof(domains) = 'array'),
  check (jsonb_typeof(verbs) = 'array'),
  check (jsonb_typeof(conditions) = 'array')
);

alter table public.resources add constraint resources_published_version_id_fkey foreign key (published_version_id) references public.resource_versions(id) on delete set null;

create table public.resource_evidence (
  id uuid primary key default gen_random_uuid(),
  resource_version_id uuid not null references public.resource_versions(id) on delete cascade,
  source_url text not null check (source_url ~ '^https://'),
  checked_on date not null,
  supports text not null check (char_length(supports) between 1 and 2000),
  open_questions text,
  created_at timestamptz not null default now()
);

create index resource_versions_published_idx on public.resource_versions (status, checked_on desc);
create index resource_versions_resource_idx on public.resource_versions (resource_id, version desc);
create index resource_evidence_version_idx on public.resource_evidence (resource_version_id);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger workspaces_updated_at before update on public.workspaces for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''));
  insert into public.workspaces (owner_id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_editor() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin') and deleted_at is null);
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.resources enable row level security;
alter table public.resource_versions enable row level security;
alter table public.resource_evidence enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select on public.resources, public.resource_versions, public.resource_evidence to anon, authenticated;
grant insert, update on public.resources, public.resource_versions, public.resource_evidence to authenticated;

create policy "profiles: users read themselves" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: users update themselves" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "workspaces: owners read" on public.workspaces for select to authenticated using (owner_id = auth.uid());
create policy "workspaces: owners create" on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy "workspaces: owners update" on public.workspaces for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "resources: public published catalog" on public.resources for select using (archived_at is null and published_version_id is not null);
create policy "resources: editors write" on public.resources for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "resource versions: public current published catalog" on public.resource_versions for select using (
  status = 'published'
  and exists (
    select 1 from public.resources r
    where r.published_version_id = id and r.archived_at is null
  )
);
create policy "resource versions: editors write" on public.resource_versions for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "resource evidence: public evidence for current published versions" on public.resource_evidence for select using (
  exists (
    select 1 from public.resource_versions v
    join public.resources r on r.published_version_id = v.id
    where v.id = resource_version_id and v.status = 'published' and r.archived_at is null
  )
);
create policy "resource evidence: editors write" on public.resource_evidence for all to authenticated using (public.is_editor()) with check (public.is_editor());
