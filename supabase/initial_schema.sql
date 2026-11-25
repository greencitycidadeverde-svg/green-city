-- GREEN CITY initial platform schema: two account types (admin/user)
-- Roles are server-controlled; an allowlisted, verified founder email is bootstrapped as admin.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.bootstrap_admin_emails (
  email text primary key check (email = lower(btrim(email)))
);
revoke all on table private.bootstrap_admin_emails from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '' check (char_length(display_name) <= 80),
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_regions (
  phase_number smallint primary key check (phase_number between 1 and 10),
  slug text not null unique,
  region_name text not null,
  learning_focus text not null,
  sort_order smallint not null unique
);
insert into public.game_regions values
  (1,'centro-industrial','Centro Industrial','Resíduos, coleta seletiva, energia solar e mobilidade elétrica',1),
  (2,'porto','Porto','Efluentes industriais, saneamento sanitário e cooperativa de triagem',2),
  (3,'periferia-verde','Periferia Verde','Coleta comunitária, compostagem, saneamento e drenagem urbana',3),
  (4,'reserva-florestal','Reserva Florestal','Biodiversidade, habitats, corredores ecológicos e prevenção de queimadas',4),
  (5,'zona-costeira','Zona Costeira','Bacias hidrográficas, rios, manguezais e ecossistemas marinhos',5),
  (6,'cinturao-agricola','Cinturão Agrícola','Solo, erosão, agrofloresta, irrigação e produção sustentável',6),
  (7,'centro-historico','Centro Histórico','Mobilidade urbana, qualidade do ar, energia e arborização',7),
  (8,'distrito-tecnologico','Distrito Tecnológico','Resíduos eletrônicos, pneus, baterias, vidro e logística reversa',8),
  (9,'vale-das-nascentes','Vale das Nascentes','Nascentes, mata ciliar, bacias, licenciamento e gestão ambiental',9),
  (10,'ilha-da-biodiversidade','Ilha da Biodiversidade','Gestão integrada, mudanças climáticas, governança e economia circular',10);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  campaign_name text not null default 'Minha Cidade Verde',
  current_phase smallint not null default 1 check (current_phase between 1 and 10),
  highest_unlocked_phase smallint not null default 1 check (highest_unlocked_phase between 1 and 10),
  knowledge_points integer not null default 0 check (knowledge_points >= 0),
  level_title text not null default 'Aprendiz Ambiental',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.phase_progress (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  user_id uuid not null,
  phase_number smallint not null references public.game_regions(phase_number),
  status text not null default 'locked' check (status in ('locked','available','in_progress','completed')),
  environment_state text not null default 'locked' check (environment_state in ('locked','degraded','restoring','restored')),
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  score integer not null default 0 check (score >= 0),
  objective_state jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (campaign_id, phase_number),
  unique (campaign_id, user_id, phase_number),
  foreign key (campaign_id, user_id) references public.campaigns(id, user_id) on delete cascade
);
create index phase_progress_user_phase_idx on public.phase_progress(user_id, phase_number);

create table public.objective_progress (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  user_id uuid not null,
  phase_number smallint not null,
  objective_key text not null check (char_length(objective_key) between 1 and 100),
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  points integer not null default 0 check (points >= 0),
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (campaign_id, phase_number, objective_key),
  foreign key (campaign_id, user_id, phase_number)
    references public.phase_progress(campaign_id, user_id, phase_number) on delete cascade
);
create index objective_progress_user_phase_idx on public.objective_progress(user_id, phase_number);

create table public.learning_journal (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  user_id uuid not null,
  phase_number smallint not null references public.game_regions(phase_number),
  entry_type text not null default 'learning_report'
    check (entry_type in ('field_note','diagnosis','decision','learning_report','reflection')),
  title text not null check (char_length(title) between 1 and 160),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, user_id) references public.campaigns(id, user_id) on delete cascade
);
create index learning_journal_user_phase_idx
  on public.learning_journal(user_id, phase_number, created_at desc);

create table public.progress_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  user_id uuid not null,
  phase_number smallint references public.game_regions(phase_number),
  event_type text not null check (char_length(event_type) between 1 and 80),
  points integer not null default 0 check (points >= 0),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (campaign_id, user_id) references public.campaigns(id, user_id) on delete cascade
);
create index progress_events_user_created_idx on public.progress_events(user_id, created_at desc);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  old_role text not null check (old_role in ('admin','user')),
  new_role text not null check (new_role in ('admin','user')),
  created_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_role text := 'user';
  v_campaign_id uuid;
  v_display_name text := '';
