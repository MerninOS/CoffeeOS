"use client";

import React from "react"

import { useState, useEffect } from "react";
import {
  inviteTeamMember,
  getTeamMembers,
  getPendingInvitations,
  updateTeamMemberRole,
  removeTeamMember,
  cancelInvitation,
} from "./team-actions";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CheckCircle2,
  Crown,
  Loader2,
  Mail,
  Shield,
  Flame,
  Trash2,
  UserPlus,
  Users,
  Clock,
  X,
} from "lucide-react";

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface TeamManagementProps {
  currentUserId: string;
  isOwner: boolean;
}

export function TeamManagement({ currentUserId, isOwner }: TeamManagementProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "roaster">("roaster");
  const [isInviting, setIsInviting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadTeamData = async () => {
    setIsLoading(true);
    const [membersResult, invitationsResult] = await Promise.all([
      getTeamMembers(),
      getPendingInvitations(),
    ]);

    if (membersResult.members) {
      setMembers(membersResult.members);
    }
    if (invitationsResult.invitations) {
      setInvitations(invitationsResult.invitations);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTeamData();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    setMessage(null);

    const result = await inviteTeamMember(inviteEmail.trim(), inviteRole);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message || "Invitation sent" });
      setInviteEmail("");
      loadTeamData();
    }

    setIsInviting(false);
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "roaster") => {
    setMessage(null);
    const result = await updateTeamMemberRole(memberId, newRole);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Role updated successfully" });
      loadTeamData();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setMessage(null);
    const result = await removeTeamMember(memberId);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Team member removed" });
      loadTeamData();
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setMessage(null);
    const result = await cancelInvitation(invitationId);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Invitation cancelled" });
      loadTeamData();
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-3.5 w-3.5" />;
      case "admin":
        return <Shield className="h-3.5 w-3.5" />;
      case "roaster":
        return <Flame className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default" as const;
      case "admin":
        return "secondary" as const;
      case "roaster":
        return "outline" as const;
      default:
        return "outline" as const;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "owner":
        return "Full access to everything";
      case "admin":
        return "Full access to all features";
      case "roaster":
        return "Roasting & Inventory only";
      default:
        return "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <CardTitle>Team Members</CardTitle>
        </div>
        <CardDescription>
          Manage who has access to your CoffeeOS workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        {/* Current Team Members */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Current Members</h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No team members yet
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {(member.first_name?.[0] || "").toUpperCase()}
                      {(member.last_name?.[0] || "").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.first_name} {member.last_name}
                        {member.id === currentUserId && (
                          <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      {member.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.role === "owner" || member.id === currentUserId ? (
                      <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
                        {getRoleIcon(member.role)}
                        <span className="capitalize">{member.role}</span>
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        {isOwner ? (
                          <Select
                            value={member.role}
                            onValueChange={(value) =>
                              handleRoleChange(member.id, value as "admin" | "roaster")
                            }
                          >
                            <SelectTrigger className="h-8 w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-1.5">
                                  <Shield className="h-3 w-3" />
                                  Admin
                                </span>
                              </SelectItem>
                              <SelectItem value="roaster">
                                <span className="flex items-center gap-1.5">
                                  <Flame className="h-3 w-3" />
                                  Roaster
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
                            {getRoleIcon(member.role)}
                            <span className="capitalize">{member.role}</span>
                          </Badge>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remove member</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {member.first_name} {member.last_name} from
                                your team. They will no longer have access to your workspace
                                data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-transparent">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveMember(member.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Pending Invitations</h3>
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between rounded-lg border border-dashed p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed bg-muted/50">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{invitation.email}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          Expires{" "}
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 capitalize">
                      {getRoleIcon(invitation.role)}
                      {invitation.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleCancelInvitation(invitation.id)}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Cancel invitation</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role Legend */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="mb-2 text-sm font-medium">Role Permissions</h4>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3 w-3" />
                Admin
              </Badge>
              <span className="text-muted-foreground">{getRoleDescription("admin")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="gap-1">
                <Flame className="h-3 w-3" />
                Roaster
              </Badge>
              <span className="text-muted-foreground">{getRoleDescription("roaster")}</span>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Invite Form */}
      <CardFooter>
        <form onSubmit={handleInvite} className="flex w-full flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Label htmlFor="inviteEmail" className="sr-only">
              Email address
            </Label>
            <Input
              id="inviteEmail"
              type="email"
              placeholder="team@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <Select
            value={inviteRole}
            onValueChange={(value) => setInviteRole(value as "admin" | "roaster")}
          >
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="roaster">Roaster</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={isInviting || !inviteEmail.trim()}>
            {isInviting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Invite
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
