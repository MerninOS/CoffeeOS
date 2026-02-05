"use client";

import React from "react";

import { useState } from "react";
import { updateProfile } from "./actions";
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
import { Badge } from "@/components/ui/badge";
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

interface SettingsClientProps {
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  isOwner: boolean;
  shopifySettings: {
    store_domain: string;
    shop_name?: string;
    connected_via_oauth?: boolean;
    oauth_scope?: string;
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
  const [storeDomain, setStoreDomain] = useState("");
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
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

  const handleConnectShopify = () => {
    if (!storeDomain.trim()) {
      setMessage({ type: "error", text: "Please enter your Shopify store domain" });
      return;
    }

    setIsConnecting(true);
    setMessage(null);

    // Clean up the domain
    let cleanDomain = storeDomain.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, "");
    cleanDomain = cleanDomain.replace(/\/$/, "");
    
    // If it doesn't have .myshopify.com, add it
    if (!cleanDomain.includes(".myshopify.com")) {
      cleanDomain = `${cleanDomain}.myshopify.com`;
    }

    // Redirect to OAuth auth endpoint
    window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(cleanDomain)}`;
  };

  const handleDisconnectShopify = async () => {
    setIsDisconnecting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/shopify/disconnect", {
        method: "POST",
      });

      const result = await response.json();

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Shopify store disconnected successfully" });
        // Reload the page to reflect the changes
        window.location.reload();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect Shopify store" });
    }

    setIsDisconnecting(false);
  };

  const isShopifyConnected = shopifySettings?.connected_via_oauth && shopifySettings?.has_admin_credentials;

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

        {/* Shopify Connection */}
        {isOwner && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  <CardTitle>Shopify Store</CardTitle>
                </div>
                {isShopifyConnected && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                )}
              </div>
              <CardDescription>
                Connect your Shopify store to sync products and orders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isShopifyConnected ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {shopifySettings?.shop_name || shopifySettings?.store_domain}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {shopifySettings?.store_domain}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Badge variant="secondary" className="text-xs">
                            Products API
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Orders API
                          </Badge>
                        </div>
                      </div>
                      <a
                        href={`https://${shopifySettings?.store_domain}/admin`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-700">
                      <strong>Connected via Shopify App.</strong> Your store is connected through the official Shopify OAuth flow. 
                      You can manage this app&apos;s access from your{" "}
                      <a
                        href={`https://${shopifySettings?.store_domain}/admin/settings/apps`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline"
                      >
                        Shopify Admin
                      </a>
                      .
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h4 className="font-medium text-blue-800">Connect Your Shopify Store</h4>
                    <p className="mt-1 text-sm text-blue-700">
                      CoffeeOS needs access to your Shopify store to sync products and orders. 
                      Enter your store domain below and click connect to authorize the app.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeDomain">Store Domain</Label>
                    <div className="flex gap-2">
                      <Input
                        id="storeDomain"
                        placeholder="your-store or your-store.myshopify.com"
                        value={storeDomain}
                        onChange={(e) => setStoreDomain(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter your Shopify store name (e.g., &quot;my-coffee-shop&quot;) or full domain
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              {isShopifyConnected ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Unplug className="mr-2 h-4 w-4" />
                      Disconnect Store
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Shopify Store?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the connection to your Shopify store. You won&apos;t be able to sync products or orders until you reconnect.
                        Your existing data will be preserved.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-transparent">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnectShopify}
                        disabled={isDisconnecting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDisconnecting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Unplug className="mr-2 h-4 w-4" />
                        )}
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={handleConnectShopify} disabled={isConnecting || !storeDomain.trim()}>
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Store className="mr-2 h-4 w-4" />
                  )}
                  Connect to Shopify
                </Button>
              )}
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
