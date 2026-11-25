-- GREEN CITY: Master-only role changes, clean team transfer, and audit trail.
create or replace function private.perform_admin_role_change(target_user_id uuid, new_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old_role text; v_team_name text;
begin
  if (select auth.uid()) is null or not private.is_master() then
    raise exception 'Apenas o Administrador Master pode alterar administradores.' using errcode = '42501';
  end if;
  if new_role not in ('admin', 'user') then
    raise exception 'Papel inválido. Use admin ou user.' using errcode = '22023';
  end if;
  select p.role, coalesce(nullif(btrim(p.display_name), ''), nullif(split_part(p.email, '@', 1), ''), 'Equipe GREEN CITY')
    into v_old_role, v_team_name
    from public.profiles p where p.id = target_user_id for update;
  if not found then raise exception 'Usuário não encontrado.' using errcode = 'P0002'; end if;
  if v_old_role = 'master_admin' then
    raise exception 'A conta Master é protegida e não pode ser rebaixada.' using errcode = '42501';
  end if;
  if v_old_role = new_role then return; end if;
  update public.profiles set role = new_role where id = target_user_id;
  if new_role = 'admin' then
    delete from public.team_members where user_id = target_user_id;
    insert into public.teams (owner_admin_id, team_name)
      values (target_user_id, 'Equipe de ' || v_team_name)
      on conflict (owner_admin_id) do update
        set team_name = excluded.team_name, is_active = true, updated_at = now();
  elsif new_role = 'user' then
    update public.teams set is_active = false, updated_at = now() where owner_admin_id = target_user_id;
  end if;
  insert into public.admin_audit_log (actor_user_id, target_user_id, old_role, new_role)
    values ((select auth.uid()), target_user_id, v_old_role, new_role);
end;
$$;
revoke all on function private.perform_admin_role_change(uuid, text) from public, anon;
grant execute on function private.perform_admin_role_change(uuid, text) to authenticated;
