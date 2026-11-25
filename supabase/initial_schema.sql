-- GREEN CITY — schema inicial para produto escolar multi-instituição
-- Aplicar somente depois de criar/conectar o projeto Supabase aprovado.
-- Todas as tabelas públicas têm RLS e privilégios explícitos.
-- Atribuição de platform_admin deve ser feita pelo operador do projeto, nunca pelo cliente.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 140),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('platform_admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.school_memberships (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'teacher', 'school_admin')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (school_id, user_id)
);

create index school_memberships_user_idx on public.school_memberships(user_id, status);
create index school_memberships_school_role_idx on public.school_memberships(school_id, role, status);

create table public.campaign_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_phase smallint not null default 1 check (current_phase between 1 and 10),
  highest_unlocked_phase smallint not null default 1 check (highest_unlocked_phase between 1 and 10),
  completed_phases smallint[] not null default '{}',
  knowledge_points integer not null default 0 check (knowledge_points >= 0),
  level_title text not null default 'Aprendiz Ambiental',
  updated_at timestamptz not null default now()
);

create table public.phase_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phase_number smallint not null check (phase_number between 1 and 10),
  status text not null default 'locked' check (status in ('locked', 'available', 'in_progress', 'completed')),
  objective_state jsonb not null default '{}'::jsonb,
  score integer not null default 0 check (score >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, phase_number)
);

create index phase_progress_user_idx on public.phase_progress(user_id, phase_number);

create table public.learning_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phase_number smallint not null check (phase_number between 1 and 10),
  entry_type text not null default 'learning_report'
    check (entry_type in ('field_note', 'diagnosis', 'decision', 'learning_report')),
  title text not null check (char_length(title) between 1 and 160),
  content text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learning_journal_user_phase_idx
  on public.learning_journal(user_id, phase_number, created_at desc);

-- Security helpers are deliberately kept in the non-exposed private schema.
-- SECURITY DEFINER is limited to these read-only role/membership lookups to
-- avoid recursive RLS policies. search_path is empty and references are qualified.
create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'platform_admin'
  );
$$;

create or replace function private.has_school_role(p_school_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_memberships sm
    where sm.school_id = p_school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active'
      and sm.role = any(p_roles)
  );
$$;

create or replace function private.can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_student_id = (select auth.uid())
    or private.is_platform_admin()
    or exists (
      select 1
      from public.school_memberships staff
      join public.school_memberships student
        on student.school_id = staff.school_id
      where staff.user_id = (select auth.uid())
        and staff.status = 'active'
        and staff.role in ('teacher', 'school_admin')
        and student.user_id = p_student_id
        and student.status = 'active'
        and student.role = 'student'
    );
$$;

create or replace function private.can_manage_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or private.has_school_role(p_school_id, array['school_admin']::text[]);
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.is_platform_admin() from public, anon;
revoke all on function private.has_school_role(uuid, text[]) from public, anon;
revoke all on function private.can_view_student(uuid) from public, anon;
revoke all on function private.can_manage_school(uuid) from public, anon;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.has_school_role(uuid, text[]) to authenticated;
grant execute on function private.can_view_student(uuid) to authenticated;
grant execute on function private.can_manage_school(uuid) to authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger schools_set_updated_at
before update on public.schools
for each row execute function private.set_updated_at();

create trigger school_memberships_set_updated_at
before update on public.school_memberships
for each row execute function private.set_updated_at();

create trigger campaign_progress_set_updated_at
before update on public.campaign_progress
for each row execute function private.set_updated_at();

create trigger phase_progress_set_updated_at
before update on public.phase_progress
for each row execute function private.set_updated_at();

create trigger learning_journal_set_updated_at
before update on public.learning_journal
for each row execute function private.set_updated_at();

-- Explicit least-privilege grants: no anonymous access to learner or school data.
revoke all on public.profiles, public.schools, public.user_roles,
  public.school_memberships, public.campaign_progress,
  public.phase_progress, public.learning_journal from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.schools to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.school_memberships to authenticated;
grant select, insert, update, delete on public.campaign_progress to authenticated;
grant select, insert, update, delete on public.phase_progress to authenticated;
grant select, insert, update, delete on public.learning_journal to authenticated;

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.user_roles enable row level security;
alter table public.school_memberships enable row level security;
alter table public.campaign_progress enable row level security;
alter table public.phase_progress enable row level security;
alter table public.learning_journal enable row level security;

create policy "profiles_select_owner_or_school_staff"
on public.profiles for select to authenticated
using ((select private.can_view_student(id)));

create policy "profiles_insert_self"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "schools_select_members"
on public.schools for select to authenticated
using (
  (select private.has_school_role(id, array['student','teacher','school_admin']::text[]))
  or (select private.is_platform_admin())
);

create policy "schools_update_admin"
on public.schools for update to authenticated
using ((select private.can_manage_school(id)))
with check ((select private.can_manage_school(id)));

create policy "user_roles_select_self"
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()));

create policy "school_memberships_select_self_or_school_admin"
on public.school_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.can_manage_school(school_id))
  or (select private.has_school_role(school_id, array['teacher']::text[]))
);

create policy "school_memberships_insert_school_admin"
on public.school_memberships for insert to authenticated
with check ((select private.can_manage_school(school_id)));

create policy "school_memberships_update_school_admin"
on public.school_memberships for update to authenticated
using ((select private.can_manage_school(school_id)))
with check ((select private.can_manage_school(school_id)));

create policy "school_memberships_delete_school_admin"
on public.school_memberships for delete to authenticated
using ((select private.can_manage_school(school_id)));

create policy "campaign_progress_select_owner_or_teacher"
on public.campaign_progress for select to authenticated
using ((select private.can_view_student(user_id)));

create policy "campaign_progress_insert_self"
on public.campaign_progress for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "campaign_progress_update_self"
on public.campaign_progress for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "campaign_progress_delete_self"
on public.campaign_progress for delete to authenticated
using (user_id = (select auth.uid()));

create policy "phase_progress_select_owner_or_teacher"
on public.phase_progress for select to authenticated
using ((select private.can_view_student(user_id)));

create policy "phase_progress_insert_self"
on public.phase_progress for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "phase_progress_update_self"
on public.phase_progress for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "phase_progress_delete_self"
on public.phase_progress for delete to authenticated
using (user_id = (select auth.uid()));

create policy "learning_journal_select_owner_or_teacher"
on public.learning_journal for select to authenticated
using ((select private.can_view_student(user_id)));

create policy "learning_journal_insert_self"
on public.learning_journal for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "learning_journal_update_self"
on public.learning_journal for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "learning_journal_delete_self"
on public.learning_journal for delete to authenticated
using (user_id = (select auth.uid()));

-- Atribua platform_admin ao id da conta fundadora depois do primeiro cadastro,
-- usando uma operação privilegiada no projeto. Nunca exponha service_role no navegador.
