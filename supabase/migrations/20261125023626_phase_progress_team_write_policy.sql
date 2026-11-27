-- GREEN CITY: team administrator visibility for campaign, profile and phase records.
create or replace function private.is_team_user(p_user_id uuid) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.team_members tm join public.teams t on t.id=tm.team_id join public.profiles owner on owner.id=t.owner_admin_id where tm.user_id=p_user_id and t.owner_admin_id=(select auth.uid()) and t.is_active and owner.role='admin'); $$;
revoke all on function private.is_team_user(uuid) from public,anon;
grant execute on function private.is_team_user(uuid) to authenticated;
drop policy if exists profiles_select_owner_or_admin on public.profiles;
drop policy if exists profiles_select_scoped on public.profiles;
create policy profiles_select_scoped on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(id)));
drop policy if exists campaigns_select_owner_or_admin on public.campaigns;
drop policy if exists campaigns_update_owner_or_admin on public.campaigns;
drop policy if exists campaigns_select_scoped on public.campaigns;
drop policy if exists campaigns_update_scoped on public.campaigns;
create policy campaigns_select_scoped on public.campaigns for select to authenticated using(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id)));
create policy campaigns_update_scoped on public.campaigns for update to authenticated using(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id))) with check(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id)));
drop policy if exists phase_progress_owner_or_admin on public.phase_progress;
drop policy if exists phase_progress_scoped on public.phase_progress;
create policy phase_progress_scoped on public.phase_progress for all to authenticated using(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id))) with check(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id)));
drop policy if exists objective_progress_owner_or_admin on public.objective_progress;
drop policy if exists objective_progress_scoped on public.objective_progress;
create policy objective_progress_scoped on public.objective_progress for all to authenticated using(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id))) with check(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id)));
drop policy if exists learning_journal_owner_or_admin on public.learning_journal;
drop policy if exists learning_journal_scoped on public.learning_journal;
create policy learning_journal_scoped on public.learning_journal for all to authenticated using(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id))) with check(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id)));
drop policy if exists progress_events_owner_or_admin on public.progress_events;
drop policy if exists progress_events_scoped on public.progress_events;
create policy progress_events_scoped on public.progress_events for all to authenticated using(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id))) with check(user_id=(select auth.uid()) or (select private.is_master()) or (select private.is_team_user(user_id)));
