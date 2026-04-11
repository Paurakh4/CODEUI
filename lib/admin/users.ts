import connectDB from "@/lib/db"
import {
  USER_ROLES,
  resolveAccountStatus,
  resolveUserRole,
  type AccountStatus,
  type UserRole,
} from "@/lib/admin/rbac"
import { createAdminAuditEntry } from "@/lib/admin/audit"
import {
  ADMIN_USER_PAGE_SIZES,
  parseAdminUsersQuery,
  type AdminUserPageSize,
  type AdminUsersQuery,
} from "@/lib/admin/user-filters"
import { AdminAuditLog, Project, UsageLog, User } from "@/lib/models"
import {
  getMonthlyCreditsForTier,
  TIERS,
  type SubscriptionTier,
} from "@/lib/pricing"

export interface AdminUsersSummary {
  filteredUsers: number
  paidUsers: number
  suspendedUsers: number
  internalUsers: number
}

export interface AdminUserListItem {
  id: string
  name: string
  email: string
  image?: string
  role: UserRole
  accountStatus: AccountStatus
  tier: SubscriptionTier
  tierName: string
  monthlyCredits: number
  topupCredits: number
  availableCredits: number
  totalCreditsUsed: number
  projectCount: number
  lastActiveAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AdminUsersPage {
  users: AdminUserListItem[]
  pagination: {
    page: number
    pageSize: number
    totalUsers: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  summary: AdminUsersSummary
  filters: AdminUsersQuery
}

export interface AdminUserDetail {
  customer: {
    id: string
    name: string
    email: string
    image?: string
    role: UserRole
    accountStatus: AccountStatus
    adminNotes: string
    createdAt: Date
    updatedAt: Date
    creditsResetDate: Date
    subscription: {
      tier: SubscriptionTier
      tierName: string
      monthlyAllowance: number
      stripeCustomerId?: string
      stripeSubscriptionId?: string
      stripePriceId?: string
      currentPeriodEnd?: Date
    }
    credits: {
      monthlyCredits: number
      topupCredits: number
      availableCredits: number
      totalCreditsUsed: number
      legacyCredits: number
      creditsUsedThisMonth: number
    }
    preferences: {
      defaultModel: string
      enhancedPrompts: boolean
      privateProjectsByDefault: boolean
      marketingEmails: boolean
      productUpdates: boolean
    }
  }
  stats: {
    projectCount: number
    publicProjectCount: number
    totalPrompts: number
    prompts7d: number
    lastActiveAt: Date | null
  }
  topModels: Array<{
    modelId: string
    count: number
  }>
  recentProjects: Array<{
    id: string
    name: string
    emoji?: string
    isPrivate: boolean
    updatedAt: Date
    views: number
    likes: number
  }>
  recentUsage: Array<{
    id: string
    timestamp: Date
    aiModel: string
    promptType: string
    creditsCost: number
  }>
  recentAuditEvents: Array<{
    id: string
    action: string
    actorEmail: string
    actorRole: string
    reason?: string
    createdAt: Date
  }>
}

export interface AdminUserUpdateInput {
  role?: UserRole
  accountStatus?: AccountStatus
  subscriptionTier?: SubscriptionTier
  monthlyCredits?: number
  topupCredits?: number
  adminNotes?: string
  reason: string
}

interface AdminActor {
  id: string
  email?: string | null
  role: UserRole
}

const INTERNAL_USER_ROLES: UserRole[] = USER_ROLES.filter((role) => role !== "user")

export class AdminUserMutationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "AdminUserMutationError"
    this.status = status
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function snapshotUserForAudit(user: Awaited<ReturnType<typeof User.findById>>) {
  if (!user) {
    return null
  }

  return {
    role: resolveUserRole(user.role, user.email),
    accountStatus: resolveAccountStatus(user.accountStatus),
    subscriptionTier: user.subscription?.tier || "free",
    monthlyCredits: user.monthlyCredits ?? 0,
    topupCredits: user.topupCredits ?? 0,
    adminNotes: user.adminNotes || "",
  }
}

export async function getAdminUsersPage(
  filters: AdminUsersQuery,
): Promise<AdminUsersPage> {
  await connectDB()

  const filter: Record<string, unknown> = {}

  if (filters.search) {
    const searchRegex = new RegExp(escapeRegex(filters.search), "i")
    filter.$or = [{ name: searchRegex }, { email: searchRegex }]
  }

  if (filters.role !== "all") {
    filter.role = filters.role
  }

  if (filters.accountStatus !== "all") {
    filter.accountStatus = filters.accountStatus
  }

  if (filters.tier !== "all") {
    filter["subscription.tier"] = filters.tier
  }

  const totalUsersPromise = User.countDocuments(filter)
  const paidUsersPromise = User.countDocuments({
    ...filter,
    "subscription.tier": { $in: ["pro", "proplus"] },
  })
  const suspendedUsersPromise = User.countDocuments({
    ...filter,
    accountStatus: "suspended",
  })
  const internalUsersPromise = User.countDocuments({
    ...filter,
    role: { $in: INTERNAL_USER_ROLES },
  })

  const page = filters.page
  const pageSize = filters.pageSize
  const offset = (page - 1) * pageSize

  const users = await User.find(filter)
    .select(
      "name email image role accountStatus subscription.tier monthlyCredits topupCredits totalCreditsUsed createdAt updatedAt",
    )
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(pageSize)
    .lean()

  const userIds = users.map((user) => user._id)

  const [
    totalUsers,
    paidUsers,
    suspendedUsers,
    internalUsers,
    projectCountRows,
    lastUsageRows,
  ] = await Promise.all([
    totalUsersPromise,
    paidUsersPromise,
    suspendedUsersPromise,
    internalUsersPromise,
    userIds.length > 0
      ? Project.aggregate<{ _id: unknown; count: number }>([
          { $match: { userId: { $in: userIds } } },
          { $group: { _id: "$userId", count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
    userIds.length > 0
      ? UsageLog.aggregate<{ _id: unknown; lastActiveAt: Date }>([
          { $match: { userId: { $in: userIds } } },
          { $group: { _id: "$userId", lastActiveAt: { $max: "$timestamp" } } },
        ])
      : Promise.resolve([]),
  ])

  const projectCountMap = new Map(
    projectCountRows.map((row) => [row._id.toString(), row.count]),
  )
  const lastUsageMap = new Map(
    lastUsageRows.map((row) => [row._id.toString(), row.lastActiveAt]),
  )

  const normalizedUsers: AdminUserListItem[] = users.map((user) => {
    const role = resolveUserRole(user.role, user.email)
    const accountStatus = resolveAccountStatus(user.accountStatus)
    const tier = (user.subscription?.tier || "free") as SubscriptionTier
    const monthlyCredits = user.monthlyCredits ?? 0
    const topupCredits = user.topupCredits ?? 0

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      image: user.image || undefined,
      role,
      accountStatus,
      tier,
      tierName: TIERS[tier]?.name || "Free",
      monthlyCredits,
      topupCredits,
      availableCredits: monthlyCredits + topupCredits,
      totalCreditsUsed: user.totalCreditsUsed ?? 0,
      projectCount: projectCountMap.get(user._id.toString()) ?? 0,
      lastActiveAt: lastUsageMap.get(user._id.toString()) ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  })

  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize))

  return {
    users: normalizedUsers,
    pagination: {
      page,
      pageSize,
      totalUsers,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    summary: {
      filteredUsers: totalUsers,
      paidUsers,
      suspendedUsers,
      internalUsers,
    },
    filters,
  }
}

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail | null> {
  await connectDB()

  const user = await User.findById(userId)
    .select(
      "name email image role accountStatus adminNotes preferences subscription monthlyCredits topupCredits creditsResetDate totalCreditsUsed credits creditsUsedThisMonth createdAt updatedAt",
    )
    .lean()

  if (!user) {
    return null
  }

  const userObjectId = user._id
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [
    projectCount,
    publicProjectCount,
    recentProjects,
    totalPrompts,
    prompts7d,
    recentUsage,
    topModels,
    recentAuditEvents,
  ] = await Promise.all([
    Project.countDocuments({ userId: userObjectId }),
    Project.countDocuments({ userId: userObjectId, isPrivate: false }),
    Project.find({ userId: userObjectId })
      .select("_id name emoji isPrivate updatedAt views likes")
      .sort({ updatedAt: -1 })
      .limit(6)
      .lean(),
    UsageLog.countDocuments({ userId: userObjectId }),
    UsageLog.countDocuments({ userId: userObjectId, timestamp: { $gte: sevenDaysAgo } }),
    UsageLog.find({ userId: userObjectId })
      .select("timestamp aiModel promptType creditsCost")
      .sort({ timestamp: -1 })
      .limit(10)
      .lean(),
    UsageLog.aggregate<{ _id: string; count: number }>([
      { $match: { userId: userObjectId } },
      { $group: { _id: "$aiModel", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]),
    AdminAuditLog.find({ targetType: "user", targetId: user._id.toString() })
      .select("action actorEmail actorRole reason createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ])

  const role = resolveUserRole(user.role, user.email)
  const accountStatus = resolveAccountStatus(user.accountStatus)
  const tier = (user.subscription?.tier || "free") as SubscriptionTier
  const monthlyCredits = user.monthlyCredits ?? 0
  const topupCredits = user.topupCredits ?? 0

  return {
    customer: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      image: user.image || undefined,
      role,
      accountStatus,
      adminNotes: user.adminNotes || "",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      creditsResetDate: user.creditsResetDate,
      subscription: {
        tier,
        tierName: TIERS[tier]?.name || "Free",
        monthlyAllowance: TIERS[tier]?.monthlyCredits || 20,
        stripeCustomerId: user.subscription?.stripeCustomerId,
        stripeSubscriptionId: user.subscription?.stripeSubscriptionId,
        stripePriceId: user.subscription?.stripePriceId,
        currentPeriodEnd: user.subscription?.currentPeriodEnd,
      },
      credits: {
        monthlyCredits,
        topupCredits,
        availableCredits: monthlyCredits + topupCredits,
        totalCreditsUsed: user.totalCreditsUsed ?? 0,
        legacyCredits: user.credits ?? monthlyCredits + topupCredits,
        creditsUsedThisMonth: user.creditsUsedThisMonth ?? 0,
      },
      preferences: {
        defaultModel: user.preferences?.defaultModel || "",
        enhancedPrompts: Boolean(user.preferences?.enhancedPrompts),
        privateProjectsByDefault: Boolean(
          user.preferences?.privacyPreferences?.privateProjectsByDefault,
        ),
        marketingEmails: Boolean(
          user.preferences?.contactPreferences?.marketingEmails,
        ),
        productUpdates: Boolean(
          user.preferences?.contactPreferences?.productUpdates,
        ),
      },
    },
    stats: {
      projectCount,
      publicProjectCount,
      totalPrompts,
      prompts7d,
      lastActiveAt: recentUsage[0]?.timestamp ?? null,
    },
    topModels: topModels.map((model) => ({
      modelId: model._id,
      count: model.count,
    })),
    recentProjects: recentProjects.map((project) => ({
      id: project._id.toString(),
      name: project.name,
      emoji: project.emoji,
      isPrivate: Boolean(project.isPrivate),
      updatedAt: project.updatedAt,
      views: project.views,
      likes: project.likes,
    })),
    recentUsage: recentUsage.map((entry) => ({
      id: entry._id.toString(),
      timestamp: entry.timestamp,
      aiModel: entry.aiModel,
      promptType: entry.promptType,
      creditsCost: entry.creditsCost,
    })),
    recentAuditEvents: recentAuditEvents.map((entry) => ({
      id: entry._id.toString(),
      action: entry.action,
      actorEmail: entry.actorEmail,
      actorRole: entry.actorRole,
      reason: entry.reason,
      createdAt: entry.createdAt,
    })),
  }
}

export async function updateAdminUserById(input: {
  userId: string
  actor: AdminActor
  changes: AdminUserUpdateInput
}) {
  await connectDB()

  const user = await User.findById(input.userId)
  if (!user) {
    throw new AdminUserMutationError("User not found", 404)
  }

  const targetRole = resolveUserRole(user.role, user.email)

  if (user._id.toString() === input.actor.id) {
    throw new AdminUserMutationError(
      "Editing your own admin account is disabled in this first management slice.",
      403,
    )
  }

  if (targetRole === "owner" && input.actor.role !== "owner") {
    throw new AdminUserMutationError(
      "Only an owner can modify an owner account.",
      403,
    )
  }

  if (input.changes.role === "owner" && input.actor.role !== "owner") {
    throw new AdminUserMutationError(
      "Only an owner can assign the owner role.",
      403,
    )
  }

  const before = snapshotUserForAudit(user)
  let monthlyCreditsChanged = false
  let topupCreditsChanged = false

  if (input.changes.role !== undefined) {
    user.role = input.changes.role
  }

  if (input.changes.accountStatus !== undefined) {
    user.accountStatus = input.changes.accountStatus
  }

  if (input.changes.subscriptionTier !== undefined) {
    user.subscription = {
      ...user.subscription,
      tier: input.changes.subscriptionTier,
    }

    if (input.changes.monthlyCredits === undefined) {
      user.monthlyCredits = getMonthlyCreditsForTier(input.changes.subscriptionTier)
      monthlyCreditsChanged = true
    }
  }

  if (input.changes.monthlyCredits !== undefined) {
    user.monthlyCredits = input.changes.monthlyCredits
    monthlyCreditsChanged = true
  }

  if (input.changes.topupCredits !== undefined) {
    user.topupCredits = input.changes.topupCredits
    topupCreditsChanged = true
  }

  if (input.changes.adminNotes !== undefined) {
    user.adminNotes = input.changes.adminNotes.trim()
  }

  if (monthlyCreditsChanged || topupCreditsChanged || input.changes.subscriptionTier !== undefined) {
    user.credits = (user.monthlyCredits ?? 0) + (user.topupCredits ?? 0)
  }

  await user.save()

  const after = snapshotUserForAudit(user)

  await createAdminAuditEntry({
    actorUserId: input.actor.id,
    actorEmail: input.actor.email || "unknown@local",
    actorRole: input.actor.role,
    action: "admin.user.updated",
    permission: "admin:manage-users",
    targetType: "user",
    targetId: user._id.toString(),
    reason: input.changes.reason,
    before: before || undefined,
    after: after || undefined,
    metadata: {
      updatedFields: Object.keys(input.changes).filter((field) => field !== "reason"),
    },
  })

  const detail = await getAdminUserDetail(user._id.toString())
  if (!detail) {
    throw new AdminUserMutationError("Updated user could not be reloaded", 500)
  }

  return detail
}