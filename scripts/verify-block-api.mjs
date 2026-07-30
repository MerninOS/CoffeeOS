#!/usr/bin/env node
/**
 * Verification harness for the Shopify admin block's API surface.
 *
 * WHY THIS EXISTS
 * The four /api/shopify/block/* routes carry essentially all of this feature's
 * risk — session-token verification, tenant isolation, sync-on-demand, the COGS
 * assembly — and none of it has automated tests, because a mocked-Supabase test
 * would only test the mock. The block extension itself needs a real Shopify
 * admin to exercise, but the ROUTES are plain HTTP: mint a valid session token
 * with the app secret and you can drive all of them with no Shopify account,
 * no dev store, and no risk to the live app.
 *
 * SAFETY MODEL
 *   Phase A (auth)  — no tenant data touched at all.
 *   Phase B (read)  — GET only, against real orders.
 *   Phase C (write) — OPT-IN via --write. Targets one order chosen because it
 *                     has no packing lines and no custom costs, so "restore" is
 *                     just "remove what we added". Packing is reverted through
 *                     the API itself; the shipping row has no delete endpoint,
 *                     so the script prints the exact cleanup SQL at the end.
 *
 * It never prints secrets. It reads SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET
 * from .env.local and uses them only to sign tokens.
 *
 * USAGE
 *   # start the app first, in another terminal:
 *   pnpm dev
 *
 *   node scripts/verify-block-api.mjs                 # auth + read only (safe)
 *   node scripts/verify-block-api.mjs --write         # + write tests on --order
 *   node scripts/verify-block-api.mjs --write --test-create-component
 *
 *   --base <url>      default http://localhost:3000
 *   --shop <domain>   default zakuccinos-coffee.myshopify.com
 *   --order <id>      numeric Shopify order id used for write tests
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const BASE = arg("base", "http://localhost:3000").replace(/\/$/, "");
const SHOP = arg("shop", "zakuccinos-coffee.myshopify.com");
const WRITE_ORDER = arg("order", "6928411328787"); // #1304 — no packing, no custom costs
const DO_WRITE = flag("write");
const DO_CREATE = flag("test-create-component");

/**
 * Read-only fixtures — real orders on the default shop. The expectations encode
 * the data as it stood when this was written, so a mismatch means either the
 * data moved or the code did; both are worth knowing.
 *
 * `shippingExact` / `shippingOther` mirror the split the block itself makes:
 * a cost named exactly "shipping" (case-insensitive) pre-fills the field, while
 * anything else merely CONTAINING "shipping" is shown read-only with a warning,
 * because saving would add a new row rather than replace it.
 */
const READ_FIXTURES = [
  {
    name: "#1312",
    id: "6998605529363",
    expect: { customCosts: 1, packing: 5, shippingExact: 1, shippingOther: 0 },
  },
  {
    name: "#1311 (multi-shipping)",
    id: "6991873835283",
    expect: { customCosts: 2, packing: 2, shippingExact: 0, shippingOther: 2 },
  },
  {
    name: "#1309",
    id: "6984582889747",
    expect: { customCosts: 1, packing: 2, shippingExact: 1, shippingOther: 0 },
  },
];
const AUTH_FIXTURE_ID = READ_FIXTURES[0].id;

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  let raw;
  try {
    raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  } catch {
    die("Could not read .env.local — run this from the CoffeeOS repo.");
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv();
const CLIENT_ID = env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = env.SHOPIFY_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  die("SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET missing from .env.local");
}

// ---------------------------------------------------------------------------
// Token minting — mirrors what Shopify produces and what
// lib/shopify-block/session.ts verifies.
// ---------------------------------------------------------------------------

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

