'use client'

import { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  ArrowUpDown,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { db } from '@/lib/db'
import {
  generateTransactionId,
  validateTransaction,
  processTransactionBalanceUpdate,
  validateSufficientFunds,
  formatCurrency,
  getCurrentUserId
} from '@/lib/utils/finance'
import {
  PersonalWallet,
  PersonalCategory,
  PersonalTransaction,
  TransactionType
} from '@/types/personal-finance'
import { useToast } from '@/hooks/use-toast'

// Form validation schema
const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  walletId: z.string().min(1, 'Wallet is required'),
  categoryId: z.string().optional(),
  targetWalletId: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['ARS', 'USD']),
  description: z.string().min(1, 'Description is required'),
  date: z.string(),
  notes: z.string().optional(),
  exchangeRate: z.number().optional()
}).superRefine((data, ctx) => {
  // Validate category for non-transfer transactions
  if (data.type !== 'transfer' && !data.categoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Category is required for income and expense transactions',
      path: ['categoryId']
    })
  }

  // Validate target wallet for transfers
  if (data.type === 'transfer' && !data.targetWalletId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Target wallet is required for transfers',
      path: ['targetWalletId']
    })
  }

  // Validate that source and target wallets are different
  if (data.type === 'transfer' && data.walletId === data.targetWalletId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source and target wallets must be different',
      path: ['targetWalletId']
    })
  }
})

type TransactionFormData = z.infer<typeof transactionSchema>

interface TransactionFormProps {
  initialType?: TransactionType
  onSuccess?: () => void
  onCancel?: () => void
}

