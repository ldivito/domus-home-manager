'use client'

import { PersonalWallet } from '@/types/personal-finance'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  MoreHorizontal, 
  Wallet, 
  CreditCard, 
  Building, 
  Eye,
  EyeOff,
  Pencil,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatBalance, getWalletTypeIndicator, calculateAvailableCredit } from '@/lib/utils/finance'
import { useState } from 'react'
import Link from 'next/link'

interface WalletCardProps {
  wallet: PersonalWallet
  onEdit?: (wallet: PersonalWallet) => void
  onDelete?: (walletId: string) => void
  onToggleVisibility?: (walletId: string, visible: boolean) => void
  showBalance?: boolean
}

const getWalletIcon = (type: string) => {
  switch (type) {
    case 'credit_card':
      return <CreditCard className="h-5 w-5" />
    case 'bank':
      return <Building className="h-5 w-5" />
    default:
      return <Wallet className="h-5 w-5" />
  }
}

const getWalletTypeColor = (type: string) => {
  switch (type) {
    case 'credit_card':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'bank':
      return 'bg-green-50 text-green-700 border-green-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export function WalletCard({ 
  wallet, 
  onEdit, 
  onDelete, 
  onToggleVisibility,
  showBalance: defaultShowBalance = true 
}: WalletCardProps) {
  const [balanceVisible, setBalanceVisible] = useState(defaultShowBalance)
  
  const balanceInfo = formatBalance(wallet.balance || 0, wallet.currency)
  const availableCredit = wallet.type === 'credit_card' && wallet.creditLimit 
    ? calculateAvailableCredit(wallet.creditLimit, Math.abs(wallet.balance || 0))
    : null
  
  const getWalletTypeInfo = (type: string) => {
    switch (type) {
      case 'credit_card':
        return { displayName: 'Credit Card', badge: 'Credit' }
      case 'bank':
        return { displayName: 'Bank Account', badge: 'Bank' }
      default:
        return { displayName: 'Physical Wallet', badge: 'Cash' }
    }
  }
  
  const typeInfo = getWalletTypeInfo(wallet.type)

  const toggleBalanceVisibility = () => {
    const newVisible = !balanceVisible
    setBalanceVisible(newVisible)
    onToggleVisibility?.(wallet.id!, newVisible)
  }

  const formatDisplayBalance = (balance: number, currency: 'ARS' | 'USD') => {
    if (!balanceVisible) {
      return '••••••'
    }
    return formatBalance(balance, currency).formatted
  }

  return (
    <Card className="relative hover:shadow-md transition-shadow duration-200">
      {/* Color indicator */}
      <div 
        className="absolute top-0 left-0 w-1 h-full rounded-l-lg"
        style={{ backgroundColor: wallet.color }}
      />
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="p-2 rounded-lg"
              style={{ 
                backgroundColor: `${wallet.color}20`, 
                color: wallet.color 
              }}
            >
              {getWalletIcon(wallet.type)}
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-none">
                {wallet.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {typeInfo.displayName}
                {wallet.accountNumber && (
                  <span className="ml-1">• {wallet.accountNumber}</span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge 
              variant="outline" 
              className={getWalletTypeColor(wallet.type)}
            >
              {typeInfo.badge}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={toggleBalanceVisibility}>
                  {balanceVisible ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide balance
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Show balance
                    </>
                  )}
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(wallet)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit wallet
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(wallet.id!)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete wallet
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Main Balance */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {wallet.type === 'credit_card' ? 'Current Balance' : 'Available Balance'}
            </span>
            <div className="text-right">
              <div className={`text-xl font-bold ${balanceInfo.colorClass}`}>
                {formatDisplayBalance(wallet.balance || 0, wallet.currency)}
              </div>
            </div>
          </div>
          
          {/* Credit Card specific info */}
          {wallet.type === 'credit_card' && wallet.creditLimit && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credit Limit</span>
                <span className="font-medium">
                  {balanceVisible ? formatBalance(wallet.creditLimit, wallet.currency).formatted : '••••••'}
                </span>
              </div>
              {availableCredit !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Available Credit</span>
                  <span className="font-medium text-green-600">
                    {balanceVisible ? formatBalance(availableCredit, wallet.currency).formatted : '••••••'}
                  </span>
                </div>
              )}
              {wallet.dueDay && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payment Due</span>
                  <span className="font-medium">
                    Day {wallet.dueDay} of month
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Bank specific info */}
          {wallet.type === 'bank' && wallet.bankName && (
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Bank</span>
              <span className="font-medium">{wallet.bankName}</span>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              asChild 
              variant="outline" 
              size="sm" 
              className="flex-1"
            >
              <Link href={`/personal-finance/wallets/${wallet.id}`}>
                View Details
              </Link>
            </Button>
            <Button 
              asChild 
              size="sm" 
              className="flex-1"
            >
              <Link href={`/personal-finance/transactions/new?walletId=${wallet.id}`}>
                New Transaction
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}