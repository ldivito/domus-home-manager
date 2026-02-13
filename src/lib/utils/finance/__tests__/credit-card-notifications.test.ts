import { describe, it, expect } from 'vitest'
import { formatNotificationForDisplay, CreditCardNotification } from '../credit-card-notifications'

function createNotification(overrides: Partial<CreditCardNotification> = {}): CreditCardNotification {
  return {
    id: 'notif_1',
    walletId: 'pw_1',
    walletName: 'Test CC',
    statementId: 'stmt_1',
    type: 'due_soon',
    title: 'Test Notification',
    message: 'Test message',
    dueDate: new Date('2025-06-20'),
    amount: 5000,
    currency: 'ARS',
    daysUntilDue: 3,
    priority: 'medium',
    createdAt: new Date(),
    ...overrides,
  }
}

describe('formatNotificationForDisplay', () => {
  it('formats overdue notification with red color', () => {
    const notif = createNotification({ type: 'overdue' })
    const result = formatNotificationForDisplay(notif)
    expect(result.icon).toBe('🚨')
    expect(result.color).toBe('red')
    expect(result.urgencyText).toBe('OVERDUE')
    expect(result.actionSuggestion).toContain('immediately')
  })

  it('formats high-priority due_soon (due today) notification', () => {
    const notif = createNotification({
      type: 'due_soon',
      priority: 'high',
      daysUntilDue: 0,
    })
    const result = formatNotificationForDisplay(notif)
    expect(result.icon).toBe('⚡')
    expect(result.color).toBe('orange')
    expect(result.urgencyText).toBe('DUE TODAY')
  })

  it('formats high-priority due_soon (due tomorrow) notification', () => {
    const notif = createNotification({
      type: 'due_soon',
      priority: 'high',
      daysUntilDue: 1,
    })
    const result = formatNotificationForDisplay(notif)
    expect(result.urgencyText).toBe('DUE TOMORROW')
  })

  it('formats medium-priority due_soon notification', () => {
    const notif = createNotification({
      type: 'due_soon',
      priority: 'medium',
      daysUntilDue: 3,
    })
    const result = formatNotificationForDisplay(notif)
    expect(result.icon).toBe('⏰')
    expect(result.color).toBe('yellow')
    expect(result.urgencyText).toBe('3 days left')
  })

  it('formats closing_soon notification', () => {
    const notif = createNotification({ type: 'closing_soon' })
    const result = formatNotificationForDisplay(notif)
    expect(result.icon).toBe('📊')
    expect(result.color).toBe('blue')
    expect(result.urgencyText).toBe('Closing soon')
  })

  it('formats critical minimum_payment_alert notification', () => {
    const notif = createNotification({
      type: 'minimum_payment_alert',
      priority: 'critical',
    })
    const result = formatNotificationForDisplay(notif)
    expect(result.icon).toBe('⚠️')
    expect(result.color).toBe('red')
    expect(result.urgencyText).toBe('NEAR LIMIT')
  })

  it('formats medium minimum_payment_alert notification', () => {
    const notif = createNotification({
      type: 'minimum_payment_alert',
      priority: 'medium',
    })
    const result = formatNotificationForDisplay(notif)
    expect(result.color).toBe('orange')
    expect(result.urgencyText).toBe('HIGH USAGE')
  })
})
