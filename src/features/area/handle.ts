export type HandleProfile = {
  username?: string | null;
  display_name?: string | null;
} | null;

/**
 * Public name for an area author. Matches the existing chat behaviour: the
 * profile display name first, then the generated ghost username.
 */
export function ghostHandle(profile: HandleProfile) {
  const handle = profile?.display_name?.trim() || profile?.username?.trim() || "Ghost";
  return handle.slice(0, 40) || "Ghost";
}
