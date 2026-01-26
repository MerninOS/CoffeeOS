"use client";

import React from "react"

import { useState } from "react";
import { saveStorefrontSettings, saveAdminApiSettings, updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Loader2,
  Save,
  ShoppingCart,
  User,
  CheckCircle2,
  ExternalLink,
  Package,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SettingsClientProps {
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  isOwner: boolean;
  shopifySettings: {
    store_domain: string;
    has_storefront_token?: boolean;
    has_admin_credentials?: boolean;
  } | null;
}

export function SettingsClient({
  user,
  isOwner,
  shopifySettings,
}: SettingsClientProps) {
  const [profileData, setProfileData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
  });
  const [storefrontData, setStorefrontData] = useState({
    storeDomain: shopifySettings?.store_domain || "",
    accessToken: "",
  });
  const [adminData, setAdminData] = useState({
    adminAccessToken: "",
  });
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isStorefrontSaving, setIsStorefrontSaving] = useState(false);
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  const handleStorefrontSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsStorefrontSaving(true);
    setMessage(null);

    const result = await saveStorefrontSettings(storefrontData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({
        type: "success",
        text: "Storefront API connected successfully. You can now sync products.",
      });
      setStorefrontData({ ...storefrontData, accessToken: "" });
    }

    setIsStorefrontSaving(false);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shopifySettings?.store_domain) {
      setMessage({ type: "error", text: "Please connect your Storefront API first to set your store domain." });
      return;
    }

    if (!adminData.adminAccessToken) {
      setMessage({ type: "error", text: "Please enter your Admin API Access Token." });
      return;
    }

    setIsAdminSaving(true);
    setMessage(null);

    const result = await saveAdminApiSettings({
      adminAccessToken: adminData.adminAccessToken,
    });

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({
        type: "success",
        text: "Admin API connected successfully. You can now sync orders.",
      });
      setAdminData({ adminAccessToken: "" });
    }

    setIsAdminSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and integrations
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-md p-3 text-sm ${
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-500/10 text-green-600"
          }`}
        >
          {message.type === "error" ? (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid gap-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <form onSubmit={handleProfileSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) =>
                      setProfileData({ ...profileData, firstName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) =>
                      setProfileData({ ...profileData, lastName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isProfileSaving}>
                {isProfileSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Shopify Storefront API - For Products */}
        {isOwner && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  <CardTitle>Storefront API (Products)</CardTitle>
                </div>
                {shopifySettings?.has_storefront_token && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                )}
              </div>
              <CardDescription>
                Connect your Shopify Storefront API to sync products and prices
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleStorefrontSubmit}>
              <CardContent className="space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="instructions" className="border-amber-200">
                    <AccordionTrigger className="rounded-t-lg bg-amber-50 px-4 text-amber-800 hover:bg-amber-100 hover:no-underline">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <AlertCircle className="h-4 w-4" />
                        How to get your Storefront Access Token
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="rounded-b-lg border border-t-0 border-amber-200 bg-amber-50 px-4 pb-4">
                      <div className="space-y-4 pt-2">
                        <p className="text-sm text-amber-700">
                          The Storefront API is used to sync your product catalog including names, images, and prices.
                        </p>
                        
                        <div className="space-y-3">
                          <h5 className="font-medium text-amber-800">Using the Headless Channel (Recommended)</h5>
                          <ol className="list-inside list-decimal space-y-2 text-sm text-amber-700">
                            <li>
                              Go to your Shopify Admin and{" "}
                              <a
                                href="https://apps.shopify.com/headless"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-amber-900 underline"
                              >
                                install the Headless channel
                              </a>
                            </li>
                            <li>
                              In your Shopify admin sidebar, go to <strong>Sales channels</strong> &gt; <strong>Headless</strong>
                            </li>
                            <li>
                              Click <strong>Create storefront</strong> (or select an existing one)
                            </li>
                            <li>
                              Click <strong>Storefront API</strong> in the left sidebar
                            </li>
                            <li>
                              Under <strong>Public access token</strong>, click <strong>Manage</strong>
                            </li>
                            <li>
                              Make sure <strong>unauthenticated_read_product_listings</strong> scope is enabled
                            </li>
                            <li>
                              Copy the <strong>Public access token</strong> shown at the top
                            </li>
                          </ol>
                        </div>

                        <a
                          href="https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/getting-started"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm font-medium text-amber-800 hover:underline"
                        >
                          View official Shopify documentation
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="space-y-2">
                  <Label htmlFor="storeDomain">Store Domain</Label>
                  <Input
                    id="storeDomain"
                    placeholder="your-store.myshopify.com"
                    value={storefrontData.storeDomain}
                    onChange={(e) =>
                      setStorefrontData({
                        ...storefrontData,
                        storeDomain: e.target.value,
                      })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Shopify store domain (e.g., my-coffee-shop.myshopify.com)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessToken">Storefront Access Token</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    placeholder={
                      shopifySettings?.has_storefront_token
                        ? "Enter new token to update"
                        : "Paste your Storefront access token here"
                    }
                    value={storefrontData.accessToken}
                    onChange={(e) =>
                      setStorefrontData({
                        ...storefrontData,
                        accessToken: e.target.value,
                      })
                    }
                    required={!shopifySettings?.has_storefront_token}
                  />
                  <p className="text-xs text-muted-foreground">
                    {shopifySettings?.has_storefront_token
                      ? "Leave empty to keep the existing token, or enter a new one to update"
                      : "The public access token from the Headless channel"}
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isStorefrontSaving}>
                  {isStorefrontSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {shopifySettings?.has_storefront_token
                    ? "Update Storefront Connection"
                    : "Connect Storefront API"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* Shopify Admin API - For Orders */}
        {isOwner && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  <CardTitle>Admin API (Orders)</CardTitle>
                </div>
                {shopifySettings?.has_admin_credentials && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                )}
              </div>
              <CardDescription>
                Connect your Shopify Admin API to sync orders and calculate profit
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleAdminSubmit}>
              <CardContent className="space-y-4">
                {!shopifySettings?.store_domain && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-700">
                      <strong>Note:</strong> Please connect your Storefront API first to set your store domain before configuring the Admin API.
                    </p>
                  </div>
                )}

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="instructions" className="border-blue-200">
                    <AccordionTrigger className="rounded-t-lg bg-blue-50 px-4 text-blue-800 hover:bg-blue-100 hover:no-underline">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <AlertCircle className="h-4 w-4" />
                        How to get your Admin API Access Token
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="rounded-b-lg border border-t-0 border-blue-200 bg-blue-50 px-4 pb-4">
                      <div className="space-y-4 pt-2">
                        <p className="text-sm text-blue-700">
                          The Admin API is used to sync your orders so you can calculate COGS and profit. You need to create a <strong>Custom App</strong> in your Shopify Admin to get an access token.
                        </p>
                        
                        <div className="rounded border border-blue-300 bg-blue-100 p-3">
                          <p className="text-xs font-medium text-blue-800">
                            The token you need starts with <code className="rounded bg-blue-200 px-1">shpat_</code> and comes from a Custom App in your Shopify Admin.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <h5 className="font-medium text-blue-800">Step 1: Enable Custom App Development</h5>
                          <ol className="list-inside list-decimal space-y-2 text-sm text-blue-700">
                            <li>
                              Go to your{" "}
                              <a
                                href={shopifySettings?.store_domain ? `https://${shopifySettings.store_domain}/admin/settings/apps` : "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-900 underline"
                              >
                                Shopify Admin &rarr; Settings &rarr; Apps and sales channels
                              </a>
                            </li>
                            <li>
                              Click <strong>Develop apps</strong> (top right)
                            </li>
                            <li>
                              If you see a banner saying custom app development is disabled, click <strong>Allow custom app development</strong> and confirm
                            </li>
                          </ol>
                        </div>

                        <Separator className="bg-blue-200" />

                        <div className="space-y-3">
                          <h5 className="font-medium text-blue-800">Step 2: Create a Custom App</h5>
                          <ol className="list-inside list-decimal space-y-2 text-sm text-blue-700">
                            <li>
                              Click <strong>Create an app</strong>
                            </li>
                            <li>
                              Name it something like <strong>&quot;CoffeeOS Orders&quot;</strong>
                            </li>
                            <li>
                              Click <strong>Create app</strong>
                            </li>
                          </ol>
                        </div>

                        <Separator className="bg-blue-200" />

                        <div className="space-y-3">
                          <h5 className="font-medium text-blue-800">Step 3: Configure Admin API Scopes</h5>
                          <ol className="list-inside list-decimal space-y-2 text-sm text-blue-700">
                            <li>
                              In your new app, click <strong>Configure Admin API scopes</strong>
                            </li>
                            <li>
                              Scroll down and find <strong>Orders</strong> section
                            </li>
                            <li>
                              Check <strong>read_orders</strong>
                            </li>
                            <li>
                              Click <strong>Save</strong> at the top right
                            </li>
                          </ol>
                        </div>

                        <Separator className="bg-blue-200" />

                        <div className="space-y-3">
                          <h5 className="font-medium text-blue-800">Step 4: Install and Get Token</h5>
                          <ol className="list-inside list-decimal space-y-2 text-sm text-blue-700">
                            <li>
                              Click <strong>Install app</strong> (top right) and confirm
                            </li>
                            <li>
                              After installing, you&apos;ll see the <strong>Admin API access token</strong> section
                            </li>
                            <li>
                              Click <strong>Reveal token once</strong>
                            </li>
                            <li>
                              <strong>Copy the entire token</strong> - it starts with <code className="rounded bg-blue-200 px-1">shpat_</code>
                            </li>
                          </ol>
                        </div>

                        <div className="rounded border border-red-300 bg-red-100 p-3">
                          <p className="text-xs font-medium text-red-800">
                            Warning: The token is only shown once! If you navigate away without copying it, you&apos;ll need to uninstall and reinstall the app to generate a new token.
                          </p>
                        </div>

                        <Separator className="bg-blue-200" />

                        <div className="space-y-3">
                          <h5 className="font-medium text-blue-800">Troubleshooting</h5>
                          <ul className="list-inside list-disc space-y-2 text-sm text-blue-700">
                            <li>
                              <strong>Don&apos;t see &quot;Develop apps&quot;?</strong> You need to be the store owner or have staff permissions for app development.
                            </li>
                            <li>
                              <strong>Token doesn&apos;t start with &quot;shpat_&quot;?</strong> Make sure you&apos;re copying the <strong>Admin API</strong> token, not the Storefront API token.
                            </li>
                            <li>
                              <strong>Already revealed the token?</strong> Go to the app, click <strong>Uninstall app</strong>, then reinstall it to generate a new token.
                            </li>
                            <li>
                              <strong>Getting &quot;access denied&quot; error?</strong> Make sure <strong>read_orders</strong> scope is enabled and the app is installed.
                            </li>
                          </ul>
                        </div>

                        <a
                          href="https://help.shopify.com/en/manual/apps/app-types/custom-apps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm font-medium text-blue-800 hover:underline"
                        >
                          View Shopify Custom Apps documentation
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="space-y-2">
                  <Label htmlFor="adminAccessToken">Admin API Access Token</Label>
                  <Input
                    id="adminAccessToken"
                    type="password"
                    placeholder={
                      shopifySettings?.has_admin_credentials
                        ? "Enter new token to update"
                        : "shpat_xxxxxxxxxxxxxxxxxxxxx"
                    }
                    value={adminData.adminAccessToken}
                    onChange={(e) =>
                      setAdminData({
                        ...adminData,
                        adminAccessToken: e.target.value,
                      })
                    }
                    disabled={!shopifySettings?.store_domain}
                    required={!shopifySettings?.has_admin_credentials}
                  />
                  <p className="text-xs text-muted-foreground">
                    {shopifySettings?.has_admin_credentials
                      ? "Leave empty to keep the existing token, or enter a new one to update"
                      : "The token from your Custom App (starts with shpat_)"}
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isAdminSaving || !shopifySettings?.store_domain}>
                  {isAdminSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {shopifySettings?.has_admin_credentials
                    ? "Update Admin API Connection"
                    : "Connect Admin API"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
