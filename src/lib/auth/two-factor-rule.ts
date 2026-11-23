type AdminRoleName = "owner" | "team_member";

// Mirrors is_owner() and is_admin() in the database.
export function needsTwoFactor(role: AdminRoleName, currentLevel: string | null, nextLevel: string | null): boolean {
  if (currentLevel === "aal2") return false;
  return role === "owner" || nextLevel === "aal2";
}
