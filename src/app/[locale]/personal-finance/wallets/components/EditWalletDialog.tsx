'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PersonalWallet, WalletType } from '@/types/personal-finance'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { db } from '@/lib/db'
import { useToast } from '@/hooks/use-toast'

const PREDEFINED_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#84cc16', '#ec4899', '#6366f1', '#14b8a6',
]

const WALLET_ICONS = [
  { value: 'Wallet', label: 'Wallet' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'Building', label: 'Bank' },
  { value: 'Banknote', label: 'Cash' },
  { value: 'PiggyBank', label: 'Savings' }
]

const walletSchema = z.object({
  name: z.string().min(1, 'Wallet name is required').max(50, 'Name too long'),
  type: z.enum(['physical', 'bank', 'credit_card'] as const),
  currency: z.enum(['ARS', 'USD'] as const),
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

interface EditWalletDialogProps {
  wallet: PersonalWallet | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onWalletUpdated?: (wallet: PersonalWallet) => void
}

export function EditWalletDialog({
  wallet,
  open,
  onOpenChange,
  onWalletUpdated,
}: EditWalletDialogProps) {
  const t = useTranslations('personalFinance')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const form = useForm<FormData>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      name: '',
      type: 'physical',
      currency: 'ARS',
      color: '#3b82f6',
      icon: 'Wallet',
    },
  })

  const selectedType = form.watch('type')
  const selectedColor = form.watch('color')

  // Reset form when wallet changes
  useEffect(() => {
    if (wallet && open) {
      form.reset({
        name: wallet.name,
        type: wallet.type,
        currency: wallet.currency,
        creditLimit: wallet.creditLimit,
        closingDay: wallet.closingDay,
        dueDay: wallet.dueDay,
        accountNumber: wallet.accountNumber,
        bankName: wallet.bankName,
        color: wallet.color,
        icon: wallet.icon || 'Wallet',
        notes: wallet.notes,
      })
    }
  }, [wallet, open, form])

  const onSubmit = async (data: FormData) => {
    if (!wallet?.id) return
    setIsLoading(true)

    try {
      const updateData: Partial<PersonalWallet> = {
        name: data.name,
        type: data.type,
        currency: data.currency,
        creditLimit: data.type === 'credit_card' ? data.creditLimit : undefined,
        closingDay: data.type === 'credit_card' ? data.closingDay : undefined,
        dueDay: data.type === 'credit_card' ? data.dueDay : undefined,
        accountNumber: data.type === 'bank' ? data.accountNumber : undefined,
        bankName: data.type === 'bank' ? data.bankName : undefined,
        color: data.color,
        icon: data.icon,
        notes: data.notes,
        updatedAt: new Date(),
      }

      await db.personalWallets.update(wallet.id, updateData)

      const updatedWallet = { ...wallet, ...updateData }

      toast({
        title: t('editWallet.successTitle'),
        description: t('editWallet.successMessage', { name: data.name }),
      })

      onWalletUpdated?.(updatedWallet)
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating wallet:', error)
      toast({
        title: t('walletForm.errorTitle'),
        description: t('editWallet.errorMessage'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getWalletTypeIcon = (type: WalletType) => {
    switch (type) {
      case 'credit_card': return <CreditCard className="h-4 w-4" />
      case 'bank': return <Building className="h-4 w-4" />
      default: return <Wallet className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editWallet.title')}</DialogTitle>
          <DialogDescription>
            {t('editWallet.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">{t('walletForm.basicInfo')}</h4>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('walletForm.walletName')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('walletForm.walletNamePlaceholder')}
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
                        <FormLabel>{t('walletForm.type')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="physical">
                              <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4" />
                                {t('walletForm.typePhysical')}
                              </div>
                            </SelectItem>
                            <SelectItem value="bank">
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                {t('walletForm.typeBank')}
                              </div>
                            </SelectItem>
                            <SelectItem value="credit_card">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                {t('walletForm.typeCreditCard')}
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
                        <FormLabel>{t('walletForm.currency')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ARS">{t('walletForm.currencyARS')}</SelectItem>
                            <SelectItem value="USD">{t('walletForm.currencyUSD')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Credit Card specific fields */}
              {selectedType === 'credit_card' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">{t('walletForm.creditCardDetails')}</h4>

                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('walletForm.creditLimit')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value ?? ''}
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
                          <FormLabel>{t('walletForm.closingDay')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              placeholder="15"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>{t('walletForm.dayOfMonth')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dueDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('walletForm.dueDay')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              placeholder="5"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>{t('walletForm.paymentDueDay')}</FormDescription>
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
                  <h4 className="text-sm font-medium">{t('walletForm.bankDetails')}</h4>

                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('walletForm.bankName')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('walletForm.bankNamePlaceholder')}
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
                        <FormLabel>{t('walletForm.accountNumber')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('walletForm.accountNumberPlaceholder')}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('walletForm.accountNumberHint')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Appearance */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">{t('walletForm.appearance')}</h4>

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('walletForm.color')}</FormLabel>
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
                      <FormLabel>{t('walletForm.icon')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
                    <FormLabel>{t('walletForm.notesOptional')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('walletForm.notesPlaceholder')}
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
              <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                <h4 className="text-sm font-medium mb-2">{t('walletForm.preview')}</h4>
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
                      {form.watch('name') || t('walletForm.previewFallback')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedType.replace('_', ' ')} &bull; {form.watch('currency')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                {t('walletForm.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? t('editWallet.saving') : t('editWallet.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