begin
  if new.email is not null and new.email_confirmed_at is not null
     and exists (select 1 from private.bootstrap_admin_emails a where a.email = lower(btrim(new.email))) then
    v_role := 'admin';
  end if;
  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    ''
  );
  insert into public.profiles (id,email,display_name,role)
  values (new.id,lower(new.email),v_display_name,v_role)
  on conflict (id) do update set email=excluded.email, display_name=excluded.display_name;
  if new.email is not null and new.email_confirmed_at is not null
     and exists (select 1 from private.bootstrap_admin_emails a where a.email=lower(btrim(new.email))) then
    update public.profiles set role='admin' where id=new.id;
  end if;
  insert into public.campaigns (user_id) values (new.id)
  on conflict (user_id) do nothing returning id into v_campaign_id;
  if v_campaign_id is null then
    select c.id into v_campaign_id from public.campaigns c where c.user_id=new.id;
  end if;
  insert into public.phase_progress (campaign_id,user_id,phase_number,status,environment_state)
  select v_campaign_id,new.id,r.phase_number,
    case when r.phase_number=1 then 'available' else 'locked' end,
    case when r.phase_number=1 then 'degraded' else 'locked' end
  from public.game_regions r
  on conflict (campaign_id,phase_number) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_or_updated
after insert or update of email, raw_user_meta_data, email_confirmed_at
on auth.users for each row execute function private.handle_new_auth_user();

