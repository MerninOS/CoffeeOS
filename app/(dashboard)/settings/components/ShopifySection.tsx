"use client";

import React from "react";
import { Badge, Button, Input } from "@merninos/ui/instrument";
import { CreditCard, ExternalLink, Loader2, Store } from "lucide-react";
import { isBillingActive, isConnected } from "@/lib/settings/status";
import { DisconnectStoreDialog } from "./SettingsDialogs";
import { Row } from "./Row";
import { Section } from "./Section";
import { mono, sans } from "./tokens";
import type { ShopifySettings } from "./types";

/**
 * The Shopify connection, as worksheet rows.
 *
 * WHAT WENT AWAY. The loud version nested three deep — a bordered SectionPanel,
 * a bordered store-info box inside it, and three bordered InfoNotes inside that
 * — which is the pattern the Instrument layout rule forbids outright. The notes
 * are gone rather than restyled: two were permanent documentation competing with
 * live state. The connected-via-app note became the section meta, the billing
 * note became the Billing row, and the protected-customer-data caveat became
 * help text under the scopes it is actually about.
 *
 * WHAT MOVED. There is no trailing "Actions" row. Disconnect sits on the Store
 * row and the billing button on the Billing row, because those are the rows
 * whose state they change — the same principle /orders/[id] used when it stopped
 * putting the answer 500px below the question. "Refresh billing status" is not
 * here at all: it belongs to the hero's own failure, and repeating it would put
 * the same button on screen twice.
 *
 * WHAT DELIBERATELY DID NOT MOVE: the auto-billing-check effect and its
 * hasAutoCheckedBillingRef. That guard is per-mount and this component remounts;
 * it stays in settings-client.tsx.
 */
export function ShopifySection({
  shopifySettings,
  storeDomain,
  setStoreDomain,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
}: {
  shopifySettings: ShopifySettings | null;
  storeDomain: string;
  setStoreDomain: (v: string) => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = isConnected(shopifySettings);
  const billed = isBillingActive(shopifySettings);

  /* The real granted scopes. page.tsx has always passed oauth_scope and the loud
     page threw it away, rendering a hardcoded ["Products API", "Orders API"]
     that claimed the same two for every store regardless of what it granted. */
  const scopes = (shopifySettings?.oauth_scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!connected) {
    return (
      <Section title="Shopify" meta="Not connected">
        <Row
          label="Store domain"
          help="Your store name (mernin-roasting) or the full myshopify.com domain."
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Input
              mono
              placeholder="your-store.myshopify.com"
              value={storeDomain}
              onChange={(e) => setStoreDomain(e.target.value)}
              style={{ flex: "1 1 260px", maxWidth: 340 }}
            />
            <Button
              iconLeft={isConnecting ? <Loader2 /> : <Store />}
              disabled={isConnecting || !storeDomain.trim()}
              onClick={onConnect}
            >
              Connect store
            </Button>
          </div>
        </Row>
        <Row label="What happens">
          <span style={{ ...sans, color: "var(--ink-muted)", lineHeight: "var(--lh-body)" }}>
            You&apos;ll be sent to Shopify to authorize CoffeeOS, then returned here. Approving the
            app plan is part of the same flow.
          </span>
        </Row>
      </Section>
    );
  }

  return (
    <Section title="Shopify" meta="Connected via OAuth">
      <Row label="Store">
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ ...sans, fontWeight: "var(--fw-medium)" }}>
              {shopifySettings?.shop_name || shopifySettings?.store_domain}
            </div>
            <a
              href={`https://${shopifySettings?.store_domain}/admin`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                minWidth: 0,
                color: "var(--ink-muted)",
                textDecoration: "none",
              }}
            >
              <span style={{ ...mono, fontSize: "var(--fs-data)", overflowWrap: "anywhere" }}>
                {shopifySettings?.store_domain}
              </span>
              <ExternalLink width={14} height={14} style={{ flex: "none" }} />
            </a>
          </div>
          <DisconnectStoreDialog isDisconnecting={isDisconnecting} onDisconnect={onDisconnect} />
        </div>
      </Row>

      <Row
        label="Granted scopes"
        help="Read from oauth_scope. Order sync additionally needs protected customer data access, approved in your Shopify Partner dashboard."
      >
        {scopes.length > 0 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {scopes.map((scope) => (
              <Badge key={scope} mono size="sm" tone="neutral" variant="outline">
                {scope}
              </Badge>
            ))}
          </div>
        ) : (
          /* An older row can carry a null oauth_scope. An empty chip strip would
             read as "no access granted", which is a different and wrong claim. */
          <span style={{ ...sans, color: "var(--ink-subtle)" }}>
            Not reported by Shopify for this connection.
          </span>
        )}
      </Row>

      <Row
        label="Billing"
        help={shopifySettings?.billing_test ? "Test mode — no real charges are being made." : undefined}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {billed ? (
            <Badge tone="success">Active</Badge>
          ) : (
            <Badge tone="brand" dot>
              Required
            </Badge>
          )}
          <span style={{ ...sans, color: "var(--ink-muted)" }}>
            {billed
              ? [
                  shopifySettings?.billing_plan_name,
                  shopifySettings?.billing_current_period_end
                    ? `renews ${new Date(shopifySettings.billing_current_period_end).toLocaleDateString()}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "CoffeeOS is read-only until the plan is approved in Shopify."}
          </span>
        </div>
        <div>
          <Button
            size="sm"
            variant="secondary"
            iconLeft={<CreditCard />}
            onClick={() =>
              window.open(
                `https://${shopifySettings?.store_domain}/admin/settings/apps`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            Manage plan in Shopify
          </Button>
        </div>
      </Row>
    </Section>
  );
}
