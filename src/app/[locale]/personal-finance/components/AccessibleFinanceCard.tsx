'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface AccessibleFinanceCardProps {
  title: string
  value: string | number
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: ReactNode
  className?: string
  onClick?: () => void
  href?: string
  loading?: boolean
  error?: boolean
  ariaLabel?: string
  role?: string
}

/**
 * Accessible card component for displaying financial data
 * Includes proper ARIA labels, keyboard navigation, and screen reader support
 */
export default function AccessibleFinanceCard({
  title,
  value,
  description,
  trend,
  trendValue,
  icon,
  className,
  onClick,
  href,
  loading = false,
  error = false,
  ariaLabel,
  role = 'article'
}: AccessibleFinanceCardProps) {
  const isInteractive = onClick || href
  const Component = href ? 'a' : 'div'
  
  // Generate accessible description
  const accessibleValue = typeof value === 'number' 
    ? new Intl.NumberFormat('en-US').format(value)
    : value
  
  const trendDescription = trend && trendValue 
    ? `${trend === 'up' ? 'increased' : trend === 'down' ? 'decreased' : 'unchanged'} by ${trendValue}`
    : ''
  
  const fullAriaLabel = ariaLabel || 
    `${title}: ${accessibleValue}${description ? `. ${description}` : ''}${trendDescription ? `. ${trendDescription}` : ''}`

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)} role="status" aria-label="Loading financial data">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-4 w-4 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-muted rounded w-3/4 mb-2" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn('border-destructive/50 bg-destructive/5', className)} role="alert">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-destructive">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">Error</div>
          <p className="text-xs text-destructive/80">Failed to load data</p>
        </CardContent>
      </Card>
    )
  }

  const cardContent = (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium" id={`title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
          {title}
        </CardTitle>
        <div className="text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div 
          className="text-2xl font-bold"
          aria-describedby={description ? `desc-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined}
        >
          {accessibleValue}
        </div>
        {description && (
          <p 
            className="text-xs text-muted-foreground"
            id={`desc-${title.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {description}
          </p>
        )}
        {trend && trendValue && (
          <div className="flex items-center gap-1 mt-1">
            <span
              className={cn(
                'text-xs font-medium',
                trend === 'up' && 'text-green-600',
                trend === 'down' && 'text-red-600',
                trend === 'neutral' && 'text-muted-foreground'
              )}
              aria-label={trendDescription}
            >
              {trend === 'up' && '↗'}
              {trend === 'down' && '↘'}
              {trend === 'neutral' && '→'}
              {trendValue}
            </span>
          </div>
        )}
      </CardContent>
    </>
  )

  if (isInteractive) {
    return (
      <Card 
        className={cn(
          'cursor-pointer transition-colors hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          className
        )}
        role={role}
      >
        <Component
          href={href}
          onClick={onClick}
          className="block w-full h-full focus:outline-none"
          aria-label={fullAriaLabel}
          role={onClick ? 'button' : 'link'}
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onClick) {
              e.preventDefault()
              onClick()
            }
          }}
        >
          {cardContent}
        </Component>
      </Card>
    )
  }

  return (
    <Card 
      className={className}
      role={role}
      aria-label={fullAriaLabel}
    >
      {cardContent}
    </Card>
  )
}

/**
 * Accessible transaction row component
 */
interface AccessibleTransactionRowProps {
  id: string
  description: string
  amount: string
  date: string
  category?: string
  wallet?: string
  type: 'income' | 'expense' | 'transfer'
  onClick?: () => void
  className?: string
}

export function AccessibleTransactionRow({
  id,
  description,
  amount,
  date,
  category,
  wallet,
  type,
  onClick,
  className
}: AccessibleTransactionRowProps) {
  const typeLabel = type === 'income' ? 'income' : type === 'expense' ? 'expense' : 'transfer'
  const ariaLabel = `${typeLabel} transaction: ${description}, ${amount}, ${date}${category ? `, category: ${category}` : ''}${wallet ? `, wallet: ${wallet}` : ''}`

  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      className={cn(
        'flex items-center justify-between p-3 border rounded-lg w-full text-left',
        onClick && 'cursor-pointer hover:bg-muted/50 focus:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
      onClick={onClick}
      aria-label={ariaLabel}
      role={onClick ? 'button' : 'listitem'}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div 
          className={cn(
            'p-2 rounded-full',
            type === 'income' && 'bg-green-100 dark:bg-green-900/20',
            type === 'expense' && 'bg-red-100 dark:bg-red-900/20',
            type === 'transfer' && 'bg-blue-100 dark:bg-blue-900/20'
          )}
          aria-hidden="true"
        >
          <div className={cn(
            'w-4 h-4 rounded',
            type === 'income' && 'bg-green-600',
            type === 'expense' && 'bg-red-600',
            type === 'transfer' && 'bg-blue-600'
          )} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{description}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <time dateTime={date}>{date}</time>
            {category && (
              <>
                <span aria-hidden="true">•</span>
                <span>{category}</span>
              </>
            )}
            {wallet && (
              <>
                <span aria-hidden="true">•</span>
                <span>{wallet}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className={cn(
        'flex-shrink-0 font-bold text-right',
        type === 'income' && 'text-green-600',
        type === 'expense' && 'text-red-600',
        type === 'transfer' && 'text-blue-600'
      )}>
        <span className="sr-only">{typeLabel} amount: </span>
        {amount}
      </div>
    </Component>
  )
}

/**
 * Accessible form field wrapper with proper labeling
 */
interface AccessibleFieldProps {
  label: string
  description?: string
  error?: string
  required?: boolean
  children: ReactNode
  id: string
}

export function AccessibleField({ 
  label, 
  description, 
  error, 
  required = false, 
  children, 
  id 
}: AccessibleFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  
  return (
    <div className="space-y-2">
      <label 
        htmlFor={id}
        className={cn(
          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          error && 'text-destructive'
        )}
      >
        {label}
        {required && <span className="text-destructive ml-1" aria-label="required">*</span>}
      </label>
      
      <div 
        className={cn(error && 'has-[input]:border-destructive has-[select]:border-destructive has-[textarea]:border-destructive')}
      >
        {children}
      </div>
      
      {description && (
        <p 
          id={descriptionId}
          className="text-sm text-muted-foreground"
        >
          {description}
        </p>
      )}
      
      {error && (
        <p 
          id={errorId}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}