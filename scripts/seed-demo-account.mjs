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
    // product_variants cascades to product_variant_components, and products
    // cascades to product_variants — but deleting explicitly keeps the teardown
    // readable and independent of whether a given environment has the 021
    // constraints applied.
    await admin.from("product_variants").delete().in("product_id", productIds);
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

  // shopify_id is the NUMERIC TAIL, not the full gid://shopify/Product/… GID.
  //
  // That is what syncShopifyProducts writes — it stores parseShopifyGid(id) —
  // and what the orders sync looks products up by. This fixture used to store
  // full GIDs, which matched nothing the app actually produces: on production
  // 95 of 95 synced rows are numeric tails, and the only full-GID rows in the
  // database were the seven this seed had written.
  //
  // It went unnoticed because the seed links order_line_items by product_id
  // directly, never exercising the shopify_id lookup. The sync review flow is
  // the first thing that does, and against the old fixture every seeded product
  // classified as "new" — a silent, total misclassification.
  //
  // product_variants.shopify_variant_id below is a DIFFERENT case: the sync
  // stores those unparsed, so full GIDs there are correct.
  const { data: products, error: productsError } = await admin
    .from("products")
    .insert([
      {
        user_id: ownerId,
        shopify_id: "1000000001",
        shopify_handle: "yirgacheffe-light-roast-12oz",
        title: "Yirgacheffe Light Roast 12oz",
        description: "Floral and citrus-forward single origin.",
        sku: "ETH-12-LIGHT",
        price: 18,
        variant_id: "gid://shopify/ProductVariant/10000000011",
      },
      {
        user_id: ownerId,
        shopify_id: "1000000002",
        shopify_handle: "house-espresso-blend-2lb",
        title: "House Espresso Blend 2lb",
        description: "Chocolate and caramel with balanced acidity.",
        sku: "HOUSE-ESP-2LB",
        price: 42,
        variant_id: "gid://shopify/ProductVariant/10000000022",
      },
      {
        user_id: ownerId,
        shopify_id: "1000000003",
        shopify_handle: "cold-brew-blend-5lb",
        title: "Cold Brew Blend 5lb",
        description: "Low-acid blend built for concentrate and kegs.",
        sku: "CB-5LB",
        price: 78,
        variant_id: "gid://shopify/ProductVariant/10000000033",
      },
      // Deliberately gets NO product_components below — a product nobody has
      // written a recipe for yet.
      //
      // This is not an edge case, it is the normal state of a real account:
      // Shopify syncs products and orders but has no concept of a bill of
      // materials, so a recipe is data only the roaster can supply. On the
      // production account 101 of 119 products look like this one.
      //
      // Without it the fixture had no order carrying a line item whose product
      // is uncosted, so nothing could tell "$0.00" apart from a real zero — the
      // exact defect orders-uncosted.spec.ts exists to catch.
      {
        user_id: ownerId,
        shopify_id: "1000000004",
        shopify_handle: "guatemala-huehuetenango-12oz",
        title: "Guatemala Huehuetenango 12oz",
        description: "Synced from Shopify, not yet costed.",
        sku: "GTM-12-HUEHUE",
        price: 22,
        variant_id: "gid://shopify/ProductVariant/10000000044",
      },
      // ── The variant-costed products (CoffeeOS#69) ──────────────────────────
      //
      // Until these existed, this fixture had NO product_variants at all, so the
      // entire variant costing path was unreachable by any test. That is how
      // CoffeeOS#85 reached production: variant-costed products were read as
      // uncosted and dropped from margin — on the production account that took
      // covered revenue to $0.00 of $261.80 over 30 days — and no fixture could
      // reproduce it.
      //
      // The three below, plus the variants added to House Espresso, give the
      // fixture all four cost bases. Spec Criteria 7 and 8 assert against a
      // fixture containing every one of them, and are vacuous without.
      {
        user_id: ownerId,
        shopify_id: "1000000005",
        shopify_handle: "kenya-nyeri-aa",
        title: "Kenya Nyeri AA",
        description: "Costed per variant, and the variants agree.",
        sku: "KEN-NYERI",
        price: 24,
      },
      {
        user_id: ownerId,
        shopify_id: "1000000006",
        shopify_handle: "sumatra-mandheling",
        title: "Sumatra Mandheling",
        description: "Variants disagree on cost — deliberately unknowable.",
        sku: "SUM-MAND",
        price: 20,
      },
      {
        user_id: ownerId,
        shopify_id: "1000000007",
        shopify_handle: "costa-rica-tarrazu",
        title: "Costa Rica Tarrazu",
        description: "One variant costed, one with no recipe at all.",
        sku: "CRI-TARRAZU",
        price: 21,
      },
    ])
    .select("id,title");
  if (productsError || !products || products.length < 7) {
    throw new Error(`Failed to insert products: ${productsError?.message || "unknown error"}`);
  }

  const yirgProduct = products.find((p) => p.title.includes("Yirgacheffe")) || products[0];
  const espressoProduct = products.find((p) => p.title.includes("Espresso")) || products[1];
  const coldBrewProduct = products.find((p) => p.title.includes("Cold Brew")) || products[2];
  const uncostedProduct = products.find((p) => p.title.includes("Huehuetenango")) || products[3];

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

  // ── Variant-level recipes (CoffeeOS#69) ────────────────────────────────────
  //
  // The rule these exercise lives in lib/products/costing.ts and is stricter
  // than "product recipe wins": a variant-level figure only counts as KNOWN when
  // every variant is costed and all of them agree. Anything else stays uncosted
  // rather than guessing, because order_line_items.shopify_variant_id is null
  // for 432 of 436 rows on production — a line item cannot be matched to the
  // variant that actually sold, so a cost that depends on which one sold is not
  // knowable.
  //
  // The four bases after this block:
  //
  //   product   Yirgacheffe, Cold Brew    product rows only
  //   variant   Kenya, Sumatra, Costa Rica variant rows only
  //   both      House Espresso             product rows AND variant rows
  //   none      Guatemala Huehuetenango    neither
  //
  // ...and within `variant`, the three outcomes that matter:
  //
  //   Kenya       two variants, identical cost   -> COSTED at that cost
  //   Sumatra     two variants, different costs  -> UNCOSTED (they disagree)
  //   Costa Rica  one costed, one with no rows   -> UNCOSTED (one empty poisons)
  const kenyaProduct = products.find((p) => p.title.includes("Kenya"));
  const sumatraProduct = products.find((p) => p.title.includes("Sumatra"));
  const costaRicaProduct = products.find((p) => p.title.includes("Costa Rica"));
  if (!kenyaProduct || !sumatraProduct || !costaRicaProduct) {
    throw new Error("Missing one or more variant-costed products.");
  }

  const { data: variants, error: variantsError } = await admin
    .from("product_variants")
    .insert([
      // Agreeing pair — same components, same quantities, so one knowable cost.
      { product_id: kenyaProduct.id, user_id: ownerId, title: "12oz", sku: "KEN-NYERI-12", price: 24, shopify_variant_id: "gid://shopify/ProductVariant/10000000051" },
      { product_id: kenyaProduct.id, user_id: ownerId, title: "12oz Decaf", sku: "KEN-NYERI-12-DECAF", price: 26, shopify_variant_id: "gid://shopify/ProductVariant/10000000052" },

      // Disagreeing pair — a 12oz and a 2lb cannot cost the same, and nothing
      // records which one an order sold.
      { product_id: sumatraProduct.id, user_id: ownerId, title: "12oz", sku: "SUM-MAND-12", price: 20, shopify_variant_id: "gid://shopify/ProductVariant/10000000061" },
      { product_id: sumatraProduct.id, user_id: ownerId, title: "2lb", sku: "SUM-MAND-2LB", price: 46, shopify_variant_id: "gid://shopify/ProductVariant/10000000062" },

      // One costed, one deliberately left with no rows.
      { product_id: costaRicaProduct.id, user_id: ownerId, title: "12oz", sku: "CRI-TARRAZU-12", price: 21, shopify_variant_id: "gid://shopify/ProductVariant/10000000071" },
      { product_id: costaRicaProduct.id, user_id: ownerId, title: "Sample 4oz", sku: "CRI-TARRAZU-4OZ", price: 8, shopify_variant_id: "gid://shopify/ProductVariant/10000000072" },

      // `both`: House Espresso already has a PRODUCT-level recipe above. Adding
      // a variant recipe must NOT change what it costs — product level wins —
      // which is exactly what makes the 023 migration's backfill provably
      // figure-preserving for this case.
      { product_id: espressoProduct.id, user_id: ownerId, title: "2lb Whole Bean", sku: "HOUSE-ESP-2LB-WB", price: 42, shopify_variant_id: "gid://shopify/ProductVariant/10000000081" },
    ])
    .select("id,title,sku");
  if (variantsError || !variants || variants.length < 7) {
    throw new Error(`Failed to insert product variants: ${variantsError?.message || "unknown error"}`);
  }

  const variantBySku = Object.fromEntries(variants.map((v) => [v.sku, v.id]));
  const needVariant = (sku) => {
    const id = variantBySku[sku];
    if (!id) throw new Error(`Missing seeded variant ${sku}`);
    return id;
  };

  const { error: variantComponentsError } = await admin
    .from("product_variant_components")
    .insert([
      // Kenya — identical recipes, so the two agree to the cent.
      { product_variant_id: needVariant("KEN-NYERI-12"), component_id: roastedCoffeeComponent.id, quantity: 340 },
      { product_variant_id: needVariant("KEN-NYERI-12"), component_id: bagComponent.id, quantity: 1 },
      { product_variant_id: needVariant("KEN-NYERI-12"), component_id: labelComponent.id, quantity: 1 },
      { product_variant_id: needVariant("KEN-NYERI-12-DECAF"), component_id: roastedCoffeeComponent.id, quantity: 340 },
      { product_variant_id: needVariant("KEN-NYERI-12-DECAF"), component_id: bagComponent.id, quantity: 1 },
      { product_variant_id: needVariant("KEN-NYERI-12-DECAF"), component_id: labelComponent.id, quantity: 1 },

      // Sumatra — a 12oz and a 2lb, so the costs differ by design.
      { product_variant_id: needVariant("SUM-MAND-12"), component_id: roastedCoffeeComponent.id, quantity: 340 },
      { product_variant_id: needVariant("SUM-MAND-12"), component_id: bagComponent.id, quantity: 1 },
      { product_variant_id: needVariant("SUM-MAND-2LB"), component_id: roastedCoffeeComponent.id, quantity: 900 },
      { product_variant_id: needVariant("SUM-MAND-2LB"), component_id: bagComponent.id, quantity: 2 },

      // Costa Rica — only the 12oz is costed. CRI-TARRAZU-4OZ gets nothing, on
      // purpose: one empty variant makes the whole product unknowable.
      { product_variant_id: needVariant("CRI-TARRAZU-12"), component_id: roastedCoffeeComponent.id, quantity: 340 },
      { product_variant_id: needVariant("CRI-TARRAZU-12"), component_id: bagComponent.id, quantity: 1 },

      // House Espresso — the ignored basis. Priced differently from its
      // product-level recipe so a test can PROVE which one is billed.
      { product_variant_id: needVariant("HOUSE-ESP-2LB-WB"), component_id: roastedCoffeeComponent.id, quantity: 950 },
      { product_variant_id: needVariant("HOUSE-ESP-2LB-WB"), component_id: bagComponent.id, quantity: 3 },
    ]);
  if (variantComponentsError) {
    throw new Error(`Failed to insert variant components: ${variantComponentsError.message}`);
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
      // Orders #1003-#1005 exist so list-view assertions are meaningful: a
      // "no zebra striping" check passes trivially against 1-2 rows, and the
      // status filters need more than one value to exercise. Statuses are
      // deliberately spread across paid/pending and fulfilled/unfulfilled.
      {
        user_id: ownerId,
        shopify_order_id: "gid://shopify/Order/2000000003",
        shopify_order_number: "1003",
        order_name: "#1003",
        created_at_shopify: new Date(Date.now() - 20 * 86400000).toISOString(),
        financial_status: "pending",
        fulfillment_status: null,
        total_price: 246,
        subtotal_price: 232,
        total_tax: 14,
        currency: "USD",
        customer_email: "buyer@northpierroasters.com",
        customer_name: "North Pier Roasters",
      },
      {
        user_id: ownerId,
        shopify_order_id: "gid://shopify/Order/2000000004",
        shopify_order_number: "1004",
        order_name: "#1004",
        created_at_shopify: new Date(Date.now() - 75 * 86400000).toISOString(),
        financial_status: "paid",
        fulfillment_status: "fulfilled",
        total_price: 54,
        subtotal_price: 51,
        total_tax: 3,
        currency: "USD",
        customer_email: "aya.tanaka@example.com",
        customer_name: "Aya Tanaka",
      },
      {
        user_id: ownerId,
        shopify_order_id: "gid://shopify/Order/2000000005",
        shopify_order_number: "1005",
        order_name: "#1005",
        created_at_shopify: new Date(Date.now() - 200 * 86400000).toISOString(),
        financial_status: "refunded",
        fulfillment_status: null,
        total_price: 96,
        subtotal_price: 90,
        total_tax: 6,
        currency: "USD",
        customer_email: "halden@haldencoffeebar.com",
        customer_name: "Halden Coffee Bar",
      },
      // ── Exclusion fixtures (CoffeeOS#79) ──────────────────────────────────
      //
      // Inside the 30-day default window on purpose: a fixture the default view
      // cannot reach gets verified by nobody.
      //
      // The uncosted PRODUCT these lean on (Guatemala Huehuetenango 12oz) comes
      // from CoffeeOS#68 and is already above — not duplicated here.
      {
        // MIXED — one costed line item beside one uncosted. The only case where
        // "any line item resolves to $0" differs from "total COGS is $0": the
        // total is non-zero, so the predicate CoffeeOS#79 replaced passed it
        // unflagged while it reported a margin built partly on a fabricated $0.
        user_id: ownerId,
        shopify_order_id: "gid://shopify/Order/2000000007",
        shopify_order_number: "1006",
        order_name: "#1006",
        created_at_shopify: new Date(Date.now() - 5 * 86400000).toISOString(),
        financial_status: "paid",
        fulfillment_status: "fulfilled",
        total_price: 43,
        subtotal_price: 40,
        total_tax: 3,
        currency: "USD",
        customer_email: "mixed@example.com",
        customer_name: "Bellwether Coffee",
      },
      {
        // UNLINKED with a named line item — product_id null, the state 328 of 436
        // production line items are in. Distinct from #1004/#1005/#0902, which
        // are also unlinked but have no item to name and render different copy.
        user_id: ownerId,
        shopify_order_id: "gid://shopify/Order/2000000008",
        shopify_order_number: "1007",
        order_name: "#1007",
        created_at_shopify: new Date(Date.now() - 9 * 86400000).toISOString(),
        financial_status: "paid",
        fulfillment_status: "fulfilled",
        total_price: 31,
        subtotal_price: 29,
        total_tax: 2,
        currency: "USD",
        customer_email: "discontinued@example.com",
        customer_name: "Harbourline Cafe",
      },
      // Deliberately older than the longest period preset (365d). Without an
      // out-of-range order, "1 year" is indistinguishable from "everything" and
      // the bounded-query tests cannot prove a filter is applied at all.
      {
        user_id: ownerId,
        shopify_order_id: "gid://shopify/Order/2000000006",
        shopify_order_number: "0902",
        order_name: "#0902",
        created_at_shopify: new Date(Date.now() - 500 * 86400000).toISOString(),
        financial_status: "paid",
        fulfillment_status: "fulfilled",
        total_price: 132,
        subtotal_price: 124,
        total_tax: 8,
        currency: "USD",
        customer_email: "archive@oldportcoffee.com",
        customer_name: "Old Port Coffee",
      },
    ])
    .select("id,order_name");
  // >= 5 so visual-baseline assertions over the orders table are not vacuous.
  if (ordersError || !orders || orders.length < 8) {
    throw new Error(`Failed to insert orders: ${ordersError?.message || "unknown error"}`);
  }

  const order1001 = orders.find((o) => o.order_name === "#1001") || orders[0];
  const order1002 = orders.find((o) => o.order_name === "#1002") || orders[1];
  const order1006 = orders.find((o) => o.order_name === "#1006");
  const order1007 = orders.find((o) => o.order_name === "#1007");
  if (!order1006 || !order1007) {
    throw new Error("Missing an exclusion fixture order (#1006/#1007).");
  }
  const order1003 = orders.find((o) => o.order_name === "#1003") || orders[2];

  const { error: lineItemError } = await admin.from("order_line_items").insert([
    // #1003 sells the uncosted product. It was already the fixture's "missing
    // COGS" order, but it had no line items at all, so it was uncosted for the
    // trivial reason that there was nothing to cost. That is not the case worth
    // testing — the real one is a genuine sale of a product whose recipe has
    // never been entered, where the page must say "not set" rather than "$0.00"
    // and margin must read 100% for a reason the operator can see and fix.
    {
      order_id: order1003.id,
      product_id: uncostedProduct.id,
      shopify_line_item_id: "gid://shopify/LineItem/3000000004",
      shopify_product_id: "gid://shopify/Product/1000000004",
      shopify_variant_id: "gid://shopify/ProductVariant/10000000044",
      title: "Guatemala Huehuetenango 12oz",
      quantity: 2,
      price: 22,
      total_price: 44,
      sku: "GTM-12-HUEHUE",
    },
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

    // ── Exclusion fixtures (CoffeeOS#79) ────────────────────────────────────
    {
      order_id: order1006.id,
      product_id: yirgProduct.id,
      shopify_line_item_id: "gid://shopify/LineItem/3000000005",
      shopify_product_id: "gid://shopify/Product/1000000001",
      shopify_variant_id: "gid://shopify/ProductVariant/10000000011",
      title: "Yirgacheffe Light Roast 12oz",
      quantity: 1, price: 18, total_price: 18, sku: "ETH-12-LIGHT",
    },
    {
      order_id: order1006.id,
      product_id: uncostedProduct.id,
      shopify_line_item_id: "gid://shopify/LineItem/3000000006",
      shopify_product_id: "gid://shopify/Product/1000000004",
      shopify_variant_id: "gid://shopify/ProductVariant/10000000044",
      title: "Guatemala Huehuetenango 12oz",
      quantity: 1, price: 22, total_price: 22, sku: "GTM-12-HUEHUE",
    },
    {
      // `shopify_product_id` is retained deliberately: Shopify keeps returning it
      // for a while after a product is deleted, and 197 of the 328 unlinked
      // production line items look exactly like this.
      order_id: order1007.id,
      product_id: null,
      shopify_line_item_id: "gid://shopify/LineItem/3000000007",
      shopify_product_id: "gid://shopify/Product/1999999999",
      shopify_variant_id: null,
      title: "Sunrise Blend (discontinued)",
      quantity: 1, price: 29, total_price: 29, sku: "SUNRISE-12",
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
  await writeOrderIdFixture(admin, demoUserId);

  console.log("Demo account is ready.");
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
}

/**
 * Emit order_name -> id so detail-route specs can navigate straight to
 * /orders/<id>.
 *
 * They cannot get there through the list. `playwright.config.ts` pins
 * ORDERS_PAGE_LIMIT to 3 on purpose — /orders' criterion 5 can only detect its
 * pagination bug when the limit is BINDING — so the list permanently shows the
 * newest three orders and nothing else. The states a detail-route baseline most
 * needs (unlinked, and an order with no line items) are older than that by
 * design, and no period or search reaches them: search filters the fetched page,
 * not the range.
 *
 * The ids themselves are not stable across reseeds, so this file is generated
 * rather than committed (see .gitignore) — the same contract as
 * tests/e2e/.auth/storageState.json. A spec that cannot find it should say so
 * and tell you to re-run this script, exactly as global-setup.ts does.
 */
async function writeOrderIdFixture(admin, ownerId) {
  const { data, error } = await admin
    .from("orders")
    .select("order_name, id")
    .eq("user_id", ownerId)
    .order("order_name");

  if (error) {
    throw new Error(`Could not read back seeded orders: ${error.message}`);
  }

  const byName = Object.fromEntries((data || []).map((o) => [o.order_name, o.id]));
  const dest = path.join(process.cwd(), "tests", "fixtures", "seeded-orders.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(byName, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(byName).length} order ids to ${dest}`);
}

main().catch((error) => {
  console.error("Failed to seed demo account.");
  console.error(error.message || error);
  process.exit(1);
});
