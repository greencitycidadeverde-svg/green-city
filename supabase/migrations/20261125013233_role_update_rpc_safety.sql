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
