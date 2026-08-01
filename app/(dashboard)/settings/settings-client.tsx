"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { updateProfile } from "./actions";
import { shopifyErrorMessage } from "@/lib/settings/errors";
import { isBillingActive as isBillingActiveFor, isConnected } from "@/lib/settings/status";
import { WorkspaceHero } from "./components/WorkspaceHero";
import type { ShopifySettings } from "./components/types";
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
  memberCount: number;
  invitedCount: number;
  shopifySettings: ShopifySettings | null;
}

// ── Main component ───────────────────────────────────────────────────────────

export function SettingsClient({ user, userRole, isOwner, shopifySettings, memberCount, invitedCount }: SettingsClientProps) {
  const canManageShopify = isOwner || userRole === "admin";
  const [profileData, setProfileData] = useState({ firstName: user.firstName, lastName: user.lastName });
  const [storeDomain, setStoreDomain] = useState("");
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const hasAutoCheckedBillingRef = useRef(false);

  const searchParams = useSearchParams();
  /* Both come from lib/settings/status.ts rather than being re-derived here.
     tests/unit/settings-tokens.spec.ts bans the three underlying column names
     from this whole directory, so there is exactly one definition of "connected"
     and one of "billed" — the split-brain CoffeeOS#100 closed on /orders was a
     second copy of a rule, not a wrong one. */
  const isShopifyConnected = isConnected(shopifySettings);
  const isBillingActive = isBillingActiveFor(shopifySettings);

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
      setMessage({ type: "error", text: shopifyErrorMessage(errorParam) });
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
        <WorkspaceHero
          shopifySettings={shopifySettings}
          canManage={canManageShopify}
          members={memberCount}
          invited={invitedCount}
        />

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
