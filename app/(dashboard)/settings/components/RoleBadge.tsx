import { Badge } from "@merninos/ui/instrument";

/**
 * A member's role as a pill.
 *
 * Replaces the two near-duplicate RolePills the loud page carried — one in
 * team-management.tsx with three tones, one in invitation-banner.tsx with two.
 *
 * Owner is outlined rather than filled: it is not a state anyone can change, so
 * it should not read as an interactive chip beside the roles that are.
 *
 * No brand tone. On this page red is the live register and belongs to the
 * blocked workspace state — a red role pill would compete with the one thing
 * that means "this needs you".
 */
export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge
      tone={role === "admin" ? "info" : "neutral"}
      variant={role === "owner" ? "outline" : "soft"}
    >
      {role}
    </Badge>
  );
}
