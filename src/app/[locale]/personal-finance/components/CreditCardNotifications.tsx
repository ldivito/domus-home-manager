'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Bell, 
  CreditCard, 
  Calendar,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { 
  getAllCreditCardNotifications,
  getNotificationSummary,
  formatNotificationForDisplay,
  CreditCardNotification
} from '@/lib/utils/finance'
import { formatCurrency } from '@/lib/utils/finance'

interface CreditCardNotificationsProps {
  userId: string
  compact?: boolean
  showAll?: boolean
  onNotificationClick?: (notification: CreditCardNotification) => void
}

export default function CreditCardNotifications({
  userId,
  compact = false,
  showAll = false,
  onNotificationClick
}: CreditCardNotificationsProps) {
  const [notifications, setNotifications] = useState<CreditCardNotification[]>([])
  const [summary, setSummary] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    overdue: 0,
    dueSoon: 0,
    closingSoon: 0,
    usageAlerts: 0
  })
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    loadNotifications()
  }, [userId, showAll])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      
      const [notifs, summaryData] = await Promise.all([
        getAllCreditCardNotifications(userId),
        getNotificationSummary(userId)
      ])
      
      setNotifications(notifs)
      setSummary(summaryData)
    } catch (error) {
      console.error('Error loading credit card notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const getNotificationIcon = (notification: CreditCardNotification) => {
    const displayInfo = formatNotificationForDisplay(notification)
    return displayInfo.icon
  }

  const getNotificationColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <Bell className="h-5 w-5 mr-2" />
          <CardTitle className="text-base">Credit Card Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
          <CardTitle className="text-base">Credit Card Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-green-600 mb-2">
              <CheckCircle className="h-8 w-8 mx-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              All credit cards are up to date!
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const displayNotifications = expanded || showAll 
    ? notifications 
    : notifications.slice(0, compact ? 2 : 5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <Bell className="h-5 w-5" />
          <CardTitle className="text-base">Credit Card Alerts</CardTitle>
          {summary.total > 0 && (
            <Badge variant="destructive" className="text-xs px-2">
              {summary.total}
            </Badge>
          )}
        </div>
        {!showAll && notifications.length > (compact ? 2 : 5) && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : `Show All (${notifications.length})`}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Priority Summary */}
        {(summary.critical > 0 || summary.high > 0) && !compact && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {summary.critical > 0 && (
                <span className="font-semibold">
                  {summary.critical} critical alert{summary.critical > 1 ? 's' : ''} need immediate attention.
                </span>
              )}
              {summary.critical > 0 && summary.high > 0 && ' '}
              {summary.high > 0 && (
                <span>
                  {summary.high} high priority alert{summary.high > 1 ? 's' : ''}.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Notification List */}
        <div className="space-y-3">
          {displayNotifications.map((notification) => {
            const displayInfo = formatNotificationForDisplay(notification)
            
            return (
              <div
                key={notification.id}
                className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-sm ${getPriorityColor(notification.priority)}`}
                onClick={() => onNotificationClick?.(notification)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 text-lg">
                    {displayInfo.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm mb-1">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <CreditCard className="h-3 w-3" />
                            <span>{notification.walletName}</span>
                          </div>
                          
                          {notification.type !== 'minimum_payment_alert' && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {notification.daysUntilDue === 0 
                                  ? 'Today'
                                  : notification.daysUntilDue < 0 
                                    ? `${Math.abs(notification.daysUntilDue)} days ago`
                                    : `${notification.daysUntilDue} days`
                                }
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-3 w-3" />
                            <span>
                              {formatCurrency(notification.amount, notification.currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-1">
                        <Badge 
                          variant={getNotificationColor(notification.priority)} 
                          className="text-xs"
                        >
                          {displayInfo.urgencyText}
                        </Badge>
                        
                        {notification.priority === 'critical' && (
                          <div className="text-xs text-red-600 font-medium">
                            Action Required
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Suggestion */}
                    {displayInfo.actionSuggestion && !compact && (
                      <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                        💡 {displayInfo.actionSuggestion}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Quick Actions */}
                {notification.type === 'due_soon' || notification.type === 'overdue' ? (
                  <div className="mt-3 flex space-x-2">
                    <Link href={`/personal-finance/credit-cards/${notification.walletId}/pay`}>
                      <Button size="sm" className="h-7 text-xs">
                        Pay Now
                      </Button>
                    </Link>
                    <Link href={`/personal-finance/credit-cards/${notification.walletId}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        View Details
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* Summary Stats */}
        {!compact && notifications.length > 0 && (
          <div className="border-t pt-3 mt-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-center p-2 bg-muted rounded">
                <div className="font-semibold text-red-600">{summary.overdue}</div>
                <div className="text-muted-foreground">Overdue</div>
              </div>
              <div className="text-center p-2 bg-muted rounded">
                <div className="font-semibold text-orange-600">{summary.dueSoon}</div>
                <div className="text-muted-foreground">Due Soon</div>
              </div>
              <div className="text-center p-2 bg-muted rounded">
                <div className="font-semibold text-blue-600">{summary.closingSoon}</div>
                <div className="text-muted-foreground">Closing Soon</div>
              </div>
              <div className="text-center p-2 bg-muted rounded">
                <div className="font-semibold text-yellow-600">{summary.usageAlerts}</div>
                <div className="text-muted-foreground">Usage Alerts</div>
              </div>
            </div>
          </div>
        )}

        {/* View All Link */}
        {!showAll && !expanded && notifications.length > (compact ? 2 : 5) && (
          <div className="text-center pt-2 border-t">
            <Link href="/personal-finance/credit-cards/notifications">
              <Button variant="ghost" size="sm" className="text-xs">
                View All Notifications ({notifications.length})
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}