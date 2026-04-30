"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { updateProfile } from "./actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlertCircle,
  Loader2,
  Save,
  User,
  CheckCircle2,
  ExternalLink,
  Store,
  Unplug,
} from "lucide-react";

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

// ── Mernin' primitives ───────────────────────────────────────────────────────

function Btn({
  children,
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  type = "button",
  className = "",
  asChild,
  href,
  target,
  rel,
}: {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  asChild?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}) {
  const base =
    "inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { sm: "text-[0.65rem] px-3 py-1.5 gap-1", md: "text-[0.7rem] px-4 py-2 gap-1.5" };
  const variants = {
    primary:
      "bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    outline:
      "bg-transparent text-espresso border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:bg-espresso hover:text-cream active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    ghost:
      "bg-transparent text-espresso border-[2px] border-transparent rounded-lg hover:bg-fog/40 active:bg-fog/60",
    danger:
      "bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
  };
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[0.65rem] font-extrabold uppercase tracking-widest text-espresso font-body mb-1"
    >
      {children}
    </label>
  );
}

function MerninInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-chalk border-[2.5px] border-espresso rounded-xl px-3 py-2 font-body text-sm text-espresso placeholder:text-espresso/30 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed ${props.className ?? ""}`}
    />
  );
}

function SectionPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({ icon, title, subtitle, right }: { icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 border-b-2 border-espresso bg-cream">
      <div className="flex items-center gap-2.5">
        <div className="text-espresso/60">{icon}</div>
        <div>
          <h2 className="font-body font-extrabold text-sm uppercase tracking-widest text-espresso leading-none">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-espresso/50 font-body">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.6rem] font-extrabold uppercase tracking-widest border-[2px] font-body ${
        active
          ? "bg-matcha/20 text-espresso border-matcha"
          : "bg-honey/20 text-espresso border-honey"
      }`}
    >
      {label}
    </span>
  );
}

function InfoNote({
  variant = "info",
  children,
}: {
  variant?: "info" | "warn" | "note";
  children: React.ReactNode;
}) {
  const colors = {
    info: "bg-sky/10 border-sky/40",
    warn: "bg-honey/10 border-honey/40",
    note: "bg-fog/40 border-fog",
  };
  return (
    <div className={`rounded-xl border-[2px] px-4 py-3 text-sm font-body text-espresso/80 ${colors[variant]}`}>
      {children}
    </div>
  );
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
        <SectionPanel>
          <PanelHeader
            icon={<User className="h-5 w-5" />}
            title="Profile"
            subtitle="Update your personal information"
          />
          <form onSubmit={handleProfileSubmit}>
            <div className="px-5 py-5 space-y-4">
              <div>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <MerninInput id="email" value={user.email} disabled />
                <p className="mt-1 text-xs text-espresso/40 font-body">Email cannot be changed</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                  <MerninInput
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                  <MerninInput
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
            <div className="bg-cream border-t-2 border-espresso px-5 py-4 flex justify-end">
              <Btn type="submit" disabled={isProfileSaving}>
                {isProfileSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save Changes
              </Btn>
            </div>
          </form>
        </SectionPanel>

        {/* Shopify */}
        {canManageShopify && (
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="inline-flex items-center justify-center gap-1.5 font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-transparent text-tomato border-[2.5px] border-tomato rounded-full shadow-[3px_3px_0_#E8442A] hover:bg-tomato hover:text-cream transition-all cursor-pointer">
                        <Unplug className="h-3.5 w-3.5" />
                        Disconnect Store
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-sm p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-[8px_8px_0_#1C0F05]">
                      <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-body font-extrabold uppercase tracking-widest text-espresso text-sm">
                            Disconnect Shopify Store?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="font-body text-sm text-espresso/60 mt-1">
                            This will remove the connection to your Shopify store. You won&apos;t be able to sync products or orders until you reconnect. Your existing data will be preserved.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                      </div>
                      <AlertDialogFooter className="px-6 py-4 flex justify-end gap-2">
                        <AlertDialogCancel className="inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-transparent text-espresso border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:bg-espresso hover:text-cream transition-all cursor-pointer">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDisconnectShopify}
                          disabled={isDisconnecting}
                          className="inline-flex items-center justify-center gap-1.5 font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                        >
                          {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <Btn onClick={handleConnectShopify} disabled={isConnecting || !storeDomain.trim()}>
                  {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Store className="h-3.5 w-3.5" />}
                  Connect to Shopify
                </Btn>
              )}
            </div>
          </SectionPanel>
        )}
      </div>
    </div>
  );
}
