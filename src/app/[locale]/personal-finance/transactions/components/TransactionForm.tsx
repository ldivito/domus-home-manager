'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { Checkbox } from '@/components/ui/checkbox'
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
  TrendingDown, 
  Calculator,
  Wallet
} from 'lucide-react'
import { db } from '@/lib/db'
import { 
  generateTransactionId,
  validateTransaction,
  processTransactionBalanceUpdate,
  validateSufficientFunds,
  formatCurrency,
  parseAmount
} from '@/lib/utils/finance'
import { 
  PersonalWallet, 
  PersonalCategory, 
  PersonalTransaction,
  TransactionType,
  CurrencyType 
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
  sharedWithHousehold: z.boolean().optional(),
  householdContribution: z.number().optional(),
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
  
  // Validate household contribution
  if (data.sharedWithHousehold && data.householdContribution && data.householdContribution > data.amount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Household contribution cannot exceed transaction amount',
      path: ['householdContribution']
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
  const { toast } = useToast()
  const [wallets, setWallets] = useState<PersonalWallet[]>([])
  const [categories, setCategories] = useState<PersonalCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)

  // Form setup
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: initialType,
      amount: 0,
      currency: 'ARS',
      description: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      sharedWithHousehold: false
    }
  })

  const watchType = form.watch('type')
  const watchWalletId = form.watch('walletId')
  const watchCurrency = form.watch('currency')
  const watchAmount = form.watch('amount')
  const watchSharedWithHousehold = form.watch('sharedWithHousehold')

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

  // Auto-set household contribution for income
  useEffect(() => {
    if (watchType === 'income' && watchSharedWithHousehold && watchAmount > 0) {
      form.setValue('householdContribution', watchAmount)
    }
  }, [watchType, watchSharedWithHousehold, watchAmount])

  const loadWallets = async () => {
    try {
      // In a real app, this would filter by current user
      const userWallets = await db.personalWallets
        .where('isActive')
        .equals(1)
        .toArray()
      
      setWallets(userWallets)
      
      // Auto-select first wallet if none selected
      if (userWallets.length > 0 && !form.getValues('walletId')) {
        form.setValue('walletId', userWallets[0].id!)
      }
    } catch (error) {
      console.error('Error loading wallets:', error)
      toast({
        title: 'Error',
        description: 'Failed to load wallets. Please refresh the page.',
        variant: 'destructive'
      })
    }
  }

  const loadCategories = async () => {
    try {
      const userCategories = await db.personalCategories
        .where('isActive')
        .equals(1)
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

  const calculateExchangeRate = async (fromCurrency: CurrencyType, toCurrency: CurrencyType) => {
    if (fromCurrency === toCurrency) return 1
    
    setCalculating(true)
    try {
      // In a real app, you'd call an exchange rate API
      // For now, using a mock rate
      const mockRate = fromCurrency === 'USD' ? 1000 : 0.001
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      return mockRate
    } finally {
      setCalculating(false)
    }
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
        description: data.description,
        date: new Date(data.date),
        sharedWithHousehold: data.sharedWithHousehold || false
      })

      if (!validation.isValid) {
        toast({
          title: 'Validation Error',
          description: Object.values(validation.errors).flat().join(', '),
          variant: 'destructive'
        })
        return
      }

      // Get current user ID (in a real app, from auth context)
      const userId = 'current-user-id' // TODO: Replace with actual user ID

      if (data.type === 'transfer') {
        await handleTransfer(data, userId)
      } else {
        await handleBasicTransaction(data, userId)
      }

      toast({
        title: 'Success',
        description: `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} recorded successfully!`
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
        title: 'Error',
        description: 'Failed to save transaction. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBasicTransaction = async (data: TransactionFormData, userId: string) => {
    // Validate sufficient funds for expenses
    if (data.type === 'expense') {
      const validation = await validateSufficientFunds(data.walletId, data.amount)
      if (!validation.isValid) {
        toast({
          title: 'Insufficient Funds',
          description: validation.error,
          variant: 'destructive'
        })
        return
      }
    }
    
    const transactionId = generateTransactionId()
    
    // Create transaction record
    const transaction: PersonalTransaction = {
      id: transactionId,
      userId,
      walletId: data.walletId,
      categoryId: data.categoryId!,
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      date: new Date(data.date),
      notes: data.notes,
      sharedWithHousehold: data.sharedWithHousehold || false,
      householdContribution: data.householdContribution,
      isFromCreditCard: false,
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Save transaction
    await db.personalTransactions.add(transaction)

    // Update wallet balance
    await processTransactionBalanceUpdate(transaction)

    // If shared with household, create household income record
    if (data.sharedWithHousehold && data.householdContribution) {
      // TODO: Integrate with household system
      console.log('Would create household income:', data.householdContribution)
    }
  }

  const handleTransfer = async (data: TransactionFormData, userId: string) => {
    const sourceWallet = wallets.find(w => w.id === data.walletId)!
    const targetWallet = wallets.find(w => w.id === data.targetWalletId)!
    
    // Validate sufficient funds in source wallet
    const validation = await validateSufficientFunds(data.walletId, data.amount)
    if (!validation.isValid) {
      toast({
        title: 'Insufficient Funds',
        description: validation.error,
        variant: 'destructive'
      })
      return
    }
    
    let exchangeRate = 1

    // Handle currency conversion
    if (sourceWallet.currency !== targetWallet.currency) {
      exchangeRate = data.exchangeRate || await calculateExchangeRate(sourceWallet.currency, targetWallet.currency)
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
      date: new Date(data.date),
      notes: data.notes,
      targetWalletId: data.targetWalletId,
      exchangeRate,
      isFromCreditCard: false,
      sharedWithHousehold: false, // Transfers are not shared
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Save transaction
    await db.personalTransactions.add(transaction)

    // Update both wallet balances
    await processTransactionBalanceUpdate(transaction)
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
          New {watchType.charAt(0).toUpperCase() + watchType.slice(1)}
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
                  <FormLabel>Transaction Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          Income
                        </div>
                      </SelectItem>
                      <SelectItem value="expense">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          Expense
                        </div>
                      </SelectItem>
                      <SelectItem value="transfer">
                        <div className="flex items-center gap-2">
                          <ArrowUpDown className="h-4 w-4 text-blue-600" />
                          Transfer
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
                    {watchType === 'transfer' ? 'From Wallet' : 'Wallet'}
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select wallet" />
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
                    <FormLabel>To Wallet</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select target wallet" />
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
                        Converting {selectedWallet.currency} → {targetWallet.currency}
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
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
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
                  <FormLabel>Amount</FormLabel>
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        watchType === 'income' ? 'Salary, freelance, etc.' :
                        watchType === 'expense' ? 'Groceries, rent, etc.' :
                        'Transfer description'
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
                  <FormLabel>Date</FormLabel>
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
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Household Sharing (only for income) */}
            {watchType === 'income' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <FormField
                  control={form.control}
                  name="sharedWithHousehold"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Share with household</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Add part or all of this income to the household budget
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {watchSharedWithHousehold && (
                  <FormField
                    control={form.control}
                    name="householdContribution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Household contribution amount</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={watchAmount}
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
                )}
              </div>
            )}

            {/* Exchange Rate (for cross-currency transfers) */}
            {watchType === 'transfer' && selectedWallet && targetWallet && 
             selectedWallet.currency !== targetWallet.currency && (
              <FormField
                control={form.control}
                name="exchangeRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Exchange Rate ({selectedWallet.currency} to {targetWallet.currency})
                    </FormLabel>
                    <div className="flex gap-2">
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
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          const rate = await calculateExchangeRate(selectedWallet.currency, targetWallet.currency)
                          form.setValue('exchangeRate', rate)
                        }}
                        disabled={calculating}
                      >
                        <Calculator className="h-4 w-4" />
                      </Button>
                    </div>
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
                disabled={loading || calculating}
                className="flex-1"
              >
                {loading ? 'Saving...' : `Save ${watchType}`}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel || (() => router.back())}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}