export function TransactionForm({
  initialType = 'expense',
  onSuccess,
  onCancel
}: TransactionFormProps) {
  const router = useRouter()
  const t = useTranslations('personalFinance')
  const { toast } = useToast()
  const [wallets, setWallets] = useState<PersonalWallet[]>([])
  const [categories, setCategories] = useState<PersonalCategory[]>([])
  const [loading, setLoading] = useState(false)

  // Form setup
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: initialType,
      amount: 0,
      currency: 'ARS',
      description: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    }
  })

  const watchType = form.watch('type')
  const watchWalletId = form.watch('walletId')
  const watchCurrency = form.watch('currency')
  const watchAmount = form.watch('amount')

  // Load wallets and categories
  useEffect(() => {
    loadWallets()
    loadCategories()
  }, [])

  // Update currency when wallet changes
  useEffect(() => {
    if (watchWalletId) {
      const wallet = wallets.find(w => w.id === watchWalletId)
      if (wallet && wallet.currency !== watchCurrency) {
        form.setValue('currency', wallet.currency)
      }
    }
  }, [watchWalletId, wallets])

  const loadWallets = async () => {
    try {
      // In a real app, this would filter by current user
      // NOTE: booleans are not indexable in IndexedDB, so filter in memory
      const userWallets = await db.personalWallets
        .filter(w => w.isActive !== false)
        .toArray()

      setWallets(userWallets)

      // Auto-select first wallet if none selected
      if (userWallets.length > 0 && !form.getValues('walletId')) {
        form.setValue('walletId', userWallets[0].id!)
      }
    } catch (error) {
      console.error('Error loading wallets:', error)
      toast({
        title: t('transactionForm.errorTitle'),
        description: t('transactionList.loadError'),
        variant: 'destructive'
      })
    }
  }

  const loadCategories = async () => {
    try {
      // NOTE: booleans are not indexable in IndexedDB, so filter in memory
      const userCategories = await db.personalCategories
        .filter(c => c.isActive !== false)
        .toArray()

      setCategories(userCategories)
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const getFilteredCategories = () => {
    if (watchType === 'transfer') return []
    return categories.filter(cat => cat.type === watchType)
  }

  const getAvailableTargetWallets = () => {
    return wallets.filter(wallet => wallet.id !== watchWalletId)
  }

  /**
   * Parse the YYYY-MM-DD string from <input type="date"> as a LOCAL date.
   * new Date('YYYY-MM-DD') would be interpreted as UTC midnight, shifting the
   * date one day back in negative-offset timezones (e.g. Argentina, UTC-3).
   */
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const handleSubmit = async (data: TransactionFormData) => {
    setLoading(true)

    try {
      // Validate transaction
      const validation = validateTransaction({
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        walletId: data.walletId,
        categoryId: data.categoryId || '',
        targetWalletId: data.targetWalletId,
        description: data.description,
        date: parseLocalDate(data.date),
        sharedWithHousehold: false
      })

      if (!validation.isValid) {
        toast({
          title: t('transactionForm.validationError'),
          description: Object.values(validation.errors).flat().join(', '),
          variant: 'destructive'
        })
        return
      }

      // Get current user ID (placeholder until real auth context is wired)
      const userId = getCurrentUserId()

      const saved = data.type === 'transfer'
        ? await handleTransfer(data, userId)
        : await handleBasicTransaction(data, userId)

      // Do not show success or navigate away if nothing was saved
      // (e.g. insufficient funds or missing exchange rate)
      if (!saved) {
        return
      }

      const typeLabel = data.type.charAt(0).toUpperCase() + data.type.slice(1)
      toast({
        title: t('transactionForm.successTitle'),
        description: t('transactionForm.successMessage', { type: typeLabel })
      })

      // Reset form or navigate away
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/personal-finance/transactions')
      }

    } catch (error) {
      console.error('Error saving transaction:', error)
      toast({
        title: t('transactionForm.errorTitle'),
        description: t('transactionForm.errorMessage'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * @returns true if the transaction was saved, false otherwise
   */
  const handleBasicTransaction = async (data: TransactionFormData, userId: string): Promise<boolean> => {
    // Validate sufficient funds for expenses
    if (data.type === 'expense') {
      const validation = await validateSufficientFunds(data.walletId, data.amount)
      if (!validation.isValid) {
        toast({
          title: t('transactionForm.insufficientFunds'),
          description: validation.error,
          variant: 'destructive'
        })
        return false
      }
    }

    const transactionId = generateTransactionId()

    // Create transaction record
    // NOTE: household sharing is disabled until the household integration
    // actually exists (the previous flag was persisted but never acted upon)
    const transaction: PersonalTransaction = {
      id: transactionId,
      userId,
      walletId: data.walletId,
      categoryId: data.categoryId!,
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      date: parseLocalDate(data.date),
      notes: data.notes,
      sharedWithHousehold: false,
      householdContribution: undefined,
      isFromCreditCard: false,
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Save transaction and update wallet balance atomically
    await db.transaction('rw', [db.personalTransactions, db.personalWallets], async () => {
      await db.personalTransactions.add(transaction)
      await processTransactionBalanceUpdate(transaction)
    })

    return true
  }

  /**
   * @returns true if the transfer was saved, false otherwise
   */
  const handleTransfer = async (data: TransactionFormData, userId: string): Promise<boolean> => {
    const sourceWallet = wallets.find(w => w.id === data.walletId)!
    const targetWallet = wallets.find(w => w.id === data.targetWalletId)!

    // Validate sufficient funds in source wallet
    const validation = await validateSufficientFunds(data.walletId, data.amount)
    if (!validation.isValid) {
      toast({
        title: t('transactionForm.insufficientFunds'),
        description: validation.error,
        variant: 'destructive'
      })
      return false
    }

    let exchangeRate = 1

    // Cross-currency transfers require an explicit, user-provided exchange rate.
    // There is no exchange rate API integration yet, and silently applying a
    // made-up rate would corrupt wallet balances.
    if (sourceWallet.currency !== targetWallet.currency) {
      if (!data.exchangeRate || !Number.isFinite(data.exchangeRate) || data.exchangeRate <= 0) {
        toast({
          title: t('transactionForm.validationError'),
          description: t('transactionForm.exchangeRateRequired'),
          variant: 'destructive'
        })
        return false
      }
      exchangeRate = data.exchangeRate
    }

    const transactionId = generateTransactionId()

    // Create transfer transaction
    const transaction: PersonalTransaction = {
      id: transactionId,
      userId,
      walletId: data.walletId,
      categoryId: '', // No category for transfers
      type: 'transfer',
      amount: data.amount,
      currency: sourceWallet.currency,
      description: data.description,
      date: parseLocalDate(data.date),
      notes: data.notes,
      targetWalletId: data.targetWalletId,
      exchangeRate,
      isFromCreditCard: false,
      sharedWithHousehold: false, // Transfers are not shared
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Save transaction and update both wallet balances atomically
    await db.transaction('rw', [db.personalTransactions, db.personalWallets], async () => {
      await db.personalTransactions.add(transaction)
      await processTransactionBalanceUpdate(transaction)
    })

    return true
  }

  const selectedWallet = wallets.find(w => w.id === watchWalletId)
  const targetWallet = wallets.find(w => w.id === form.getValues('targetWalletId'))

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {watchType === 'income' && <TrendingUp className="h-5 w-5 text-green-600" />}
          {watchType === 'expense' && <TrendingDown className="h-5 w-5 text-red-600" />}
          {watchType === 'transfer' && <ArrowUpDown className="h-5 w-5 text-blue-600" />}
          {t('transactionForm.newTitle', { type: watchType.charAt(0).toUpperCase() + watchType.slice(1) })}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

            {/* Transaction Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transactionForm.transactionType')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('transactionForm.selectType')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          {t('transactionList.income')}
                        </div>
                      </SelectItem>
                      <SelectItem value="expense">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          {t('transactionList.expense')}
                        </div>
                      </SelectItem>
                      <SelectItem value="transfer">
                        <div className="flex items-center gap-2">
                          <ArrowUpDown className="h-4 w-4 text-blue-600" />
                          {t('transactionList.transfer')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Source Wallet */}
            <FormField
              control={form.control}
              name="walletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {watchType === 'transfer' ? t('transactionForm.fromWallet') : t('transactionForm.wallet')}
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('transactionForm.selectWallet')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {wallets.map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id!}>
                          <div className="flex items-center justify-between w-full">
                            <span>{wallet.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              {formatCurrency(wallet.balance, wallet.currency)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Wallet (only for transfers) */}
            {watchType === 'transfer' && (
              <FormField
                control={form.control}
                name="targetWalletId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('transactionForm.toWallet')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('transactionForm.selectTargetWallet')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getAvailableTargetWallets().map((wallet) => (
                          <SelectItem key={wallet.id} value={wallet.id!}>
                            <div className="flex items-center justify-between w-full">
                              <span>{wallet.name}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                {formatCurrency(wallet.balance, wallet.currency)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedWallet && targetWallet && selectedWallet.currency !== targetWallet.currency && (
                      <p className="text-sm text-amber-600 mt-1">
                        {t('transactionForm.converting', { from: selectedWallet.currency, to: targetWallet.currency })}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Category (not for transfers) */}
            {watchType !== 'transfer' && (
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('transactionForm.category')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('transactionForm.selectCategory')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getFilteredCategories().map((category) => (
                          <SelectItem key={category.id} value={category.id!}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transactionForm.amount')}</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-12"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <span className="text-muted-foreground">
                        {watchCurrency === 'USD' ? 'US$' : '$'}
                      </span>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transactionForm.description')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        watchType === 'income' ? t('transactionForm.descriptionIncomePlaceholder') :
                        watchType === 'expense' ? t('transactionForm.descriptionExpensePlaceholder') :
                        t('transactionForm.descriptionTransferPlaceholder')
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transactionForm.date')}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transactionForm.notesOptional')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('transactionForm.notesPlaceholder')}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* NOTE: household sharing UI removed until the household
                integration exists — the toggle previously stored a flag that
                was never reflected in household finances (misleading data) */}

            {/* Exchange Rate (for cross-currency transfers) */}
            {watchType === 'transfer' && selectedWallet && targetWallet &&
             selectedWallet.currency !== targetWallet.currency && (
              <FormField
                control={form.control}
                name="exchangeRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('transactionForm.exchangeRate', { from: selectedWallet.currency, to: targetWallet.currency })}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        placeholder="1.0000"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    {field.value && watchAmount > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(watchAmount, selectedWallet.currency)} = {' '}
                        {formatCurrency(watchAmount * field.value, targetWallet.currency)}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? t('transactionForm.saving') : t('transactionForm.saveType', { type: watchType })}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel || (() => router.back())}
              >
                {t('transactionForm.cancel')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
