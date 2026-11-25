-- GREEN CITY: a student may share only the invitation for their currently assigned team.
create or replace function private.get_my_team_invite()
returns table(team_id uuid, team_name text, invite_code uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_team_id uuid;
  v_team_name text;
  v_invite_code uuid;
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para compartilhar o convite da equipe.' using errcode = '42501';
  end if;
  select p.role into v_role from public.profiles p where p.id = v_user_id;
  if not found or v_role <> 'user' then
    raise exception 'Este recurso é destinado a alunos vinculados a uma equipe.' using errcode = '42501';
  end if;
  select t.id, t.team_name, t.invite_code
    into v_team_id, v_team_name, v_invite_code
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  join public.profiles owner on owner.id = t.owner_admin_id
  where tm.user_id = v_user_id and t.is_active and owner.role = 'admin'
  limit 1;
  if v_team_id is null then
    raise exception 'Esta conta ainda não está vinculada a uma equipe.' using errcode = 'P0002';
  end if;
  return query select v_team_id, v_team_name, v_invite_code;
end;
$$;
create or replace function public.get_my_team_invite()
returns table(team_id uuid, team_name text, invite_code uuid)
language sql
set search_path = ''
as $$ select * from private.get_my_team_invite(); $$;
grant execute on function private.get_my_team_invite() to authenticated;
revoke all on function public.get_my_team_invite() from public, anon;
grant execute on function public.get_my_team_invite() to authenticated;
