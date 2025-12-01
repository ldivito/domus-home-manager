'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MaintenanceItem, MaintenanceTask, MaintenanceLog } from '@/lib/db'
import {
  Plus,
  Pencil,
  Calendar,
  MapPin,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  DollarSign
} from 'lucide-react'

interface ItemDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MaintenanceItem | null
  tasks: MaintenanceTask[]
  logs: MaintenanceLog[]
  onAddTask: () => void
  onEditItem: () => void
}

const ITEM_TYPE_COLORS: Record<string, string> = {
  appliance: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  hvac: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  plumbing: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  electrical: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  vehicle: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  roof: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  exterior: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  landscaping: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  pool: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  security: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
}

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
}

export function ItemDetailDialog({
  open,
  onOpenChange,
  item,
  tasks,
  logs,
  onAddTask,
  onEditItem
}: ItemDetailDialogProps) {
  const t = useTranslations('maintenance')

  if (!item) return null

  const isOverdue = (date: Date) => new Date(date) < new Date()
  const formatDate = (date: Date) => new Date(date).toLocaleDateString()

  const sortedTasks = [...tasks].sort((a, b) =>
    new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime()
  )

  const recentLogs = logs.slice(0, 5)

  // Calculate total maintenance cost from logs
  const totalCost = logs.reduce((sum, log) => sum + (log.actualCost || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{item.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={ITEM_TYPE_COLORS[item.type] || ITEM_TYPE_COLORS.other}>
                  {t(`itemTypes.${item.type}`)}
                </Badge>
                {item.location && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {item.location}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onEditItem}>
                <Pencil className="h-4 w-4 mr-1" />
                {t('actions.edit')}
              </Button>
              <Button size="sm" onClick={onAddTask}>
                <Plus className="h-4 w-4 mr-1" />
                {t('actions.addTask')}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Item Details */}
          {(item.brand || item.model || item.serialNumber) && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
              {item.brand && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('form.brand')}</p>
                  <p className="font-medium">{item.brand}</p>
                </div>
              )}
              {item.model && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('form.model')}</p>
                  <p className="font-medium">{item.model}</p>
                </div>
              )}
              {item.serialNumber && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('form.serialNumber')}</p>
                  <p className="font-medium font-mono text-sm">{item.serialNumber}</p>
                </div>
              )}
            </div>
          )}

          {/* Dates and Warranty */}
          <div className="grid grid-cols-2 gap-4">
            {item.purchaseDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('form.purchaseDate')}</p>
                  <p className="font-medium">{formatDate(item.purchaseDate)}</p>
                </div>
              </div>
            )}
            {item.warrantyExpirationDate && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('form.warrantyExpiration')}</p>
                  <p className={`font-medium ${isOverdue(item.warrantyExpirationDate) ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {formatDate(item.warrantyExpirationDate)}
                    {isOverdue(item.warrantyExpirationDate) && ` (${t('expired')})`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <h3 className="font-medium mb-2">{t('form.description')}</h3>
              <p className="text-muted-foreground">{item.description}</p>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div>
              <h3 className="font-medium mb-2">{t('form.notes')}</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}

          <Separator />

          {/* Scheduled Tasks */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('scheduledTasks')} ({tasks.length})
            </h3>
            {sortedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{t('noScheduledTasks')}</p>
            ) : (
              <div className="space-y-2">
                {sortedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 border rounded-lg ${isOverdue(task.nextDue) ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.name}</span>
                        <Badge className={PRIORITY_COLORS[task.priority]}>
                          {t(`priorities.${task.priority}`)}
                        </Badge>
                      </div>
                      <div className={`text-sm flex items-center gap-1 ${isOverdue(task.nextDue) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                        {isOverdue(task.nextDue) ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <Calendar className="h-3.5 w-3.5" />
                        )}
                        {formatDate(task.nextDue)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t(`frequencies.${task.frequency}`)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Maintenance History */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              {t('maintenanceHistory')} ({logs.length})
            </h3>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{t('noMaintenanceHistory')}</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div key={log.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{log.title}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(log.completedDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      {log.actualCost && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          {log.costCurrency || 'ARS'} {log.actualCost.toLocaleString()}
                        </span>
                      )}
                      {log.serviceProvider && (
                        <span>{log.serviceProvider}</span>
                      )}
                      <Badge variant={log.isExternalService ? 'secondary' : 'outline'} className="text-xs">
                        {log.isExternalService ? t('professional') : t('diy')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total Cost Summary */}
            {totalCost > 0 && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('totalMaintenanceCost')}</p>
                <p className="text-lg font-bold">ARS {totalCost.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
