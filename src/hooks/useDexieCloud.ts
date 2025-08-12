"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/db"
import type { DXCWebSocketStatus, SyncState, UserLogin } from "dexie-cloud-addon"

export function useDexieCloud() {
  const [currentUser, setCurrentUser] = useState<UserLogin | null>(null)
  const [webSocketStatus, setWebSocketStatus] = useState<DXCWebSocketStatus>(
    "not-started"
  )
  const [syncState, setSyncState] = useState<SyncState | null>(() => {
    const cloud = (db as unknown as { cloud?: { syncState: { value: SyncState } } }).cloud
    return cloud?.syncState?.value ?? null
  })

  useEffect(() => {
    // If cloud features are unavailable (offline DB), don't try to access them
    const cloud = (db as unknown as { cloud?: {
      currentUser: { value: UserLogin; subscribe: (cb: (u: UserLogin) => void) => { unsubscribe: () => void } }
      webSocketStatus: { value: DXCWebSocketStatus; subscribe: (cb: (s: DXCWebSocketStatus) => void) => { unsubscribe: () => void } }
      syncState: { value: SyncState; subscribe: (cb: (s: SyncState) => void) => { unsubscribe: () => void } }
    } }).cloud
    if (!cloud) return

    // Initialize
    setCurrentUser(cloud.currentUser.value)
    setWebSocketStatus(cloud.webSocketStatus.value)
    setSyncState(cloud.syncState.value)

    // Subscribe to BehaviorSubjects from Dexie Cloud
    const currentUserSub = cloud.currentUser.subscribe((u: UserLogin) => setCurrentUser(u))
    const wsSub = cloud.webSocketStatus.subscribe((s: DXCWebSocketStatus) => setWebSocketStatus(s))
    const syncSub = cloud.syncState.subscribe((s: SyncState) => setSyncState(s))

    return () => {
      currentUserSub?.unsubscribe?.()
      wsSub?.unsubscribe?.()
      syncSub?.unsubscribe?.()
    }
  }, [])

  return { currentUser, webSocketStatus, syncState }
}


