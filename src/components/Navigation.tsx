'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import {
  Home,
  CheckSquare,
  ShoppingCart,
  Calendar,
  List,
  Hammer,
  UtensilsCrossed,
  Bell,
  Users,
  Settings,
  ChevronRight,
  ChevronLeft,
  Heart
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './ThemeToggle'
import LanguageSelector from './LanguageSelector'
import SyncStatus from './SyncStatus'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'

export default function Navigation() {
  const [isExpanded, setIsExpanded] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('navigation')
  
  // Get household/home name from database
  const homeSettings = useLiveQuery(() => db.homeSettings.orderBy('lastUpdated').last())
  const householdName = homeSettings?.homeName || 'Home'

  const navigationItems = [
    { nameKey: 'chores', href: '/chores', icon: CheckSquare },
    { nameKey: 'grocery', href: '/grocery', icon: ShoppingCart },
    { nameKey: 'meals', href: '/meals', icon: UtensilsCrossed },
    { nameKey: 'keto', href: '/keto', icon: Heart },
    { nameKey: 'planner', href: '/planner', icon: Calendar },
    { nameKey: 'tasks', href: '/tasks', icon: List },
    { nameKey: 'projects', href: '/projects', icon: Hammer },
    { nameKey: 'reminders', href: '/reminders', icon: Bell },
    { nameKey: 'users', href: '/users', icon: Users },
    { nameKey: 'settings', href: '/settings', icon: Settings },
  ]

  return (
    <nav aria-label="Sidebar" className={cn(
      "bg-card/50 backdrop-blur-xl border-r border-border/50 h-full flex flex-col shadow-modern transition-all duration-300",
      isExpanded ? "w-64" : "w-16"
    )}>
      {/* Header with expand/collapse toggle */}
      <div className={cn("border-b border-border/50", isExpanded ? "p-3" : "p-2")}>        
        {isExpanded ? (
          <div className="flex flex-col gap-2 min-w-0">
            <Link href="/" className="flex items-center gap-3 min-w-0" aria-label="Go to home">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <Home className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold text-foreground truncate">
                {householdName}
              </h1>
            </Link>
            <button
              onClick={() => setIsExpanded(false)}
              className="self-end p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors duration-200"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              aria-expanded={true}
            >
              <ChevronLeft className="h-4 w-4 mx-auto" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Link href="/" className="flex items-center justify-center" aria-label="Go to home">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Home className="h-4 w-4 text-primary-foreground" />
              </div>
            </Link>
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center justify-center p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors duration-200"
              title="Expand sidebar"
              aria-label="Expand sidebar"
              aria-expanded={false}
            >
              <ChevronRight className="h-4 w-4 mx-auto" />
            </button>
          </div>
        )}
      </div>
      
      {/* Navigation Items */}
      <div className="flex-1 py-3 px-2">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            
            return (
              <li key={item.nameKey}>
                <div className="relative group">
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                      isExpanded ? 'gap-3 px-2.5' : 'justify-center px-2',
                      'hover:bg-muted/80 hover:scale-[1.02] active:scale-[0.98]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-modern hover:bg-primary/90'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 transition-colors duration-200 flex-shrink-0",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    {isExpanded && (
                      <>
                        <span className="truncate">{t(item.nameKey)}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground/60 flex-shrink-0" />
                        )}
                      </>
                    )}
                  </Link>
                  
                  {/* Hover tooltip when collapsed */}
                  {!isExpanded && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {t(item.nameKey)}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-popover" />
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border/50">
        {isExpanded ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <LanguageSelector />
            </div>
            <SyncStatus />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <ThemeToggle />
            <LanguageSelector />
            <SyncStatus compact />
          </div>
        )}
      </div>
    </nav>
  )
}