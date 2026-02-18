'use client'

import { Link, usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { 
  Home, 
  Wallet, 
  ArrowUpDown, 
  Tags, 
  BarChart3,
  Plus,
  TrendingUp,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PersonalFinanceNav() {
  const pathname = usePathname()
  const t = useTranslations('personalFinance')

  const navigation = [
    {
      name: t('navigation.dashboard'),
      href: '/personal-finance',
      icon: Home,
      description: t('navigation.dashboardDesc')
    },
    {
      name: t('navigation.wallets'),
      href: '/personal-finance/wallets',
      icon: Wallet,
      description: t('navigation.walletsDesc')
    },
    {
      name: t('navigation.transactions'),
      href: '/personal-finance/transactions',
      icon: ArrowUpDown,
      description: t('navigation.transactionsDesc')
    },
    {
      name: t('navigation.categories'),
      href: '/personal-finance/categories',
      icon: Tags,
      description: t('navigation.categoriesDesc')
    },
    {
      name: t('navigation.analytics'),
      href: '/personal-finance/analytics',
      icon: BarChart3,
      description: t('navigation.analyticsDesc')
    },
    {
      name: t('navigation.settings'),
      href: '/personal-finance/settings',
      icon: Settings,
      description: t('navigation.settingsDesc')
    }
  ]

  const quickActions = [
    {
      name: t('dashboard.addExpense'),
      href: '/personal-finance/transactions/new?type=expense',
      icon: TrendingUp,
      variant: 'default' as const
    },
    {
      name: t('dashboard.addIncome'),
      href: '/personal-finance/transactions/new?type=income',
      icon: TrendingUp,
      variant: 'outline' as const
    },
    {
      name: t('dashboard.newWallet'),
      href: '/personal-finance/wallets/new',
      icon: Plus,
      variant: 'outline' as const
    }
  ]

  const isActive = (href: string) => {
    if (href === '/personal-finance') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="border-b pb-4 space-y-4">
      {/* Main Navigation */}
      <nav className="flex flex-wrap gap-2">
        {navigation.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          
          return (
            <Button
              key={item.href}
              asChild
              variant={active ? "default" : "ghost"}
              size="sm"
              className={cn(
                "justify-start gap-2",
                active && "shadow-sm"
              )}
            >
              <Link href={item.href} title={item.description}>
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            </Button>
          )
        })}
      </nav>

      {/* Quick Actions - Mobile Hidden on Small Screens */}
      <div className="hidden md:flex gap-2">
        <span className="text-sm text-muted-foreground flex items-center mr-2">
          {t('navigation.quick')}:
        </span>
        {quickActions.map((action) => {
          const Icon = action.icon
          
          return (
            <Button
              key={action.href}
              asChild
              variant={action.variant}
              size="sm"
              className="gap-2"
            >
              <Link href={action.href}>
                <Icon className="h-4 w-4" />
                {action.name}
              </Link>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