create or replace function public.admin_set_user_role(target_user_id uuid,new_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old_role text; v_admin_count integer;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Acesso restrito a administradores.' using errcode='42501';
  end if;
  if new_role not in ('admin','user') then
    raise exception 'Papel inválido. Use admin ou user.' using errcode='22023';
  end if;
  if target_user_id=(select auth.uid()) and new_role='user' then
    raise exception 'Você não pode remover seu próprio acesso administrativo.' using errcode='42501';
  end if;
  select p.role into v_old_role from public.profiles p where p.id=target_user_id for update;
  if not found then raise exception 'Usuário não encontrado.' using errcode='P0002'; end if;
  if v_old_role=new_role then return; end if;
  if v_old_role='admin' and new_role='user' then
    select count(*) into v_admin_count from public.profiles p where p.role='admin';
    if v_admin_count<=1 then
      raise exception 'O último administrador não pode ser rebaixado.' using errcode='42501';
    end if;
  end if;
  update public.profiles set role=new_role where id=target_user_id;
  insert into public.admin_audit_log(actor_user_id,target_user_id,old_role,new_role)
  values ((select auth.uid()),target_user_id,v_old_role,new_role);
end;
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.admin_set_user_role(uuid,text) from public, anon;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function private.set_updated_at();
create trigger phase_progress_set_updated_at before update on public.phase_progress
for each row execute function private.set_updated_at();
create trigger objective_progress_set_updated_at before update on public.objective_progress
for each row execute function private.set_updated_at();
create trigger learning_journal_set_updated_at before update on public.learning_journal
for each row execute function private.set_updated_at();

revoke all on public.profiles,public.game_regions,public.campaigns,public.phase_progress,
  public.objective_progress,public.learning_journal,public.progress_events,public.admin_audit_log
from anon,authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.game_regions to authenticated;
grant select,update (campaign_name,current_phase,highest_unlocked_phase,knowledge_points,level_title)
  on public.campaigns to authenticated;
grant select,insert,update,delete on public.phase_progress to authenticated;
grant select,insert,update,delete on public.objective_progress to authenticated;
grant select,insert,update,delete on public.learning_journal to authenticated;
grant select,insert on public.progress_events to authenticated;
grant select on public.admin_audit_log to authenticated;

alter table public.profiles enable row level security;
alter table public.game_regions enable row level security;
alter table public.campaigns enable row level security;
alter table public.phase_progress enable row level security;
alter table public.objective_progress enable row level security;
alter table public.learning_journal enable row level security;
alter table public.progress_events enable row level security;
alter table public.admin_audit_log enable row level security;

create policy profiles_select_owner_or_admin on public.profiles for select to authenticated
using (id=(select auth.uid()) or (select private.is_admin()));
create policy profiles_update_own_display_name on public.profiles for update to authenticated
using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy game_regions_read_authenticated on public.game_regions for select to authenticated using (true);
create policy campaigns_select_owner_or_admin on public.campaigns for select to authenticated
using (user_id=(select auth.uid()) or (select private.is_admin()));
create policy campaigns_update_owner_or_admin on public.campaigns for update to authenticated
using (user_id=(select auth.uid()) or (select private.is_admin()))
with check (user_id=(select auth.uid()) or (select private.is_admin()));
create policy phase_progress_owner_or_admin on public.phase_progress for all to authenticated
using (user_id=(select auth.uid()) or (select private.is_admin()))
with check (user_id=(select auth.uid()) or (select private.is_admin()));
create policy objective_progress_owner_or_admin on public.objective_progress for all to authenticated
using (user_id=(select auth.uid()) or (select private.is_admin()))
with check (user_id=(select auth.uid()) or (select private.is_admin()));
create policy learning_journal_owner_or_admin on public.learning_journal for all to authenticated
using (user_id=(select auth.uid()) or (select private.is_admin()))
with check (user_id=(select auth.uid()) or (select private.is_admin()));
create policy progress_events_owner_or_admin on public.progress_events for all to authenticated
using (user_id=(select auth.uid()) or (select private.is_admin()))
with check (user_id=(select auth.uid()) or (select private.is_admin()));
create policy admin_audit_log_admin_read on public.admin_audit_log for select to authenticated
using ((select private.is_admin()));

comment on table public.profiles is 'Account profile with the only two platform roles: admin and user.';
comment on table public.campaigns is 'One independent GREEN CITY campaign per account.';
comment on table public.phase_progress is 'Per-account state and map color for each of the ten regions.';
comment on table public.learning_journal is 'Caderno de Campo and Caderno de Aprendizado entries.';

-- Final hardening migrations, concatenated for a one-file reference snapshot.
-- Remove the public SECURITY DEFINER role RPC and add audit/index support.
drop function if exists public.admin_set_user_role(uuid, text);
grant update (role) on public.profiles to authenticated;
create policy profiles_update_admin_role on public.profiles for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function private.audit_profile_role_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.role is distinct from new.role then
    insert into public.admin_audit_log(actor_user_id,target_user_id,old_role,new_role)
    values ((select auth.uid()),new.id,old.role,new.role);
  end if;
  return new;
end;
$$;
revoke all on function private.audit_profile_role_change() from public,anon,authenticated;
create trigger profiles_audit_role_change after update of role on public.profiles
for each row execute function private.audit_profile_role_change();

create index admin_audit_log_actor_idx on public.admin_audit_log(actor_user_id);
create index admin_audit_log_target_idx on public.admin_audit_log(target_user_id);
create index learning_journal_campaign_owner_idx on public.learning_journal(campaign_id,user_id);
create index learning_journal_phase_idx on public.learning_journal(phase_number);
create index objective_progress_campaign_owner_phase_idx on public.objective_progress(campaign_id,user_id,phase_number);
create index phase_progress_phase_idx on public.phase_progress(phase_number);
create index progress_events_campaign_owner_idx on public.progress_events(campaign_id,user_id);
create index progress_events_phase_idx on public.progress_events(phase_number);

-- Public RPC is SECURITY INVOKER; the privileged implementation stays private.
drop policy if exists profiles_update_admin_role on public.profiles;
revoke update (role) on public.profiles from authenticated;

create or replace function private.perform_admin_role_change(target_user_id uuid,new_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old_role text; v_admin_count integer;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Acesso restrito a administradores.' using errcode='42501';
  end if;
  if new_role not in ('admin','user') then
    raise exception 'Papel inválido. Use admin ou user.' using errcode='22023';
  end if;
  if target_user_id=(select auth.uid()) and new_role='user' then
    raise exception 'Você não pode remover seu próprio acesso administrativo.' using errcode='42501';
  end if;
  select p.role into v_old_role from public.profiles p where p.id=target_user_id for update;
  if not found then raise exception 'Usuário não encontrado.' using errcode='P0002'; end if;
  if v_old_role=new_role then return; end if;
  if v_old_role='admin' and new_role='user' then
    select count(*) into v_admin_count from public.profiles p where p.role='admin';
    if v_admin_count<=1 then
      raise exception 'O último administrador não pode ser rebaixado.' using errcode='42501';
    end if;
  end if;
  update public.profiles set role=new_role where id=target_user_id;
end;
$$;
revoke all on function private.perform_admin_role_change(uuid,text) from public,anon;
grant execute on function private.perform_admin_role_change(uuid,text) to authenticated;

create or replace function public.admin_set_user_role(target_user_id uuid,new_role text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  perform private.perform_admin_role_change(target_user_id,new_role);
end;
$$;
revoke all on function public.admin_set_user_role(uuid,text) from public,anon;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;
