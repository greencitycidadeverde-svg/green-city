-- GREEN CITY: Master identity and team hierarchy.
alter table private.bootstrap_admin_emails rename to bootstrap_master_emails;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('master_admin','admin','user'));
alter table public.admin_audit_log drop constraint if exists admin_audit_log_old_role_check;
alter table public.admin_audit_log add constraint admin_audit_log_old_role_check check (old_role in ('master_admin','admin','user'));
alter table public.admin_audit_log drop constraint if exists admin_audit_log_new_role_check;
alter table public.admin_audit_log add constraint admin_audit_log_new_role_check check (new_role in ('master_admin','admin','user'));
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('master_admin','admin')); $$;
revoke all on function private.is_admin() from public,anon;
grant execute on function private.is_admin() to authenticated;
create or replace function private.is_master() returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.profiles p join private.bootstrap_master_emails m on m.email=lower(btrim(p.email)) where p.id=(select auth.uid()) and p.role='master_admin'); $$;
revoke all on function private.is_master() from public,anon;
grant execute on function private.is_master() to authenticated;
create or replace function private.handle_new_auth_user() returns trigger language plpgsql security definer set search_path=''
as $$
declare v_role text:='user'; v_campaign_id uuid; v_display_name text:='';
begin
 if new.email is not null and new.email_confirmed_at is not null and exists(select 1 from private.bootstrap_master_emails m where m.email=lower(btrim(new.email))) then v_role:='master_admin'; end if;
 v_display_name:=coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),nullif(btrim(new.raw_user_meta_data->>'full_name'),''),'');
 insert into public.profiles(id,email,display_name,role) values(new.id,lower(new.email),v_display_name,v_role)
 on conflict(id) do update set email=excluded.email,display_name=case when excluded.display_name<>'' then excluded.display_name else public.profiles.display_name end;
 if new.email is not null and new.email_confirmed_at is not null and exists(select 1 from private.bootstrap_master_emails m where m.email=lower(btrim(new.email))) then update public.profiles set role='master_admin' where id=new.id; end if;
 insert into public.campaigns(user_id) values(new.id) on conflict(user_id) do nothing returning id into v_campaign_id;
 if v_campaign_id is null then select c.id into v_campaign_id from public.campaigns c where c.user_id=new.id; end if;
 insert into public.phase_progress(campaign_id,user_id,phase_number,status,environment_state)
 select v_campaign_id,new.id,r.phase_number,case when r.phase_number=1 then 'available' else 'locked' end,case when r.phase_number=1 then 'degraded' else 'locked' end from public.game_regions r
 on conflict(campaign_id,phase_number) do nothing;
 return new;
end;
$$;
create table public.teams(id uuid primary key default gen_random_uuid(),owner_admin_id uuid not null unique references public.profiles(id) on delete restrict,team_name text not null check(char_length(team_name) between 1 and 100),invite_code uuid not null unique default gen_random_uuid(),is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.team_members(user_id uuid primary key references public.profiles(id) on delete cascade,team_id uuid not null references public.teams(id) on delete restrict,joined_at timestamptz not null default now(),invited_by uuid references public.profiles(id) on delete set null);
create index teams_active_owner_idx on public.teams(owner_admin_id) where is_active;
create index team_members_team_id_idx on public.team_members(team_id);
create or replace function private.is_team_owner(p_team_id uuid) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.teams t join public.profiles p on p.id=t.owner_admin_id where t.id=p_team_id and t.owner_admin_id=(select auth.uid()) and t.is_active and p.role='admin'); $$;
revoke all on function private.is_team_owner(uuid) from public,anon;
grant execute on function private.is_team_owner(uuid) to authenticated;
create or replace function private.is_team_user(p_user_id uuid) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.team_members tm join public.teams t on t.id=tm.team_id join public.profiles owner on owner.id=t.owner_admin_id where tm.user_id=p_user_id and t.owner_admin_id=(select auth.uid()) and t.is_active and owner.role='admin'); $$;
revoke all on function private.is_team_user(uuid) from public,anon;
grant execute on function private.is_team_user(uuid) to authenticated;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
revoke all on public.teams,public.team_members from anon,authenticated;
grant select on public.teams,public.team_members to authenticated;
create policy teams_select_scoped on public.teams for select to authenticated using(owner_admin_id=(select auth.uid()) or (select private.is_master()));
create policy team_members_select_scoped on public.team_members for select to authenticated using(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_owner(team_id)));
create or replace function private.get_team_invite(p_target_admin_id uuid) returns table(team_id uuid,team_name text,invite_code uuid) language plpgsql security definer set search_path=''
as $$
declare v_target_admin_id uuid:=coalesce(p_target_admin_id,(select auth.uid())); v_role text; v_name text;
begin
 if (select auth.uid()) is null then raise exception 'É necessário entrar na plataforma.' using errcode='42501'; end if;
 if v_target_admin_id<>(select auth.uid()) and not private.is_master() then raise exception 'Você só pode consultar o link da sua própria equipe.' using errcode='42501'; end if;
 select p.role,coalesce(nullif(btrim(p.display_name),''),nullif(split_part(p.email,'@',1),''),'Equipe GREEN CITY') into v_role,v_name from public.profiles p where p.id=v_target_admin_id;
 if not found or v_role<>'admin' then raise exception 'Administrador de equipe não encontrado ou inativo.' using errcode='P0002'; end if;
 insert into public.teams(owner_admin_id,team_name) values(v_target_admin_id,'Equipe de '||v_name) on conflict(owner_admin_id) do update set is_active=true,updated_at=now();
 return query select t.id,t.team_name,t.invite_code from public.teams t where t.owner_admin_id=v_target_admin_id and t.is_active;
