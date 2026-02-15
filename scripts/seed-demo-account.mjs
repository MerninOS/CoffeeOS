#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo@coffeeos.io";
const DEMO_PASSWORD = "DemoCoffeeOS!2026";

function loadEnvFromFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function getOrCreateDemoUser(admin) {
  let userId = null;

  // Find existing auth user by email.
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const found = (data?.users || []).find(
      (user) => user.email?.toLowerCase() === DEMO_EMAIL.toLowerCase()
    );
    if (found) {
      userId = found.id;
      break;
    }

    if (!data?.nextPage) break;
    page = data.nextPage;
  }

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: "Demo",
        last_name: "User",
        role: "owner",
      },
      app_metadata: {
        provider: "email",
      },
    });

    if (error) {
      throw new Error(`Failed to create demo auth user: ${error.message}`);
    }

    userId = data.user?.id || null;
  }

  if (!userId) {
    throw new Error("Demo user id could not be resolved.");
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: "Demo",
      last_name: "User",
      role: "owner",
    },
  });
  if (updateError) {
    throw new Error(`Failed to update demo auth user: ${updateError.message}`);
  }

  return userId;
}

async function clearDemoData(admin, ownerId) {
  // Resolve dependent record ids first.
  const { data: sessions } = await admin
    .from("roasting_sessions")
    .select("id")
    .eq("user_id", ownerId);
  const sessionIds = (sessions || []).map((s) => s.id);

  const { data: products } = await admin
    .from("products")
    .select("id")
    .eq("user_id", ownerId);
  const productIds = (products || []).map((p) => p.id);

  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .eq("user_id", ownerId);
  const orderIds = (orders || []).map((o) => o.id);

  const { data: coffees } = await admin
    .from("green_coffee_inventory")
    .select("id")
    .eq("user_id", ownerId);
  const coffeeIds = (coffees || []).map((c) => c.id);

  const { data: roastRequests } = await admin
    .from("roast_requests")
    .select("id")
    .eq("user_id", ownerId);
  const roastRequestIds = (roastRequests || []).map((r) => r.id);

  if (orderIds.length > 0) {
    await admin.from("order_roasted_coffee").delete().in("order_id", orderIds);
    await admin.from("order_line_items").delete().in("order_id", orderIds);
  }

  if (sessionIds.length > 0) {
    const { data: batches } = await admin
      .from("roasting_batches")
      .select("id")
      .in("session_id", sessionIds);
    const batchIds = (batches || []).map((b) => b.id);
    if (batchIds.length > 0) {
      await admin.from("roast_request_fulfillments").delete().in("roasting_batch_id", batchIds);
      await admin.from("roasting_batches").delete().in("id", batchIds);
    }
    await admin.from("roasting_sessions").delete().in("id", sessionIds);
  }

  if (roastRequestIds.length > 0) {
    await admin.from("roast_request_fulfillments").delete().in("roast_request_id", roastRequestIds);
  }

  if (coffeeIds.length > 0) {
    await admin.from("coffee_inventory_changes").delete().in("coffee_id", coffeeIds);
    await admin.from("roast_requests").delete().in("green_coffee_id", coffeeIds);
    await admin.from("green_coffee_inventory").delete().in("id", coffeeIds);
  } else {
    await admin.from("roast_requests").delete().eq("user_id", ownerId);
  }

  if (productIds.length > 0) {
    await admin.from("product_components").delete().in("product_id", productIds);
    await admin.from("wholesale_price_tiers").delete().in("product_id", productIds);
    await admin.from("products").delete().in("id", productIds);
  }

  await admin.from("orders").delete().eq("user_id", ownerId);
  await admin.from("components").delete().eq("user_id", ownerId);
  await admin.from("shopify_settings").delete().eq("user_id", ownerId);
  await admin.from("roasting_settings").delete().eq("user_id", ownerId);
}

