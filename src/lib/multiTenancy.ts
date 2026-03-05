/**
 * FUND-21: Multi-tenancy preparation — org-level sharing infrastructure.
 * Provides organization context, role-based access control types,
 * and helper functions for future team/org features.
 */

export type OrgRole = "owner" | "admin" | "editor" | "viewer";

export interface OrgMember {
  userId: string;
  email: string;
  displayName: string;
  role: OrgRole;
  joinedAt: string;
  lastActiveAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  members: OrgMember[];
  settings: OrgSettings;
}

export interface OrgSettings {
  /** Allow members to invite others */
  allowMemberInvites: boolean;
  /** Default role for new members */
  defaultRole: OrgRole;
  /** Require 2FA for all members */
  require2FA: boolean;
  /** Shared property access level */
  propertyAccessLevel: "all" | "assigned" | "none";
}

/** FUND-21: Role permission matrix */
const ROLE_PERMISSIONS: Record<OrgRole, Set<string>> = {
  owner: new Set([
    "org.manage", "org.delete", "org.billing",
    "members.invite", "members.remove", "members.role",
    "properties.create", "properties.edit", "properties.delete", "properties.view",
    "tenants.manage", "loans.manage", "documents.manage",
    "reports.view", "reports.export", "settings.manage",
  ]),
  admin: new Set([
    "members.invite", "members.remove", "members.role",
    "properties.create", "properties.edit", "properties.delete", "properties.view",
    "tenants.manage", "loans.manage", "documents.manage",
    "reports.view", "reports.export", "settings.manage",
  ]),
  editor: new Set([
    "properties.create", "properties.edit", "properties.view",
    "tenants.manage", "loans.manage", "documents.manage",
    "reports.view", "reports.export",
  ]),
  viewer: new Set([
    "properties.view",
    "reports.view",
  ]),
};

/**
 * FUND-21: Check if a role has a specific permission.
 */
export function hasPermission(role: OrgRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * FUND-21: Get all permissions for a role.
 */
export function getPermissions(role: OrgRole): string[] {
  return Array.from(ROLE_PERMISSIONS[role] ?? []);
}

/**
 * FUND-21: Check if roleA can manage roleB (higher or equal rank).
 */
export function canManageRole(managerRole: OrgRole, targetRole: OrgRole): boolean {
  const hierarchy: Record<OrgRole, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };
  return hierarchy[managerRole] > hierarchy[targetRole];
}

/**
 * FUND-21: Generate a unique org slug from name.
 */
export function generateOrgSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/**
 * FUND-21: Default org settings for new organizations.
 */
export function getDefaultOrgSettings(): OrgSettings {
  return {
    allowMemberInvites: false,
    defaultRole: "viewer",
    require2FA: false,
    propertyAccessLevel: "assigned",
  };
}
