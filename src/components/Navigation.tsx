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
import LanguageSelector from './LanguageSelector'

export default function Navigation() {
  const pathname = usePathname()
  const t = useTranslations('navigation')
  const tCommon = useTranslations('common')

  const navigationItems = [
    { nameKey: 'home', href: '/', icon: Home },
    { nameKey: 'chores', href: '/chores', icon: CheckSquare },
    { nameKey: 'grocery', href: '/grocery', icon: ShoppingCart },
    { nameKey: 'planner', href: '/planner', icon: Calendar },
    { nameKey: 'tasks', href: '/tasks', icon: List },
    { nameKey: 'projects', href: '/projects', icon: Hammer },
    { nameKey: 'meals', href: '/meals', icon: UtensilsCrossed },
    { nameKey: 'reminders', href: '/reminders', icon: Bell },
    { nameKey: 'users', href: '/users', icon: Users },
    { nameKey: 'settings', href: '/settings', icon: Settings },
  ]

  return (
    <nav className="bg-white border-r border-gray-200 h-full w-64 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{tCommon('appName')}</h1>
          <LanguageSelector />
        </div>
        <p className="text-sm text-gray-600 mt-1">{tCommon('appSubtitle')}</p>
      </div>
      
      <div className="flex-1 py-6">
        <ul className="space-y-2 px-3">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.nameKey}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center px-4 py-4 text-lg font-medium rounded-lg transition-colors duration-200',
                    'hover:bg-orange-50 hover:text-orange-700',
                    'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2',
                    isActive
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-gray-700'
                  )}
                >
                  <item.icon className="mr-4 h-6 w-6" />
                  {t(item.nameKey)}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}