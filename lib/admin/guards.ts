import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  ADMIN_PERMISSIONS,
  canAccessAdminPortal,
  getPermissionsForRole,
  hasAdminPermission,
  resolveAccountStatus,
  resolveUserRole,
  type AccountStatus,
  type AdminPermission,
  type UserRole,
} from "@/lib/admin/rbac"

export interface AuthorizedAdminUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  role: UserRole
  accountStatus: AccountStatus
  permissions: AdminPermission[]
}

export interface AuthorizedAdminSession {
  user: AuthorizedAdminUser
}

function normalizePermissions(value: unknown, role: UserRole): AdminPermission[] {
  const sessionPermissions = Array.isArray(value)
    ? value.filter((permission): permission is AdminPermission =>
        ADMIN_PERMISSIONS.includes(permission as AdminPermission),
      )
    : []

  if (sessionPermissions.length > 0) {
    return sessionPermissions
  }

  return getPermissionsForRole(role)
}

function normalizeAdminSession(
  session: Awaited<ReturnType<typeof auth>>,
): AuthorizedAdminSession | null {
  if (!session?.user?.id) {
    return null
  }

  const role = resolveUserRole(session.user.role, session.user.email)

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      role,
      accountStatus: resolveAccountStatus(session.user.accountStatus),
      permissions: normalizePermissions(session.user.permissions, role),
    },
  }
}

export async function requireAdminRoute(
  permission: AdminPermission = "admin:view-overview",
) {
  const session = normalizeAdminSession(await auth())

  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const
  }

  if (session.user.accountStatus !== "active") {
    return {
      response: NextResponse.json({ error: "Account suspended" }, { status: 403 }),
    } as const
  }

  if (
    !canAccessAdminPortal(session.user.role) ||
    !hasAdminPermission({
      role: session.user.role,
      permission,
      resolvedPermissions: session.user.permissions,
    })
  ) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const
  }

  return { session } as const
}

export async function requireAdminPage(
  permission: AdminPermission = "admin:view-overview",
): Promise<AuthorizedAdminSession> {
  const session = normalizeAdminSession(await auth())

  if (!session) {
    redirect("/auth/signin")
  }

  if (
    session.user.accountStatus !== "active" ||
    !canAccessAdminPortal(session.user.role) ||
    !hasAdminPermission({
      role: session.user.role,
      permission,
      resolvedPermissions: session.user.permissions,
    })
  ) {
    redirect("/auth/error?error=AccessDenied")
  }

  return session
}