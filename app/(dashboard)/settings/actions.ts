"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveStorefrontSettings(data: {
  storeDomain: string;
  accessToken: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Check if user is owner
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") {
    return { error: "Only owners can update Shopify settings" };
  }

  // Validate store domain format
  const domainRegex = /^[a-zA-Z0-9-]+\.myshopify\.com$/;
  if (!domainRegex.test(data.storeDomain)) {
    return {
      error:
        "Invalid store domain. Please use the format: your-store.myshopify.com",
    };
  }

  // Test the Storefront API connection
  const apiEndpoint = `https://${data.storeDomain}/api/2024-10/graphql.json`;
  
  try {
    // Try with private token header first (from Headless channel)
    let response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Shopify-Storefront-Private-Token": data.accessToken,
      },
      body: JSON.stringify({
        query: `{ products(first: 1) { edges { node { id } } } }`,
      }),
    });

    let result = await response.json();
    
    // If private token fails (unauthorized error), try public token
    if (result.errors?.some((e: { extensions?: { code?: string } }) => 
      e.extensions?.code === "UNAUTHORIZED" || e.extensions?.code === "ACCESS_DENIED"
    )) {
      response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": data.accessToken,
        },
        body: JSON.stringify({
          query: `{ products(first: 1) { edges { node { id } } } }`,
        }),
      });
      result = await response.json();
    }

    // Check for authentication errors specifically
    const hasAuthError = result.errors?.some((e: { extensions?: { code?: string } }) => 
      e.extensions?.code === "UNAUTHORIZED" || e.extensions?.code === "ACCESS_DENIED"
    );

    if (hasAuthError) {
      return { error: "Invalid Storefront API credentials. Please check your access token." };
    }
  } catch {
    return { error: "Failed to connect to Shopify. Please check your store domain." };
  }

  // Get existing settings to preserve admin token if set
  const { data: existingSettings } = await supabase
    .from("shopify_settings")
    .select("admin_access_token")
    .eq("user_id", user.id)
    .maybeSingle();

  // Build settings object
  const settingsData: Record<string, unknown> = {
    user_id: user.id,
    store_domain: data.storeDomain,
    access_token: data.accessToken,
  };

  // Preserve existing admin token if it exists
  if (existingSettings?.admin_access_token) {
    settingsData.admin_access_token = existingSettings.admin_access_token;
  }

  // Upsert settings
  const { error } = await supabase.from("shopify_settings").upsert(
    settingsData,
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings", "max");
  revalidatePath("/products", "max");

  return { success: true };
}

export async function saveAdminApiSettings(data: {
  adminAccessToken: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Check if user is owner
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") {
    return { error: "Only owners can update Shopify settings" };
  }

  // Get store domain from existing settings
  const { data: existingSettings } = await supabase
    .from("shopify_settings")
    .select("store_domain")
    .eq("user_id", user.id)
    .single();

  if (!existingSettings?.store_domain) {
    return { error: "Please configure your Storefront API settings first to set your store domain." };
  }

  const storeDomain = existingSettings.store_domain;

  // Test the Admin API token with a simple query
  try {
    const testResponse = await fetch(
      `https://${storeDomain}/admin/api/2024-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": data.adminAccessToken,
        },
        body: JSON.stringify({
          query: `{ shop { name } }`,
        }),
      }
    );

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      if (testResponse.status === 401) {
        return { error: "Invalid Admin API token. Please make sure you copied the full token that starts with 'shpat_'." };
      }
      if (testResponse.status === 403) {
        return { error: "Access denied. Please make sure the app has 'read_orders' scope enabled." };
      }
      return { error: `Shopify API error (${testResponse.status}): ${errorText.substring(0, 100)}` };
    }

    const testResult = await testResponse.json();

    if (testResult.errors) {
      return { error: `Admin API error: ${testResult.errors[0]?.message || "Unknown error"}` };
    }
  } catch (err) {
    console.error("Admin API connection error:", err);
    return { error: `Failed to connect: ${err instanceof Error ? err.message : "Unknown error"}` };
  }

  // Save the admin token
  const { error } = await supabase
    .from("shopify_settings")
    .update({ 
      admin_access_token: data.adminAccessToken,
    })
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings", "max");
  revalidatePath("/orders", "max");

  return { success: true };
}

// Get a valid Admin API token for use in other parts of the app
export async function getValidAdminToken(): Promise<{
  accessToken?: string;
  storeDomain?: string;
  ownerId?: string;
  error?: string;
}> {
  const { getEffectiveOwnerId } = await import("@/lib/team");
  const supabase = await createClient();

  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { data: settings } = await supabase
    .from("shopify_settings")
    .select("store_domain, admin_access_token")
    .eq("user_id", ownerId)
    .single();

  if (!settings?.admin_access_token) {
    return { error: "Shopify not connected. Please connect your Shopify store in Settings." };
  }

  return { 
    accessToken: settings.admin_access_token,
    storeDomain: settings.store_domain,
    ownerId,
  };
}

// Keep the old function for backwards compatibility but redirect to new ones
export async function saveShopifySettings(data: {
  storeDomain: string;
  accessToken: string;
  adminAccessToken?: string;
}) {
  // Just use the storefront settings function
  return saveStorefrontSettings({
    storeDomain: data.storeDomain,
    accessToken: data.accessToken,
  });
}

export async function inviteUser(email: string, role: "employee" | "owner") {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Check if user is owner
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") {
    return { error: "Only owners can invite users" };
  }

  // For now, just return a message about the invite process
  return {
    success: true,
    message: `Invitation would be sent to ${email} as ${role}. Note: User invitation requires Supabase Admin API configuration.`,
  };
}

export async function updateProfile(data: { firstName: string; lastName: string }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: data.firstName,
      last_name: data.lastName,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  // Also update user metadata
  await supabase.auth.updateUser({
    data: {
      first_name: data.firstName,
      last_name: data.lastName,
    },
  });

  revalidatePath("/settings", "max");
  revalidatePath("/dashboard", "max");

  return { success: true };
}