async function seedDemoData(admin, ownerId) {
  const today = new Date();
  const day = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: ownerId,
      email: DEMO_EMAIL,
      role: "owner",
      first_name: "Demo",
      last_name: "User",
      owner_id: null,
      full_name: "Demo User",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (profileError) {
    throw new Error(`Failed to upsert profile: ${profileError.message}`);
  }

  const { error: shopifyError } = await admin.from("shopify_settings").insert({
    user_id: ownerId,
    store_domain: "demo-coffeeos.myshopify.com",
    shop_name: "CoffeeOS Demo Roastery",
    connected_via_oauth: true,
    oauth_scope: "read_products,read_orders",
    oauth_connected_at: new Date().toISOString(),
    access_token: "demo-storefront-token",
    admin_access_token: "demo-admin-token",
  });
  if (shopifyError) {
    throw new Error(`Failed to insert Shopify settings: ${shopifyError.message}`);
  }

  const { error: roastingSettingsError } = await admin.from("roasting_settings").insert({
    user_id: ownerId,
    default_billing_granularity_minutes: 15,
    default_setup_minutes: 20,
    default_cleanup_minutes: 15,
    default_allocation_mode: "time_weighted",
    default_kwh_rate: 0.18,
  });
  if (roastingSettingsError) {
    throw new Error(`Failed to insert roasting settings: ${roastingSettingsError.message}`);
  }

  const { data: coffees, error: coffeeError } = await admin
    .from("green_coffee_inventory")
    .insert([
      {
        user_id: ownerId,
        name: "Ethiopia Yirgacheffe",
        origin: "Ethiopia",
        lot_code: "ETH-YIR-2026-01",
        price_per_lb: 6.8,
        initial_quantity_g: 22679.6,
        current_green_quantity_g: 15875,
        roasted_stock_g: 4100,
        supplier: "Royal Coffee",
        purchase_date: day(-21),
        notes: "Floral washed lot used in house single-origin program.",
      },
      {
        user_id: ownerId,
        name: "Guatemala Huehuetenango",
        origin: "Guatemala",
        lot_code: "GUA-HUE-2026-02",
        price_per_lb: 5.95,
        initial_quantity_g: 18143.7,
        current_green_quantity_g: 12200,
        roasted_stock_g: 2800,
        supplier: "Cafe Imports",
        purchase_date: day(-16),
        notes: "Chocolate-forward component for espresso blend.",
      },
    ])
    .select("id,name");
  if (coffeeError || !coffees || coffees.length < 2) {
    throw new Error(`Failed to insert green coffee inventory: ${coffeeError?.message || "unknown error"}`);
  }

  const ethCoffee = coffees.find((c) => c.name.includes("Ethiopia")) || coffees[0];
  const guaCoffee = coffees.find((c) => c.name.includes("Guatemala")) || coffees[1];

  const { data: components, error: componentsError } = await admin
    .from("components")
    .insert([
      {
        user_id: ownerId,
        name: "Roasted Coffee",
        type: "ingredient",
        unit: "g",
        cost_per_unit: 0.032,
        notes: "Average roasted coffee cost per gram across active lots.",
      },
      {
        user_id: ownerId,
        name: "12oz Valve Bag",
        type: "packaging",
        unit: "each",
        cost_per_unit: 0.42,
        notes: "Matte black stand-up pouch with degassing valve.",
      },
      {
        user_id: ownerId,
        name: "Label + Sticker Set",
        type: "packaging",
        unit: "each",
        cost_per_unit: 0.18,
      },
      {
        user_id: ownerId,
        name: "Roastery Labor",
        type: "labor",
        unit: "hour",
        cost_per_unit: 22,
      },
    ])
    .select("id,name");
  if (componentsError || !components || components.length < 4) {
    throw new Error(`Failed to insert components: ${componentsError?.message || "unknown error"}`);
  }

  const roastedCoffeeComponent = components.find((c) => c.name === "Roasted Coffee");
  const bagComponent = components.find((c) => c.name === "12oz Valve Bag");
  const labelComponent = components.find((c) => c.name === "Label + Sticker Set");
  const laborComponent = components.find((c) => c.name === "Roastery Labor");

  if (!roastedCoffeeComponent || !bagComponent || !labelComponent || !laborComponent) {
    throw new Error("Missing one or more inserted components.");
  }

  const { data: products, error: productsError } = await admin
    .from("products")
    .insert([
      {
        user_id: ownerId,
        shopify_id: "gid://shopify/Product/1000000001",
        title: "Yirgacheffe Light Roast 12oz",
        description: "Floral and citrus-forward single origin.",
        sku: "ETH-12-LIGHT",
        price: 18,
        variant_id: "gid://shopify/ProductVariant/10000000011",
      },
      {
        user_id: ownerId,
        shopify_id: "gid://shopify/Product/1000000002",
        title: "House Espresso Blend 2lb",
        description: "Chocolate and caramel with balanced acidity.",
        sku: "HOUSE-ESP-2LB",
        price: 42,
        variant_id: "gid://shopify/ProductVariant/10000000022",
      },
      {
        user_id: ownerId,
        shopify_id: "gid://shopify/Product/1000000003",
        title: "Cold Brew Blend 5lb",
        description: "Low-acid blend built for concentrate and kegs.",
        sku: "CB-5LB",
        price: 78,
        variant_id: "gid://shopify/ProductVariant/10000000033",
      },
    ])
    .select("id,title");
  if (productsError || !products || products.length < 3) {
    throw new Error(`Failed to insert products: ${productsError?.message || "unknown error"}`);
  }

  const yirgProduct = products.find((p) => p.title.includes("Yirgacheffe")) || products[0];
  const espressoProduct = products.find((p) => p.title.includes("Espresso")) || products[1];
  const coldBrewProduct = products.find((p) => p.title.includes("Cold Brew")) || products[2];

  const { error: productComponentsError } = await admin.from("product_components").insert([
    { product_id: yirgProduct.id, component_id: roastedCoffeeComponent.id, quantity: 340 },
    { product_id: yirgProduct.id, component_id: bagComponent.id, quantity: 1 },
    { product_id: yirgProduct.id, component_id: labelComponent.id, quantity: 1 },
    { product_id: yirgProduct.id, component_id: laborComponent.id, quantity: 0.03 },

    { product_id: espressoProduct.id, component_id: roastedCoffeeComponent.id, quantity: 900 },
    { product_id: espressoProduct.id, component_id: bagComponent.id, quantity: 2 },
    { product_id: espressoProduct.id, component_id: labelComponent.id, quantity: 2 },
    { product_id: espressoProduct.id, component_id: laborComponent.id, quantity: 0.06 },

    { product_id: coldBrewProduct.id, component_id: roastedCoffeeComponent.id, quantity: 2268 },
    { product_id: coldBrewProduct.id, component_id: labelComponent.id, quantity: 1 },
    { product_id: coldBrewProduct.id, component_id: laborComponent.id, quantity: 0.09 },
  ]);
  if (productComponentsError) {
    throw new Error(`Failed to insert product components: ${productComponentsError.message}`);
  }

  const { data: sessions, error: sessionsError } = await admin
    .from("roasting_sessions")
    .insert([
      {
        user_id: ownerId,
        vendor_name: "Loring S15 Falcon",
        rate_per_hour: 85,
        setup_minutes: 20,
        cleanup_minutes: 15,
        billing_granularity_minutes: 15,
        allocation_mode: "time_weighted",
        session_date: day(-4),
        notes: "Weekly production run.",
        billable_minutes: 210,
        session_toll_cost: 297.5,
      },
    ])
    .select("id");
  if (sessionsError || !sessions || sessions.length === 0) {
    throw new Error(`Failed to insert roasting sessions: ${sessionsError?.message || "unknown error"}`);
  }

  const sessionId = sessions[0].id;

  const { error: batchesError } = await admin.from("roasting_batches").insert([
    {
      session_id: sessionId,
      user_id: ownerId,
      coffee_name: "Ethiopia Yirgacheffe",
      lot_code: "ETH-YIR-2026-01",
      green_coffee_id: ethCoffee.id,
      price_basis: "per_lb",
      price_value: 6.8,
      green_weight_g: 5400,
      roasted_weight_g: 4540,
      rejects_g: 120,
      roast_minutes: 14,
      batch_date: day(-4),
      energy_kwh: 4.8,
      kwh_rate: 0.18,
      sellable_g: 4420,
      loss_percent: 15.93,
      green_cost_per_g: 0.014991,
      toll_cost_per_g: 0.0105,
      energy_cost_per_g: 0.000195,
      total_cost_per_g: 0.025686,
      batch_toll_allocated: 46.41,
      roasted_stock_remaining_g: 1800,
    },
    {
      session_id: sessionId,
      user_id: ownerId,
      coffee_name: "Guatemala Huehuetenango",
      lot_code: "GUA-HUE-2026-02",
      green_coffee_id: guaCoffee.id,
      price_basis: "per_lb",
      price_value: 5.95,
      green_weight_g: 5200,
      roasted_weight_g: 4420,
      rejects_g: 130,
      roast_minutes: 15,
      batch_date: day(-4),
      energy_kwh: 5.0,
      kwh_rate: 0.18,
      sellable_g: 4290,
      loss_percent: 17.5,
      green_cost_per_g: 0.013117,
      toll_cost_per_g: 0.0102,
      energy_cost_per_g: 0.00021,
      total_cost_per_g: 0.023527,
      batch_toll_allocated: 43.76,
      roasted_stock_remaining_g: 1500,
    },
  ]);
  if (batchesError) {
    throw new Error(`Failed to insert roasting batches: ${batchesError.message}`);
  }

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .insert([
      {
        user_id: ownerId,
        shopify_order_id: "gid://shopify/Order/2000000001",
        shopify_order_number: "1001",
        order_name: "#1001",
        created_at_shopify: new Date(Date.now() - 3 * 86400000).toISOString(),
        financial_status: "paid",
        fulfillment_status: "fulfilled",
        total_price: 114,
        subtotal_price: 108,
        total_tax: 6,
        currency: "USD",
        customer_email: "wholesale@rivercitycafe.com",
        customer_name: "River City Cafe",
      },
      {
        user_id: ownerId,
        shopify_order_id: "gid://shopify/Order/2000000002",
        shopify_order_number: "1002",
        order_name: "#1002",
        created_at_shopify: new Date(Date.now() - 1 * 86400000).toISOString(),
        financial_status: "paid",
        fulfillment_status: "partial",
        total_price: 78,
        subtotal_price: 72,
        total_tax: 6,
        currency: "USD",
        customer_email: "orders@sunrisehotel.com",
        customer_name: "Sunrise Hotel",
      },
    ])
    .select("id,order_name");
  if (ordersError || !orders || orders.length < 2) {
    throw new Error(`Failed to insert orders: ${ordersError?.message || "unknown error"}`);
  }

  const order1001 = orders.find((o) => o.order_name === "#1001") || orders[0];
  const order1002 = orders.find((o) => o.order_name === "#1002") || orders[1];

  const { error: lineItemError } = await admin.from("order_line_items").insert([
    {
      order_id: order1001.id,
      product_id: yirgProduct.id,
      shopify_line_item_id: "gid://shopify/LineItem/3000000001",
      shopify_product_id: "gid://shopify/Product/1000000001",
      shopify_variant_id: "gid://shopify/ProductVariant/10000000011",
      title: "Yirgacheffe Light Roast 12oz",
      quantity: 4,
      price: 18,
      total_price: 72,
      sku: "ETH-12-LIGHT",
    },
    {
      order_id: order1001.id,
      product_id: espressoProduct.id,
      shopify_line_item_id: "gid://shopify/LineItem/3000000002",
      shopify_product_id: "gid://shopify/Product/1000000002",
      shopify_variant_id: "gid://shopify/ProductVariant/10000000022",
      title: "House Espresso Blend 2lb",
      quantity: 1,
      price: 42,
      total_price: 42,
      sku: "HOUSE-ESP-2LB",
    },
    {
      order_id: order1002.id,
      product_id: coldBrewProduct.id,
      shopify_line_item_id: "gid://shopify/LineItem/3000000003",
      shopify_product_id: "gid://shopify/Product/1000000003",
      shopify_variant_id: "gid://shopify/ProductVariant/10000000033",
      title: "Cold Brew Blend 5lb",
      quantity: 1,
      price: 78,
      total_price: 78,
      sku: "CB-5LB",
    },
  ]);
  if (lineItemError) {
    throw new Error(`Failed to insert order line items: ${lineItemError.message}`);
  }

  const { error: roastRequestsError } = await admin.from("roast_requests").insert([
    {
      user_id: ownerId,
      order_id: order1002.id,
      green_coffee_id: guaCoffee.id,
      coffee_name: "Guatemala Huehuetenango",
      requested_roasted_g: 5000,
      fulfilled_roasted_g: 2000,
      status: "in_progress",
      priority: "high",
      due_date: day(3),
      notes: "Need additional roast for hotel reorder.",
    },
    {
      user_id: ownerId,
      order_id: null,
      green_coffee_id: ethCoffee.id,
      coffee_name: "Ethiopia Yirgacheffe",
      requested_roasted_g: 3200,
      fulfilled_roasted_g: 3200,
      status: "fulfilled",
      priority: "normal",
      due_date: day(-2),
      fulfilled_at: new Date(Date.now() - 86400000).toISOString(),
      notes: "Cafe weekly restock completed.",
    },
  ]);
  if (roastRequestsError) {
    throw new Error(`Failed to insert roast requests: ${roastRequestsError.message}`);
  }
}

async function main() {
  const projectRoot = process.cwd();
  loadEnvFromFile(path.join(projectRoot, ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Seeding demo account...");
  const demoUserId = await getOrCreateDemoUser(admin);
  await clearDemoData(admin, demoUserId);
  await seedDemoData(admin, demoUserId);

  console.log("Demo account is ready.");
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error("Failed to seed demo account.");
  console.error(error.message || error);
  process.exit(1);
});
