import type { CalendarEvent } from "@/lib/db"

export type PlannerSource = 'calendar' | 'task' | 'meal' | 'chore' | 'reminder'

export interface PlannerItem {
  source: PlannerSource
  typeLabel?: string
  hideEdit?: boolean
  event: CalendarEvent
}


