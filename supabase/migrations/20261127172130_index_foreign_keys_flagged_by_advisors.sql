-- Performance indexes for foreign keys flagged by Supabase advisors.
create index if not exists phase_module_configs_updated_by_idx on public.phase_module_configs(updated_by) where updated_by is not null;
create index if not exists team_members_invited_by_idx on public.team_members(invited_by) where invited_by is not null;
