import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is owner
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can disconnect Shopify stores" },
      { status: 403 }
    );
  }

  // Remove the Shopify connection
  const { error } = await supabase
    .from("shopify_settings")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to disconnect Shopify:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Shopify store" },
      { status: 500 }
    );
  }

  // Revalidate relevant pages
  revalidatePath("/settings", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/orders", "layout");

  return NextResponse.json({ success: true });
}
