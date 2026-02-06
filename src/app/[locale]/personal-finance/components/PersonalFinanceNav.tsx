'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

const navigation = [
  {
    name: 'Dashboard',
    href: '/personal-finance',
    icon: Home,
    description: 'Overview and quick actions'
  },
  {
    name: 'Wallets',
    href: '/personal-finance/wallets',
    icon: Wallet,
    description: 'Manage your accounts'
  },
  {
    name: 'Transactions',
    href: '/personal-finance/transactions',
    icon: ArrowUpDown,
    description: 'View transaction history'
  },
  {
    name: 'Categories',
    href: '/personal-finance/categories',
    icon: Tags,
    description: 'Organize your expenses'
  },
  {
    name: 'Analytics',
    href: '/personal-finance/analytics',
    icon: BarChart3,
    description: 'Charts and reports'
  },
  {
    name: 'Settings',
    href: '/personal-finance/settings',
    icon: Settings,
    description: 'Configure preferences'
  }
]

const quickActions = [
  {
    name: 'Add Expense',
    href: '/personal-finance/transactions/new?type=expense',
    icon: TrendingUp,
    variant: 'default' as const
  },
  {
    name: 'Add Income',
    href: '/personal-finance/transactions/new?type=income',
    icon: TrendingUp,
    variant: 'outline' as const
  },
  {
    name: 'New Wallet',
    href: '/personal-finance/wallets/new',
    icon: Plus,
    variant: 'outline' as const
  }
]

export default function PersonalFinanceNav() {
  const pathname = usePathname()

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
              key={item.name}
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
          Quick:
        </span>
        {quickActions.map((action) => {
          const Icon = action.icon
          
          return (
            <Button
              key={action.name}
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