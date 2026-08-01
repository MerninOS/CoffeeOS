"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { updateProfile } from "./actions";
import { ProfileSection } from "./components/ProfileSection";
import { ShopifySection } from "./components/ShopifySection";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface SettingsClientProps {
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  userRole: string;
  isOwner: boolean;
  shopifySettings: {
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
  } | null;
}

// ── Main component ───────────────────────────────────────────────────────────

export function SettingsClient({ user, userRole, isOwner, shopifySettings }: SettingsClientProps) {
  const canManageShopify = isOwner || userRole === "admin";
  const [profileData, setProfileData] = useState({ firstName: user.firstName, lastName: user.lastName });
  const [storeDomain, setStoreDomain] = useState("");
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const hasAutoCheckedBillingRef = useRef(false);

  const searchParams = useSearchParams();
  const isShopifyConnected = !!(shopifySettings?.connected_via_oauth && shopifySettings?.has_admin_credentials);
  const isBillingActive = shopifySettings?.billing_status === "ACTIVE";
  const billingReturnDate = shopifySettings?.billing_current_period_end
    ? new Date(shopifySettings.billing_current_period_end).toLocaleDateString()
    : null;

  useEffect(() => {
    const shopifyStatus = searchParams.get("shopify");
    const errorParam = searchParams.get("error");
    const actionParam = searchParams.get("action");
    const billingStatus = searchParams.get("billing");

    const shouldAutoCheckBilling =
      isShopifyConnected &&
      !isBillingActive &&
      !!shopifySettings?.store_domain &&
      (shopifyStatus === "connected" || actionParam === "activate_billing" || errorParam === "billing_not_active");

    if (shouldAutoCheckBilling && !hasAutoCheckedBillingRef.current) {
      hasAutoCheckedBillingRef.current = true;
      setMessage({ type: "success", text: "Checking your Shopify billing status..." });
      const billingUrl = `/api/shopify/billing/ensure?shop=${encodeURIComponent(shopifySettings!.store_domain)}`;
      (window.top || window).location.href = billingUrl;
      return;
    }

    if (shopifyStatus === "connected") {
      setMessage({ type: "success", text: "Shopify store connected successfully! You can now sync products and orders." });
      window.history.replaceState({}, "", "/settings");
    } else if (billingStatus === "active") {
      setMessage({ type: "success", text: "Billing is active. You now have full app access." });
      window.history.replaceState({}, "", "/settings");
    } else if (errorParam) {
      const errorMessages: Record<string, string> = {
        missing_params: "Missing required parameters from Shopify",
        config_error: "Shopify app not configured correctly",
        invalid_signature: "Invalid signature from Shopify",
        invalid_state: "Invalid state — please try connecting again",
        state_expired: "Connection timed out — please try again",
        shop_mismatch: "Shop mismatch — please try connecting again",
        token_exchange_failed: "Failed to exchange token with Shopify",
        save_failed: "Failed to save connection",
        callback_error: "An error occurred during connection",
        billing_not_active: "Billing is required to use the app. Manage your app plan in Shopify Admin, then refresh status here.",
        billing_create_failed: "Billing API charge creation is disabled for managed pricing apps.",
        billing_check_failed: "Could not verify Shopify billing status. Please try again.",
        shopify_not_connected: "Connect your Shopify store before activating billing.",
      };
      setMessage({ type: "error", text: errorMessages[errorParam] || "An error occurred connecting to Shopify" });
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams, isShopifyConnected, isBillingActive, shopifySettings?.store_domain]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProfileSaving(true);
    setMessage(null);
    const result = await updateProfile(profileData);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Profile updated successfully" });
    }
    setIsProfileSaving(false);
  };

  const handleConnectShopify = () => {
    if (!storeDomain.trim()) {
      setMessage({ type: "error", text: "Please enter your Shopify store domain" });
      return;
    }
    setIsConnecting(true);
    setMessage(null);
    let cleanDomain = storeDomain.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!cleanDomain.includes(".myshopify.com")) cleanDomain = `${cleanDomain}.myshopify.com`;
    (window.top || window).location.href = `/api/shopify/install?shop=${encodeURIComponent(cleanDomain)}`;
  };

  const handleDisconnectShopify = async () => {
    setIsDisconnecting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/shopify/disconnect", { method: "POST" });
      const result = await response.json();
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Shopify store disconnected successfully" });
        window.location.reload();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect Shopify store" });
    }
    setIsDisconnecting(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Global message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border-[2.5px] p-3 text-sm font-body font-bold ${
            message.type === "error"
              ? "bg-tomato/10 border-tomato text-tomato"
              : "bg-matcha/10 border-matcha text-matcha"
          }`}
        >
          {message.type === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid gap-6">
        {/* Profile */}
        <ProfileSection
          user={user}
          profileData={profileData}
          setProfileData={setProfileData}
          isSaving={isProfileSaving}
          onSubmit={handleProfileSubmit}
        />

        {/* Shopify */}
        {canManageShopify && (
          <ShopifySection
            shopifySettings={shopifySettings}
            isShopifyConnected={isShopifyConnected}
            isBillingActive={isBillingActive}
            billingReturnDate={billingReturnDate}
            storeDomain={storeDomain}
            setStoreDomain={setStoreDomain}
            isConnecting={isConnecting}
            isDisconnecting={isDisconnecting}
            onConnect={handleConnectShopify}
            onDisconnect={handleDisconnectShopify}
          />
        )}
      </div>
    </div>
  );
}
