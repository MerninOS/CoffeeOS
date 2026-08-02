/**
 * The prop shapes /settings passes around, lifted verbatim out of
 * settings-client.tsx and team-management.tsx during the CoffeeOS#74 extraction.
 *
 * Deliberately unchanged in Stage A. The whole proof that the extraction was
 * behaviour-preserving is that no pixel moved, and a "while I'm here" narrowing
 * of an optional field is exactly the kind of edit that turns a provable
 * refactor into an unprovable one. `has_storefront_token` is dead — selected in
 * page.tsx and never read — but it is deleted in Stage B, not here.
 */

export interface SettingsUser {
  email: string;
  firstName: string;
  lastName: string;
}

export interface ShopifySettings {
  store_domain: string;
  shop_name?: string;
  connected_via_oauth?: boolean;
  oauth_scope?: string;
  has_storefront_token?: boolean;
  has_admin_credentials?: boolean;
  billing_status?: string | null;
  billing_plan_name?: string | null;
  billing_current_period_end?: string | null;
  billing_test?: boolean | null;
}

export interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export type SettingsMessage = { type: "success" | "error"; text: string } | null;
