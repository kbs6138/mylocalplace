-- Tighten client-facing privileges after the mlp_ schema is in place.
-- Discovery records are written only by the security-definer unlock RPC.
-- Client code can read its own discoveries but cannot forge them directly.

revoke all on public.mlp_profiles from anon, authenticated;
revoke all on public.mlp_mylocalplace from anon, authenticated;
revoke all on public.mlp_capsule_discoveries from anon, authenticated;
revoke all on public.mlp_capsule_reports from anon, authenticated;

drop policy if exists "mlp_discoveries_insert_owner" on public.mlp_capsule_discoveries;

grant select (
  id,
  nickname,
  avatar_url,
  energy,
  master_keys,
  is_pro,
  subscription_end,
  created_at,
  updated_at
) on public.mlp_profiles to authenticated;

grant update (
  nickname,
  avatar_url,
  updated_at
) on public.mlp_profiles to authenticated;

grant select (
  id,
  user_id,
  title,
  category,
  lat,
  lng,
  difficulty,
  access_limit,
  access_count,
  unlock_radius_meters,
  is_promoted,
  created_at,
  updated_at
) on public.mlp_mylocalplace to authenticated;

grant insert (
  user_id,
  title,
  hint,
  category,
  lat,
  lng,
  difficulty,
  access_limit
) on public.mlp_mylocalplace to authenticated;

grant update (
  title,
  hint,
  category,
  difficulty,
  access_limit,
  unlock_radius_meters,
  updated_at
) on public.mlp_mylocalplace to authenticated;

grant delete on public.mlp_mylocalplace to authenticated;

grant select (
  id,
  capsule_id,
  user_id,
  distance_meters,
  created_at
) on public.mlp_capsule_discoveries to authenticated;

grant select (
  id,
  capsule_id,
  user_id,
  reason,
  detail,
  status,
  created_at
) on public.mlp_capsule_reports to authenticated;

grant insert (
  capsule_id,
  user_id,
  reason,
  detail
) on public.mlp_capsule_reports to authenticated;

grant execute on function public.mlp_verify_and_unlock(double precision, double precision, bigint) to authenticated;
grant usage, select on all sequences in schema public to authenticated;
