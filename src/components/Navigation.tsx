'use client'

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
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './ThemeToggle'
import LanguageSelector from './LanguageSelector'
import SyncStatus from './SyncStatus'

export default function Navigation() {
  const pathname = usePathname()
  const t = useTranslations('navigation')
  const tCommon = useTranslations('common')

  const navigationItems = [
    { nameKey: 'home', href: '/', icon: Home },
    { nameKey: 'chores', href: '/chores', icon: CheckSquare },
    { nameKey: 'grocery', href: '/grocery', icon: ShoppingCart },
    { nameKey: 'meals', href: '/meals', icon: UtensilsCrossed },
    { nameKey: 'planner', href: '/planner', icon: Calendar },
    { nameKey: 'tasks', href: '/tasks', icon: List },
    { nameKey: 'projects', href: '/projects', icon: Hammer },
    { nameKey: 'reminders', href: '/reminders', icon: Bell },
    { nameKey: 'users', href: '/users', icon: Users },
    { nameKey: 'settings', href: '/settings', icon: Settings },
  ]

  return (
    <nav className="bg-card/50 backdrop-blur-xl border-r border-border/50 h-full w-72 flex flex-col shadow-modern">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Home className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{tCommon('appName')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{tCommon('appSubtitle')}</p>
      </div>
      
      {/* Navigation Items */}
      <div className="flex-1 py-6 px-4">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            
            return (
              <li key={item.nameKey}>
                <Link
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 px-4 py-3.5 text-base font-medium rounded-xl transition-all duration-200',
                    'hover:bg-muted/80 hover:scale-[1.02] active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-modern hover:bg-primary/90'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 transition-colors duration-200",
                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span className="truncate">{t(item.nameKey)}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground/60" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50 space-y-3">
        {/* Sync Status */}
        <div className="flex justify-center">
          <SyncStatus />
        </div>
        
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>{tCommon('appName')} v1.0.0</p>
          <p>Tablet-optimized home management</p>
        </div>
      </div>
    </nav>
  )
}