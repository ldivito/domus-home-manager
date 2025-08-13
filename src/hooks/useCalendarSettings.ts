'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'

export function useCalendarSettings() {
  const homeSettings = useLiveQuery(() => 
    db.homeSettings.orderBy('lastUpdated').last()
  )

  const startOfWeek = homeSettings?.preferences?.startOfWeek || 'sunday'
  
  return {
    startOfWeek,
    homeSettings
  }
}