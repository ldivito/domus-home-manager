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
  Heart,
  LogOut,
  User,
  Wallet,
  FileText,
  Wrench,
  CreditCard,
  PawPrint,
  PiggyBank,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './ThemeToggle'
import LanguageSelector from './LanguageSelector'
import SyncButton from './SyncButton'
import SyncLoadingScreen from './SyncLoadingScreen'
import { Button } from './ui/button'
import { toast } from 'sonner'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'

export default function MobileNavigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<{ email: string; userId: string } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('navigation')
  const tAuth = useTranslations('auth')

  // Live queries for badge counts
  const pendingTasksCount = useLiveQuery(
    () => db.tasks.filter(task => !task.isCompleted).count(),
    [],
    0
  )

  const groceryItemsCount = useLiveQuery(
    () => db.groceryItems.count(),
    [],
    0
  )

  const pendingChoresCount = useLiveQuery(
    () => db.chores.filter(chore => {
      if (!chore.nextDue) return false
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dueDate = new Date(chore.nextDue)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate <= today
    }).count(),
    [],
    0
  )

  const activeRemindersCount = useLiveQuery(
    () => db.reminders.filter(reminder => !reminder.isCompleted).count(),
    [],
    0
  )

  // Badge counts map for menu items
  const badgeCounts: Record<string, number> = {
    tasks: pendingTasksCount,
    grocery: groceryItemsCount,
    chores: pendingChoresCount,
    reminders: activeRemindersCount,
  }

  useEffect(() => {
    checkAuthStatus()

    const handleAuthChange = () => {
      checkAuthStatus()
    }

    window.addEventListener('auth-changed', handleAuthChange)
    return () => window.removeEventListener('auth-changed', handleAuthChange)
  }, [])

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

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
    setIsSyncing(true)
  }

  const handleSyncComplete = async (success: boolean) => {
    setIsSyncing(false)

    if (!success) {
      toast.warning('Sync encountered issues during logout')
    }

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        setUser(null)
        toast.success(tAuth('signOut') + ' successful')
        window.dispatchEvent(new CustomEvent('auth-changed'))
        router.push('/')
      } else {
        toast.error('Failed to logout')
      }
    } catch {
      toast.error('Failed to logout')
    }
  }

  const allNavigationItems = [
    { nameKey: 'chores', href: '/chores', icon: CheckSquare },
    { nameKey: 'grocery', href: '/grocery', icon: ShoppingCart },
    { nameKey: 'meals', href: '/meals', icon: UtensilsCrossed },
    { nameKey: 'keto', href: '/keto', icon: Heart },
    { nameKey: 'finance', href: '/finance', icon: Wallet },
    { nameKey: 'personalFinance', href: '/personal-finance', icon: TrendingUp },
    { nameKey: 'savings', href: '/savings', icon: PiggyBank },
    { nameKey: 'subscriptions', href: '/subscriptions', icon: CreditCard },
    { nameKey: 'pets', href: '/pets', icon: PawPrint },
    { nameKey: 'planner', href: '/planner', icon: Calendar },
    { nameKey: 'tasks', href: '/tasks', icon: List },
    { nameKey: 'projects', href: '/projects', icon: Hammer },
    { nameKey: 'documents', href: '/documents', icon: FileText },
    { nameKey: 'maintenance', href: '/maintenance', icon: Wrench },
    { nameKey: 'reminders', href: '/reminders', icon: Bell },
    { nameKey: 'users', href: '/users', icon: Users },
    { nameKey: 'settings', href: '/settings', icon: Settings },
  ]

  if (isSyncing) {
    return <SyncLoadingScreen onComplete={handleSyncComplete} action="logout" />
  }

  return (
    <>
      {/* Menu Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/95 backdrop-blur-xl transition-all duration-300 ease-out",
          isMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h2 className="text-lg font-semibold">{t('menu')}</h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSelector />
            <SyncButton compact />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(false)}
              className="h-10 w-10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Grid Menu */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          <div className="grid grid-cols-3 gap-3">
            {allNavigationItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              const badgeCount = badgeCounts[item.nameKey] || 0

              return (
                <Link
                  key={item.nameKey}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all duration-200 relative",
                    "active:scale-95",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-card/80 text-foreground hover:bg-muted/80 border border-border/50"
                  )}
                >
                  <div className="relative">
                    <Icon className="h-6 w-6" />
                    {badgeCount > 0 && (
                      <span className={cn(
                        "absolute -top-2 -right-3 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full px-1",
                        isActive
                          ? "bg-primary-foreground text-primary"
                          : "bg-primary text-primary-foreground"
                      )}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">
                    {t(item.nameKey)}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* User Section at Bottom */}
        {user && (
          <div className="absolute bottom-20 left-0 right-0 p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground truncate max-w-[180px]">
                  {user.email}
                </span>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                {tAuth('signOut')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border/50 safe-area-bottom"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {/* Dashboard Button - First Position */}
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all duration-200",
              "active:scale-95",
              pathname === '/'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-medium">{t('home')}</span>
          </Link>

          {/* Notifications with Badge */}
          <Link
            href="/reminders"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 relative",
              "active:scale-95",
              pathname === '/reminders'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Bell className="h-5 w-5" />
              {activeRemindersCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1">
                  {activeRemindersCount > 99 ? '99+' : activeRemindersCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{t('reminders')}</span>
          </Link>

          {/* Menu Button - Center, Prominent (Toggle) */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex flex-col items-center justify-center -mt-4 transition-all duration-200 active:scale-95 relative z-10"
          >
            <div
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200",
                isMenuOpen
                  ? "bg-primary text-primary-foreground shadow-primary/30"
                  : "bg-primary/90 text-primary-foreground hover:bg-primary"
              )}
            >
              <Menu className="h-6 w-6" />
            </div>
          </button>

          {/* Tasks with Badge */}
          <Link
            href="/tasks"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 relative",
              "active:scale-95",
              pathname === '/tasks'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <List className="h-5 w-5" />
              {pendingTasksCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1">
                  {pendingTasksCount > 99 ? '99+' : pendingTasksCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{t('tasks')}</span>
          </Link>

          {/* Account/Settings Button */}
          <Link
            href={user ? '/settings' : '/settings'}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all duration-200",
              "active:scale-95",
              pathname === '/settings' || pathname === '/users'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {user ? (
              <>
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-3 w-3 text-primary" />
                </div>
                <span className="text-[10px] font-medium">{t('account')}</span>
              </>
            ) : (
              <>
                <Settings className="h-5 w-5" />
                <span className="text-[10px] font-medium">{t('settings')}</span>
              </>
            )}
          </Link>
        </div>
      </nav>
    </>
  )
}