end;
$$;
revoke all on function private.get_team_invite(uuid) from public,anon;
grant execute on function private.get_team_invite(uuid) to authenticated;
create or replace function private.rotate_team_invite(p_target_admin_id uuid) returns table(team_id uuid,team_name text,invite_code uuid) language plpgsql security definer set search_path=''
as $$
declare v_target_admin_id uuid:=coalesce(p_target_admin_id,(select auth.uid()));
begin
 perform * from private.get_team_invite(v_target_admin_id);
 update public.teams set invite_code=gen_random_uuid(),updated_at=now() where owner_admin_id=v_target_admin_id and is_active;
 return query select t.id,t.team_name,t.invite_code from public.teams t where t.owner_admin_id=v_target_admin_id and t.is_active;
end;
$$;
revoke all on function private.rotate_team_invite(uuid) from public,anon;
grant execute on function private.rotate_team_invite(uuid) to authenticated;
create or replace function private.join_team_with_invite(p_invite_code uuid) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=(select auth.uid()); v_role text; v_team_id uuid; v_team_name text; v_existing_team_id uuid;
begin
 if v_user_id is null then raise exception 'Entre na sua conta antes de aceitar o convite.' using errcode='42501'; end if;
 select p.role into v_role from public.profiles p where p.id=v_user_id;
 if not found or v_role<>'user' then raise exception 'Este link é destinado a contas de alunos e usuários.' using errcode='42501'; end if;
 select t.id,t.team_name into v_team_id,v_team_name from public.teams t where t.invite_code=p_invite_code and t.is_active limit 1;
 if v_team_id is null then raise exception 'Este link de equipe é inválido ou foi desativado.' using errcode='22023'; end if;
 select tm.team_id into v_existing_team_id from public.team_members tm where tm.user_id=v_user_id;
 if found and v_existing_team_id<>v_team_id then raise exception 'Esta conta já está vinculada a outra equipe. Procure o administrador da plataforma.' using errcode='42501'; end if;
 insert into public.team_members(user_id,team_id,invited_by) select v_user_id,v_team_id,t.owner_admin_id from public.teams t where t.id=v_team_id on conflict(user_id) do nothing;
 return jsonb_build_object('team_id',v_team_id,'team_name',v_team_name,'joined',true);
end;
$$;
revoke all on function private.join_team_with_invite(uuid) from public,anon;
grant execute on function private.join_team_with_invite(uuid) to authenticated;
create or replace function public.admin_get_team_invite(target_admin_id uuid default null) returns table(team_id uuid,team_name text,invite_code uuid) language sql set search_path='' as $$ select * from private.get_team_invite(target_admin_id); $$;
create or replace function public.admin_rotate_team_invite(target_admin_id uuid default null) returns table(team_id uuid,team_name text,invite_code uuid) language sql set search_path='' as $$ select * from private.rotate_team_invite(target_admin_id); $$;
create or replace function public.join_team_with_invite(invite_code uuid) returns jsonb language sql set search_path='' as $$ select private.join_team_with_invite(invite_code); $$;
revoke all on function public.admin_get_team_invite(uuid),public.admin_rotate_team_invite(uuid),public.join_team_with_invite(uuid) from public,anon;
grant execute on function public.admin_get_team_invite(uuid),public.admin_rotate_team_invite(uuid),public.join_team_with_invite(uuid) to authenticated;
drop policy if exists admin_audit_log_admin_read on public.admin_audit_log;
create policy admin_audit_log_master_read on public.admin_audit_log for select to authenticated using((select private.is_master()));
update public.profiles p set role='master_admin' where p.role='admin' and lower(btrim(p.email)) in(select email from private.bootstrap_master_emails);
