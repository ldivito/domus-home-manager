"use client"

import { CalendarEvent, User } from "@/lib/db"
import { Pencil, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type PlannerSource = 'calendar' | 'task' | 'meal' | 'chore' | 'reminder'

interface EventPillProps {
  event: CalendarEvent
  source: PlannerSource
  typeLabel?: string
  usersById: Record<string, User>
  onView: (payload: { event: CalendarEvent; source: PlannerSource }) => void
  onEdit: (payload: { event: CalendarEvent; source: PlannerSource }) => void
  compact?: boolean
  hideEdit?: boolean
}

const stripeColors: Record<PlannerSource, string> = {
  calendar: "before:bg-slate-400",
  task: "before:bg-blue-500",
  meal: "before:bg-amber-500",
  chore: "before:bg-emerald-500",
  reminder: "before:bg-violet-500",
}

export function EventPill({ event, source, typeLabel, usersById, onView, onEdit, compact, hideEdit }: EventPillProps) {
  const assignedNames = (event.userIds || []).map(id => usersById[id]?.name).filter(Boolean)
  const hasUsers = assignedNames.length > 0
  return (
    <button
      type="button"
      onClick={() => onView({ event, source })}
      className={cn(
        "relative w-full text-left group rounded-xl border bg-card/80 backdrop-blur-sm px-3 py-2 shadow-modern hover:shadow-modern-lg transition-all",
        "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:rounded-l-xl",
        stripeColors[source],
        compact ? "py-1.5 px-2.5 rounded-lg" : "py-2.5 px-3"
      )}
    >
      <div className={cn("flex items-center gap-2", compact && "gap-1")}> 
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", compact && "h-4 text-[9px]")}> 
          <Clock className={cn("h-3 w-3 mr-1", compact && "h-2.5 w-2.5 mr-0.5")} />
          {event.time || "All day"}
        </Badge>
        {!compact && (
          <Badge variant="secondary" className="ml-auto h-5 text-[10px] px-1.5 py-0 capitalize">{typeLabel ?? event.type}</Badge>
        )}
      </div>
      <div className={cn("mt-1 font-medium truncate", compact && "text-xs mt-0.5")}>{event.title}</div>
      {event.description && !compact && (
        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{event.description}</div>
      )}
      {hasUsers && !compact && (
        <div className="mt-1 flex items-center gap-1.5">
          {(event.userIds || []).slice(0, 5).map((id) => (
            <span key={id} className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: usersById[id]?.color }} />
          ))}
          {assignedNames.length > 5 && (
            <span className="text-[10px] text-muted-foreground">+{assignedNames.length - 5}</span>
          )}
        </div>
      )}
      {!hideEdit && (
        <div className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit({ event, source }) }}
            className="inline-flex items-center justify-center rounded-md border bg-background/80 hover:bg-background text-foreground shadow-xs h-6 w-6"
            aria-label="Edit event"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </button>
  )
}


