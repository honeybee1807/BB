type AdminRoleName = "owner" | "team_member";

/**
 * Two-factor rule (mirrors is_owner()/is_admin() in the database):
 * the owner always needs an aal2 session; a team member needs one once they
 * have enrolled a factor (nextLevel is then "aal2").
 */
export function needsTwoFactor(role: AdminRoleName, currentLevel: string | null, nextLevel: string | null): boolean {
  if (currentLevel === "aal2") return false;
  return role === "owner" || nextLevel === "aal2";
}
