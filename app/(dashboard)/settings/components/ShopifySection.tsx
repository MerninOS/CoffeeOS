"use client";

import React from "react";
import { ExternalLink, Loader2, Store } from "lucide-react";
import { DisconnectStoreDialog } from "./SettingsDialogs";
import { Btn, FieldLabel, InfoNote, MerninInput, PanelHeader, SectionPanel, StatusPill } from "./LoudPrimitives";
import type { ShopifySettings } from "./types";

/**
 * The Shopify connection panel. Moved out of settings-client.tsx verbatim
 * (CoffeeOS#74 Stage A) — byte-identical markup, so the baselines can prove the
 * extraction changed nothing.
 *
 * WHAT DELIBERATELY DID NOT MOVE: the auto-billing-check effect and its
 * `hasAutoCheckedBillingRef`. That guard is per-mount, and this component
 * remounts whenever `canManageShopify` flips or the connection state changes —
 * which would re-arm it and fire `location.href` again. It stays in
 * settings-client.tsx, which mounts once. tests/e2e/settings-capabilities.spec.ts
 * asserts the behaviour it drives ("billing_not_active re-checks billing instead
 * of rendering a message"), so moving it here fails the suite rather than
 * shipping a redirect loop.
 *
 * Every handler is a prop for the same reason: this component owns no state.
 */
export function ShopifySection({
  shopifySettings,
  isShopifyConnected,
  isBillingActive,
  billingReturnDate,
  storeDomain,
  setStoreDomain,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
}: {
  shopifySettings: ShopifySettings | null;
  isShopifyConnected: boolean;
  isBillingActive: boolean;
  billingReturnDate: string | null;
  storeDomain: string;
  setStoreDomain: (v: string) => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <SectionPanel>
      <PanelHeader
        icon={<Store className="h-5 w-5" />}
        title="Shopify Store"
        subtitle="Connect your Shopify store to sync products and orders"
        right={
          isShopifyConnected ? (
            <>
              <StatusPill active={true} label="Connected" />
              <StatusPill active={isBillingActive} label={isBillingActive ? "Billing Active" : "Billing Required"} />
            </>
          ) : undefined
        }
      />
      <div className="px-5 py-5 space-y-4">
        {isShopifyConnected ? (
          <>
            {/* Store info */}
            <div className="bg-cream border-[2.5px] border-espresso rounded-[16px] shadow-[3px_3px_0_#1C0F05] p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="font-body font-extrabold text-sm text-espresso">
                    {shopifySettings?.shop_name || shopifySettings?.store_domain}
                  </p>
                  <p className="text-xs text-espresso/50 font-body">{shopifySettings?.store_domain}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["Products API", "Orders API"].map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-extrabold uppercase tracking-widest border-[2px] font-body bg-fog/40 text-espresso border-fog"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <a
                  href={`https://${shopifySettings?.store_domain}/admin`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-espresso/40 hover:text-espresso transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            <InfoNote variant="warn">
              <strong>Connected via Shopify App.</strong> Your store is connected through the official Shopify OAuth flow.
              You can manage this app&apos;s access from your{" "}
              <a
                href={`https://${shopifySettings?.store_domain}/admin/settings/apps`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline"
              >
                Shopify Admin
              </a>
              .
            </InfoNote>

            <InfoNote variant="note">
              <strong>Billing:</strong>{" "}
              {isBillingActive
                ? `Active${shopifySettings?.billing_plan_name ? ` (${shopifySettings.billing_plan_name})` : ""}`
                : "Not active"}
              {isBillingActive && billingReturnDate ? ` · Renews ${billingReturnDate}` : ""}
              {shopifySettings?.billing_test ? " · Test mode" : ""}
            </InfoNote>

            <InfoNote variant="info">
              <strong>Note about Order Sync:</strong> To sync orders, your Shopify app must be approved for protected customer data access.
              If you see an error, request access in your{" "}
              <a
                href="https://partners.shopify.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline"
              >
                Shopify Partner Dashboard
              </a>
              {" "}under App Setup &gt; Protected customer data access.
            </InfoNote>
          </>
        ) : (
          <>
            <InfoNote variant="info">
              <strong className="block mb-0.5">Connect Your Shopify Store</strong>
              CoffeeOS needs access to your Shopify store to sync products and orders. Enter your store domain below and click connect to authorize the app.
            </InfoNote>
            <div>
              <FieldLabel htmlFor="storeDomain">Store Domain</FieldLabel>
              <MerninInput
                id="storeDomain"
                placeholder="your-store or your-store.myshopify.com"
                value={storeDomain}
                onChange={(e) => setStoreDomain(e.target.value)}
              />
              <p className="mt-1 text-xs text-espresso/40 font-body">
                Enter your store name (e.g. &quot;my-coffee-shop&quot;) or full domain
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="bg-cream border-t-2 border-espresso px-5 py-4 flex flex-wrap gap-2 justify-end">
        {isShopifyConnected ? (
          <>
            {!isBillingActive && (
              <Btn
                variant="outline"
                onClick={() => {
                  const url = `/api/shopify/billing/ensure?shop=${encodeURIComponent(shopifySettings?.store_domain || "")}`;
                  (window.top || window).location.href = url;
                }}
              >
                Refresh Billing Status
              </Btn>
            )}
            <Btn
              variant="outline"
              href={`https://${shopifySettings?.store_domain}/admin/settings/apps`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Manage Billing in Shopify
            </Btn>
            <DisconnectStoreDialog isDisconnecting={isDisconnecting} onDisconnect={onDisconnect} />
          </>
        ) : (
          <Btn onClick={onConnect} disabled={isConnecting || !storeDomain.trim()}>
            {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Store className="h-3.5 w-3.5" />}
            Connect to Shopify
          </Btn>
        )}
      </div>
    </SectionPanel>
  );
}
