'use client'

import { useState } from 'react'
import { PersonalWallet, WalletFormData, WalletType } from '@/types/personal-finance'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { 
  Wallet, 
  CreditCard, 
  Building
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { validateWallet, generateWalletId, generateWalletColor } from '@/lib/utils/finance'
import { db } from '@/lib/db'
import { useToast } from '@/hooks/use-toast'

const WALLET_ICONS = [
  { value: 'Wallet', label: 'Wallet' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'Building', label: 'Bank' },
  { value: 'Banknote', label: 'Cash' },
  { value: 'PiggyBank', label: 'Savings' }
]

const PREDEFINED_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
]

// Form validation schema
const walletSchema = z.object({
  name: z.string().min(1, 'Wallet name is required').max(50, 'Name too long'),
  type: z.enum(['physical', 'bank', 'credit_card'] as const),
  currency: z.enum(['ARS', 'USD'] as const),
  balance: z.number().optional(),
  creditLimit: z.number().positive().optional(),
  closingDay: z.number().min(1).max(31).optional(),
  dueDay: z.number().min(1).max(31).optional(),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  icon: z.string(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof walletSchema>

interface CreateWalletDialogProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onWalletCreated?: (wallet: PersonalWallet) => void
  defaultValues?: Partial<WalletFormData>
}

export function CreateWalletDialog({
  trigger,
  open,
  onOpenChange,
  onWalletCreated,
  defaultValues
}: CreateWalletDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const form = useForm<FormData>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      name: '',
      type: 'physical',
      currency: 'ARS',
      balance: 0,
      color: generateWalletColor('physical'),
      icon: 'Wallet',
      ...defaultValues,
    },
  })

  const selectedType = form.watch('type')
  const selectedColor = form.watch('color')

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setIsOpen(newOpen)
    }
    
    if (!newOpen) {
      form.reset()
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    
    try {
      // Get current user (in a real app, this would come from auth)
      const userId = 'usr_5ad61fe0-39eb-4097-8a92-94922d0b828a' // TODO: Get from auth context
      
      // Validate the wallet data
      const validation = validateWallet({
        ...data,
        balance: data.balance || 0,
      })
      
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0]?.[0] || 'Validation failed'
        toast({
          title: 'Validation Error',
          description: firstError,
          variant: 'destructive',
        })
        return
      }

      // Prepare wallet data
      const walletData: PersonalWallet = {
        id: generateWalletId(),
        userId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        balance: data.balance || 0,
        creditLimit: data.type === 'credit_card' ? data.creditLimit : undefined,
        closingDay: data.type === 'credit_card' ? data.closingDay : undefined,
        dueDay: data.type === 'credit_card' ? data.dueDay : undefined,
        accountNumber: data.type === 'bank' ? data.accountNumber : undefined,
        bankName: data.type === 'bank' ? data.bankName : undefined,
        color: data.color,
        icon: data.icon,
        isActive: true,
        notes: data.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Save to database
      await db.personalWallets.add(walletData)

      toast({
        title: 'Wallet Created',
        description: `${data.name} has been created successfully.`,
      })

      onWalletCreated?.(walletData)
      handleOpenChange(false)
      form.reset()

    } catch (error) {
      console.error('Error creating wallet:', error)
      toast({
        title: 'Error',
        description: 'Failed to create wallet. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getWalletTypeIcon = (type: WalletType) => {
    switch (type) {
      case 'credit_card':
        return <CreditCard className="h-4 w-4" />
      case 'bank':
        return <Building className="h-4 w-4" />
      default:
        return <Wallet className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={open ?? isOpen} onOpenChange={handleOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Wallet</DialogTitle>
          <DialogDescription>
            Add a new wallet to track your finances. Choose the type that matches your account.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Basic Information</h4>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wallet Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. Personal Wallet, Banco Santander"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="physical">
                              <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4" />
                                Physical Wallet
                              </div>
                            </SelectItem>
                            <SelectItem value="bank">
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                Bank Account
                              </div>
                            </SelectItem>
                            <SelectItem value="credit_card">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                Credit Card
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ARS">ARS (Argentine Peso)</SelectItem>
                            <SelectItem value="USD">USD (US Dollar)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Balance */}
              {selectedType !== 'credit_card' && (
                <FormField
                  control={form.control}
                  name="balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Balance</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter your current balance for this account
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Credit Card specific fields */}
              {selectedType === 'credit_card' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Credit Card Details</h4>
                  
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="closingDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Closing Day</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              placeholder="15"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Day of month</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dueDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Day</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              placeholder="5"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Payment due day</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Bank specific fields */}
              {selectedType === 'bank' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Bank Details</h4>
                  
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Banco Santander, BBVA"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="****1234"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Last 4 digits for identification
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Appearance */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Appearance</h4>
                
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <div className="flex gap-2 flex-wrap">
                            {PREDEFINED_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`w-8 h-8 rounded-full border-2 transition-all ${
                                  selectedColor === color 
                                    ? 'border-gray-900 scale-110' 
                                    : 'border-gray-300 hover:scale-105'
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => field.onChange(color)}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              className="w-12 h-8 p-1 border rounded"
                              {...field}
                            />
                            <Input
                              type="text"
                              placeholder="#3b82f6"
                              className="flex-1"
                              {...field}
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {WALLET_ICONS.map((icon) => (
                            <SelectItem key={icon.value} value={icon.value}>
                              {icon.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about this wallet..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview */}
              <div className="p-4 border rounded-lg bg-gray-50">
                <h4 className="text-sm font-medium mb-2">Preview</h4>
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ 
                      backgroundColor: `${selectedColor}20`, 
                      color: selectedColor 
                    }}
                  >
                    {getWalletTypeIcon(selectedType)}
                  </div>
                  <div>
                    <p className="font-medium">
                      {form.watch('name') || 'Wallet Name'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedType.replace('_', ' ')} • {form.watch('currency')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Wallet'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}