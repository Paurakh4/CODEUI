"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import type { SubscriptionTier } from "@/lib/pricing"

export interface LiveCreditsSnapshot {
  monthlyCredits: number
  topupCredits: number
  totalCredits: number
  tier?: SubscriptionTier
}

interface UseLiveCreditsOptions {
  enabled?: boolean
  refreshIntervalMs?: number
}

type SessionUserLike = {
  monthlyCredits?: number
  topupCredits?: number
  totalCredits?: number
  subscription?: string
} | null | undefined

function normalizeSessionCredits(user: SessionUserLike): LiveCreditsSnapshot | null {
  if (!user) {
    return null
  }

  const monthlyCredits = user.monthlyCredits ?? 0
  const topupCredits = user.topupCredits ?? 0

  return {
    monthlyCredits,
    topupCredits,
    totalCredits: user.totalCredits ?? monthlyCredits + topupCredits,
    tier: user.subscription as SubscriptionTier | undefined,
  }
}

function areCreditsEqual(
  left: LiveCreditsSnapshot | null | undefined,
  right: LiveCreditsSnapshot | null | undefined,
): boolean {
  if (!left || !right) {
    return left === right
  }

  return (
    left.monthlyCredits === right.monthlyCredits &&
    left.topupCredits === right.topupCredits &&
    left.totalCredits === right.totalCredits &&
    left.tier === right.tier
  )
}

function getCreditsSignature(snapshot: LiveCreditsSnapshot | null | undefined): string | null {
  if (!snapshot) {
    return null
  }

  return [snapshot.monthlyCredits, snapshot.topupCredits, snapshot.totalCredits, snapshot.tier ?? "free"].join(":")
}

export function useLiveCredits(options: UseLiveCreditsOptions = {}) {
  const { enabled = true, refreshIntervalMs = 30_000 } = options
  const { data: session, status, update: updateSession } = useSession()
  const sessionCredits = useMemo(
    () => normalizeSessionCredits(session?.user as SessionUserLike),
    [session?.user],
  )
  const [liveCredits, setLiveCredits] = useState<LiveCreditsSnapshot | null>(sessionCredits)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const syncInFlightRef = useRef(false)
  const requestedSessionSyncSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      setLiveCredits(null)
      requestedSessionSyncSignatureRef.current = null
      return
    }

    if (!sessionCredits) {
      return
    }

    setLiveCredits((current) => (areCreditsEqual(current, sessionCredits) ? current ?? sessionCredits : sessionCredits))

    const sessionSignature = getCreditsSignature(sessionCredits)
    if (requestedSessionSyncSignatureRef.current && requestedSessionSyncSignatureRef.current === sessionSignature) {
      requestedSessionSyncSignatureRef.current = null
    }
  }, [sessionCredits, status])

  const refreshCredits = useCallback(async () => {
    if (!enabled || status !== "authenticated") {
      return sessionCredits
    }

    try {
      setIsRefreshing(true)

      const response = await fetch("/api/user/credits", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data || data.error) {
        throw new Error(data?.error || "Failed to fetch credits")
      }

      const nextCredits: LiveCreditsSnapshot = {
        monthlyCredits: data.monthlyCredits ?? 0,
        topupCredits: data.topupCredits ?? 0,
        totalCredits: data.totalCredits ?? ((data.monthlyCredits ?? 0) + (data.topupCredits ?? 0)),
        tier: data.tier,
      }

      setLiveCredits((current) => (areCreditsEqual(current, nextCredits) ? current ?? nextCredits : nextCredits))

      if (sessionCredits && !areCreditsEqual(sessionCredits, nextCredits) && !syncInFlightRef.current) {
        const nextSignature = getCreditsSignature(nextCredits)
        if (requestedSessionSyncSignatureRef.current !== nextSignature) {
          requestedSessionSyncSignatureRef.current = nextSignature
          syncInFlightRef.current = true
          void Promise.resolve(updateSession())
            .catch((error) => {
              console.error("Failed to refresh session credits:", error)
            })
            .finally(() => {
              syncInFlightRef.current = false
            })
        }
      }

      return nextCredits
    } catch (error) {
      console.error("Failed to fetch live credits:", error)
      return liveCredits ?? sessionCredits
    } finally {
      setIsRefreshing(false)
    }
  }, [enabled, liveCredits, sessionCredits, status, updateSession])

  useEffect(() => {
    if (!enabled || status !== "authenticated") {
      return
    }

    void refreshCredits()
  }, [enabled, refreshCredits, status])

  useEffect(() => {
    if (!enabled || status !== "authenticated") {
      return
    }

    const handleFocus = () => {
      void refreshCredits()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshCredits()
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, refreshCredits, status])

  useEffect(() => {
    if (!enabled || status !== "authenticated" || refreshIntervalMs <= 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshCredits()
    }, refreshIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [enabled, refreshCredits, refreshIntervalMs, status])

  return {
    credits: liveCredits ?? sessionCredits,
    isRefreshing,
    refreshCredits,
  }
}