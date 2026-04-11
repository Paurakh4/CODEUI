import { isAdminUser, isStaffUser } from "@/lib/pricing"

export const USER_ROLES = [
  "user",
  "support",
  "finance",
  "moderator",
  "admin",
  "owner",
] as const

export type UserRole = (typeof USER_ROLES)[number]

export const ACCOUNT_STATUSES = ["active", "suspended"] as const

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export const ADMIN_PERMISSIONS = [
  "admin:access",
  "admin:view-overview",
  "admin:view-customers",
  "admin:view-projects",
  "admin:view-billing",
  "admin:view-models",
  "admin:view-audit",
  "admin:manage-users",
  "admin:manage-projects",
  "admin:manage-billing",
  "admin:manage-models",
  "admin:manage-settings",
] as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

const ADMIN_PERMISSION_SET = new Set<string>(ADMIN_PERMISSIONS)

const ROLE_PERMISSIONS: Record<UserRole, readonly AdminPermission[]> = {
  user: [],
  support: [
    "admin:access",
    "admin:view-overview",
    "admin:view-customers",
    "admin:view-projects",
  ],
  finance: [
    "admin:access",
    "admin:view-overview",
    "admin:view-customers",
    "admin:view-billing",
  ],
  moderator: [
    "admin:access",
    "admin:view-overview",
    "admin:view-customers",
    "admin:view-projects",
    "admin:manage-projects",
  ],
  admin: [...ADMIN_PERMISSIONS],
  owner: [...ADMIN_PERMISSIONS],
}

function normalizeAdminPermission(permission: string): AdminPermission | null {
  const normalized = permission.trim()
  if (!ADMIN_PERMISSION_SET.has(normalized)) {
    return null
  }

  return normalized as AdminPermission
}

export function resolveUserRole(inputRole?: string | null, email?: string | null): UserRole {
  const normalizedRole = inputRole?.toLowerCase().trim()

  if (normalizedRole && USER_ROLES.includes(normalizedRole as UserRole)) {
    if (normalizedRole === "user" && email && isAdminUser(email)) {
      return "owner"
    }

    return normalizedRole as UserRole
  }

  if (email && isAdminUser(email)) {
    return "owner"
  }

  if (email && isStaffUser(email)) {
    return "support"
  }

  return "user"
}

export function resolveAccountStatus(inputStatus?: string | null): AccountStatus {
  const normalizedStatus = inputStatus?.toLowerCase().trim()
  return normalizedStatus === "suspended" ? "suspended" : "active"
}

export function getPermissionsForRole(
  role?: string | null,
  overrides?: readonly string[] | null,
): AdminPermission[] {
  const resolvedRole = resolveUserRole(role)
  const mergedPermissions = new Set<AdminPermission>(ROLE_PERMISSIONS[resolvedRole])

  overrides?.forEach((permission) => {
    const normalized = normalizeAdminPermission(permission)
    if (normalized) {
      mergedPermissions.add(normalized)
    }
  })

  return Array.from(mergedPermissions)
}

export function resolveAdminAccess(input: {
  email?: string | null
  role?: string | null
  accountStatus?: string | null
  permissionOverrides?: readonly string[] | null
}) {
  const role = resolveUserRole(input.role, input.email)

  return {
    role,
    accountStatus: resolveAccountStatus(input.accountStatus),
    permissions: getPermissionsForRole(role, input.permissionOverrides),
  }
}

export function canAccessAdminPortal(role?: string | null): boolean {
  return resolveUserRole(role) !== "user"
}

export function isAdminRole(role?: string | null): boolean {
  const resolvedRole = resolveUserRole(role)
  return resolvedRole === "admin" || resolvedRole === "owner"
}

export function isInternalUserRole(role?: string | null): boolean {
  return canAccessAdminPortal(role)
}

export function hasAdminPermission(input: {
  role?: string | null
  permission: AdminPermission
  permissionOverrides?: readonly string[] | null
  resolvedPermissions?: readonly AdminPermission[] | null
}): boolean {
  const permissions = input.resolvedPermissions
    ? Array.from(input.resolvedPermissions)
    : getPermissionsForRole(input.role, input.permissionOverrides)

  return permissions.includes(input.permission)
}