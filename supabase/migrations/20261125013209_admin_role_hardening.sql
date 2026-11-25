-- Remove the public SECURITY DEFINER role RPC and add audit/index support.
drop function if exists public.admin_set_user_role(uuid, text);
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