function mintToken({
  shop = SHOP,
  aud = CLIENT_ID,
  secret = CLIENT_SECRET,
  expiresInSec = 60,
  omitExp = false,
  header = { alg: "HS256", typ: "JWT" },
} = {}) {
  const payload = { dest: `https://${shop}`, aud, iss: `https://${shop}/admin` };
  if (!omitExp) payload.exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const h = b64(header);
  const p = b64(payload);
  const sig = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function call(path, { token, method = "GET", body, noAuth = false, rawAuth } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (rawAuth) headers.Authorization = rawAuth;
  else if (!noAuth) headers.Authorization = `Bearer ${token ?? mintToken()}`;

  const res = await fetch(`${BASE}/api/shopify/block${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  return { status: res.status, body: json, cors: res.headers.get("access-control-allow-origin") };
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

let pass = 0;
const failures = [];

function check(label, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const section = (t) => console.log(`\n${t}\n${"─".repeat(t.length)}`);

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

async function phaseAuth() {
  section("A. Authentication & validation (touches no tenant data)");

  const cases = [
    ["no Authorization header → 401", { noAuth: true }, 401],
    ["malformed scheme → 401", { rawAuth: "Token abc" }, 401],
    ["lowercase bearer → 401 (fails closed)", { rawAuth: `bearer ${mintToken()}` }, 401],
    ["empty bearer → 401", { rawAuth: "Bearer " }, 401],
    ["garbage token → 401", { token: "not-a-jwt" }, 401],
    ["signed with wrong secret → 401", { token: mintToken({ secret: "wrong-secret" }) }, 401],
    ["wrong audience → 401", { token: mintToken({ aud: "some-other-app" }) }, 401],
    ["expired token → 401", { token: mintToken({ expiresInSec: -30 }) }, 401],
    ["missing exp claim → 401", { token: mintToken({ omitExp: true }) }, 401],
    [
      "alg:none header still requires valid HMAC → 401",
      { rawAuth: `Bearer ${mintToken({ header: { alg: "none", typ: "JWT" } , secret: "x" })}` },
      401,
    ],
    ["unconnected shop → 404", { token: mintToken({ shop: "nope-not-real.myshopify.com" }) }, 404],
  ];

  for (const [label, opts, want] of cases) {
    const r = await call(`/packing-state?shopify_order_id=${AUTH_FIXTURE_ID}`, opts);
    check(label, r.status === want, `got ${r.status}`);
  }

  // Param validation, with a valid token.
  const missing = await call("/packing-state");
  check("missing shopify_order_id → 400", missing.status === 400, `got ${missing.status}`);

  const gid = await call("/packing-state?shopify_order_id=gid%3A%2F%2Fshopify%2FOrder%2F123");
  check("GID instead of numeric id → 400", gid.status === 400, `got ${gid.status}`);

  const junk = await call("/packing-state?shopify_order_id=12abc");
  check("non-numeric id → 400", junk.status === 400, `got ${junk.status}`);

  // CORS must be present even on failures, or the extension sees an opaque error.
  const corsCheck = await call("/packing-state?shopify_order_id=1", { noAuth: true });
  check("CORS header present on a 401", corsCheck.cors !== null, "no Access-Control-Allow-Origin");
}

async function phaseRead() {
  section("B. Read (GET only — no writes)");

  let first = null;

  for (const fx of READ_FIXTURES) {
    const r = await call(`/packing-state?shopify_order_id=${fx.id}`);
    check(`${fx.name}: GET → 200`, r.status === 200, `got ${r.status}`);
    if (r.status !== 200) continue;

    const s = r.body?.state;
    check(`${fx.name}: state present`, !!s);
    if (!s) continue;
    if (!first) first = s;

    check(`${fx.name}: shopifyOrderId echoes the request`, s.order?.shopifyOrderId === fx.id);
    check(
      `${fx.name}: costability is a known value`,
      ["costed", "unlinked", "uncosted"].includes(s.costability),
      String(s.costability)
    );
    check(`${fx.name}: cogs.total is a number`, typeof s.cogs?.total === "number");
    check(
      `${fx.name}: ${fx.expect.packing} packing lines`,
      s.packing.length === fx.expect.packing,
      `got ${s.packing.length}`
    );
    check(
      `${fx.name}: ${fx.expect.customCosts} custom costs`,
      s.customCosts.length === fx.expect.customCosts,
      `got ${s.customCosts.length}`
    );

    // The block's own split, re-derived here so a drift between the two
    // definitions shows up as a failure rather than a surprise in the admin.
    const lower = (c) => c.description.toLowerCase();
    const exact = s.customCosts.filter((c) => lower(c) === "shipping");
    const other = s.customCosts.filter(
      (c) => lower(c).includes("shipping") && lower(c) !== "shipping"
    );
    check(
      `${fx.name}: ${fx.expect.shippingExact} exact-"Shipping" cost(s) → field pre-fills`,
      exact.length === fx.expect.shippingExact,
      `got ${exact.length}`
    );
    check(
      `${fx.name}: ${fx.expect.shippingOther} unrecognized shipping cost(s) → warning banner`,
      other.length === fx.expect.shippingOther,
      `got ${other.length}`
    );

    // The invariant cogs.ts exists to protect: an order whose cost is unknown
    // must never display a margin.
    const revenue = s.order?.totalPrice ?? 0;
    const marginAllowed = s.costability === "costed" && revenue > 0;
    check(
      `${fx.name}: margin is ${marginAllowed ? "a number" : "null"} (costability=${s.costability})`,
      marginAllowed ? typeof s.cogs.margin === "number" : s.cogs.margin === null,
      `got ${s.cogs?.margin}`
    );

    // A suggestion must never be offered over data the operator already saved.
    if (s.packing.length > 0) {
      check(`${fx.name}: no suggestion over existing packing`, s.suggestion.length === 0);
    }

    console.log(
      `      ${fx.name}: costability=${s.costability} revenue=$${revenue} ` +
        `cogs=$${s.cogs.total.toFixed(2)} ` +
        `margin=${s.cogs.margin === null ? "null" : s.cogs.margin.toFixed(1) + "%"}` +
        (other.length ? `  unrecognized: ${other.map((c) => `"${c.description}" $${c.amount}`).join(", ")}` : "")
    );
  }

  return first;
}

async function phaseWrite(readState) {
  section(`C. Write (opt-in) — order ${WRITE_ORDER}`);

  const before = await call(`/packing-state?shopify_order_id=${WRITE_ORDER}`);
  if (before.status !== 200) {
    check(`GET target order → 200`, false, `got ${before.status}`);
    return;
  }
  const start = before.body.state;
  console.log(
    `    starting state: packing=${start.packing.length} customCosts=${start.customCosts.length}`
  );
  if (start.packing.length > 0 || start.customCosts.length > 0) {
    console.log(
      "\n    ⚠ target order is NOT empty. Aborting write phase so nothing real is destroyed."
    );
    console.log("      Pass --order <numeric id> for an order with no packing lines/custom costs.");
    return;
  }

  const component = (readState?.library ?? start.library)[0];
  if (!component) {
    console.log("    ⚠ no components in the library — cannot exercise packing save.");
    return;
  }

  // --- packing save -------------------------------------------------------
  const saved = await call("/packing", {
    method: "POST",
    body: { shopifyOrderId: WRITE_ORDER, lines: [{ componentId: component.id, quantity: 2 }] },
  });
  check("POST /packing with one line → 200", saved.status === 200, `got ${saved.status}`);
  check(
    "response reflects the saved line",
    saved.body?.state?.packing?.length === 1 &&
      saved.body.state.packing[0].componentId === component.id &&
      Number(saved.body.state.packing[0].quantity) === 2
  );

  // --- validation rejections ---------------------------------------------
  const dupes = await call("/packing", {
    method: "POST",
    body: {
      shopifyOrderId: WRITE_ORDER,
      lines: [
        { componentId: component.id, quantity: 1 },
        { componentId: component.id, quantity: 1 },
      ],
    },
  });
  check("duplicate componentId → 400", dupes.status === 400, `got ${dupes.status}`);

  const badUuid = await call("/packing", {
    method: "POST",
    body: { shopifyOrderId: WRITE_ORDER, lines: [{ componentId: "not-a-uuid", quantity: 1 }] },
  });
  check("non-UUID componentId → 400", badUuid.status === 400, `got ${badUuid.status}`);

  const huge = await call("/packing", {
    method: "POST",
    body: { shopifyOrderId: WRITE_ORDER, lines: [{ componentId: component.id, quantity: 1e12 }] },
  });
  check("absurd quantity → 400", huge.status === 400, `got ${huge.status}`);

  const foreign = await call("/packing", {
    method: "POST",
    body: {
      shopifyOrderId: WRITE_ORDER,
      lines: [{ componentId: "00000000-0000-0000-0000-000000000000", quantity: 1 }],
    },
  });
  check("component not owned by tenant → 400", foreign.status === 400, `got ${foreign.status}`);

  // Confirm the rejections did not disturb the saved line.
  const afterRejects = await call(`/packing-state?shopify_order_id=${WRITE_ORDER}`);
  check(
    "rejected writes left the saved line intact",
    afterRejects.body?.state?.packing?.length === 1
  );

  // --- shipping cost ------------------------------------------------------
  const ship1 = await call("/shipping-cost", {
    method: "POST",
    body: { shopifyOrderId: WRITE_ORDER, amount: 7.25 },
  });
  check("POST /shipping-cost → 200", ship1.status === 200, `got ${ship1.status}`);
  const shipRows = (ship1.body?.state?.customCosts ?? []).filter(
    (c) => c.description.toLowerCase() === "shipping"
  );
  check("exactly one Shipping row after first save", shipRows.length === 1, `got ${shipRows.length}`);

  const ship2 = await call("/shipping-cost", {
    method: "POST",
    body: { shopifyOrderId: WRITE_ORDER, amount: 9.5 },
  });
  const shipRows2 = (ship2.body?.state?.customCosts ?? []).filter(
    (c) => c.description.toLowerCase() === "shipping"
  );
  check(
    "re-save UPDATES rather than duplicating (still one row)",
    shipRows2.length === 1,
    `got ${shipRows2.length}`
  );
  check("re-save applied the new amount", Number(shipRows2[0]?.amount) === 9.5, `got ${shipRows2[0]?.amount}`);

  const shipNeg = await call("/shipping-cost", {
    method: "POST",
    body: { shopifyOrderId: WRITE_ORDER, amount: -5 },
  });
  check("negative shipping amount → 400", shipNeg.status === 400, `got ${shipNeg.status}`);

  // --- duplicate component name ------------------------------------------
  const dupName = await call("/component", {
    method: "POST",
    body: {
      name: component.name,
      type: "packaging",
      unit: "unit",
      costPerUnit: 1,
      shopifyOrderId: WRITE_ORDER,
    },
  });
  check("creating a component with an existing name → 409", dupName.status === 409, `got ${dupName.status}`);
  check(
    "409 body carries existingComponentId",
    typeof dupName.body?.existingComponentId === "string",
    JSON.stringify(dupName.body)
  );

  const badType = await call("/component", {
    method: "POST",
    body: { name: `harness-${Date.now()}`, type: "bogus", unit: "unit", costPerUnit: 1 },
  });
  check("invalid component type → 400", badType.status === 400, `got ${badType.status}`);

  let createdComponentName = null;
  if (DO_CREATE) {
    createdComponentName = `zz-harness-${Date.now()}`;
    const created = await call("/component", {
      method: "POST",
      body: {
        name: createdComponentName,
        type: "packaging",
        unit: "unit",
        costPerUnit: 0.42,
        shopifyOrderId: WRITE_ORDER,
      },
    });
    check("create a genuinely new component → 200", created.status === 200, `got ${created.status}`);
    check("new component is returned", created.body?.component?.name === createdComponentName);
  }

  // --- empty save clears the list ----------------------------------------
  const cleared = await call("/packing", {
    method: "POST",
    body: { shopifyOrderId: WRITE_ORDER, lines: [] },
  });
  check("POST /packing with lines:[] → 200", cleared.status === 200, `got ${cleared.status}`);
  check("empty save clears the packing list", cleared.body?.state?.packing?.length === 0);

  // --- cleanup notes ------------------------------------------------------
  console.log("\n    Packing lines were reverted through the API (empty save).");
  console.log("    The shipping row has no delete endpoint. Run this to remove it:\n");
  console.log(
    `      delete from order_custom_costs\n` +
      `       where order_id = (select id from orders where shopify_order_id = '${WRITE_ORDER}')\n` +
      `         and lower(description) = 'shipping';`
  );
  if (createdComponentName) {
    console.log(`\n    And to remove the component this run created:\n`);
    console.log(
      `      delete from components where name = '${createdComponentName}';`
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nBlock API verification`);
  console.log(`  base  ${BASE}`);
  console.log(`  shop  ${SHOP}`);
  console.log(`  mode  ${DO_WRITE ? `auth + read + WRITE (order ${WRITE_ORDER})` : "auth + read only"}`);

  try {
    await fetch(BASE, { method: "HEAD" });
  } catch {
    die(`Nothing is listening on ${BASE}. Start the app first:  pnpm dev`);
  }

  await phaseAuth();
  const readState = await phaseRead();
  if (DO_WRITE) await phaseWrite(readState);

  section("Result");
  console.log(`  ${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("");
    for (const f of failures) console.log(`  ✗ ${f}`);
    console.log("");
    process.exit(1);
  }
  console.log(
    DO_WRITE
      ? "\n  All checks passed. Remember the cleanup SQL above.\n"
      : "\n  All checks passed. Re-run with --write to exercise the mutation routes.\n"
  );
}

main().catch((e) => die(e?.stack || String(e)));
