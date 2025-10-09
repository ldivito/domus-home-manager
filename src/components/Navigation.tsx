'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
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
  Heart,
  LogOut,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './ThemeToggle'
import LanguageSelector from './LanguageSelector'
import SyncButton from './SyncButton'
import { Button } from './ui/button'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { toast } from 'sonner'

export default function Navigation() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [user, setUser] = useState<{ email: string; userId: string } | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('navigation')
  const tAuth = useTranslations('auth')

  // Get household/home name from database
  const homeSettings = useLiveQuery(() => db.homeSettings.orderBy('lastUpdated').last())
  const householdName = homeSettings?.homeName || 'Home'

  // Check authentication status on mount and when auth changes
  useEffect(() => {
    checkAuthStatus()

    // Listen for auth changes (login/logout events)
    const handleAuthChange = () => {
      checkAuthStatus()
    }

    window.addEventListener('auth-changed', handleAuthChange)
    return () => window.removeEventListener('auth-changed', handleAuthChange)
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        setUser(null)
        toast.success(tAuth('signOut') + ' successful')
        // Trigger auth refresh event
        window.dispatchEvent(new CustomEvent('auth-changed'))
        router.push('/')
      } else {
        toast.error('Failed to logout')
      }
    } catch {
      toast.error('Failed to logout')
    }
  }

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
      <div className="p-2 border-t border-border/50 space-y-2">
        {/* User Profile Section - Show when logged in */}
        {user && (
          <div className={cn(
            "border-b border-border/50 pb-2",
            isExpanded ? "px-1" : "px-0"
          )}>
            {isExpanded ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground truncate">{user.email}</span>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-8 text-xs"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {tAuth('signOut')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={tAuth('signOut')}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        {isExpanded ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <LanguageSelector />
            </div>
            <SyncButton />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <ThemeToggle />
            <LanguageSelector />
            <SyncButton compact />
          </div>
        )}
      </div>
    </nav>
  )
}