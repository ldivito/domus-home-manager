'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface ResponsiveGridProps {
  children: ReactNode
  className?: string
  cols?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
    '2xl'?: number
  }
  gap?: number
}

/**
 * Responsive grid component optimized for personal finance layouts
 * Provides sensible defaults for different screen sizes
 */
export default function ResponsiveGrid({ 
  children, 
  className, 
  cols = {
    default: 1,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4
  },
  gap = 4 
}: ResponsiveGridProps) {
  const gridClass = cn(
    'grid',
    `gap-${gap}`,
    cols.default && `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
    cols['2xl'] && `2xl:grid-cols-${cols['2xl']}`,
    className
  )
  
  return <div className={gridClass}>{children}</div>
}

/**
 * Card wrapper that adjusts for different screen sizes
 */
export function ResponsiveCard({ 
  children, 
  className,
  fullWidthOnMobile = true 
}: { 
  children: ReactNode
  className?: string
  fullWidthOnMobile?: boolean
}) {
  return (
    <div className={cn(
      fullWidthOnMobile && 'col-span-full sm:col-span-1',
      className
    )}>
      {children}
    </div>
  )
}

/**
 * Stack component that changes from vertical on mobile to horizontal on desktop
 */
export function ResponsiveStack({ 
  children, 
  className,
  direction = 'vertical-mobile' // 'vertical-mobile' | 'horizontal-mobile' | 'always-vertical' | 'always-horizontal'
}: { 
  children: ReactNode
  className?: string
  direction?: 'vertical-mobile' | 'horizontal-mobile' | 'always-vertical' | 'always-horizontal'
}) {
  const stackClass = cn(
    'flex gap-4',
    {
      'flex-col md:flex-row': direction === 'vertical-mobile',
      'flex-row md:flex-col': direction === 'horizontal-mobile',
      'flex-col': direction === 'always-vertical',
      'flex-row': direction === 'always-horizontal'
    },
    className
  )
  
  return <div className={stackClass}>{children}</div>
}

/**
 * Responsive text that adjusts size based on screen size
 */
export function ResponsiveText({ 
  children, 
  size = 'body',
  className
}: { 
  children: ReactNode
  size?: 'xs' | 'sm' | 'body' | 'lg' | 'xl' | 'title' | 'heading'
  className?: string
}) {
  const textClass = cn(
    {
      'text-xs sm:text-sm': size === 'xs',
      'text-sm sm:text-base': size === 'sm',
      'text-base sm:text-lg': size === 'body',
      'text-lg sm:text-xl': size === 'lg',
      'text-xl sm:text-2xl': size === 'xl',
      'text-2xl sm:text-3xl lg:text-4xl': size === 'title',
      'text-3xl sm:text-4xl lg:text-5xl': size === 'heading'
    },
    className
  )
  
  return <span className={textClass}>{children}</span>
}

/**
 * Responsive button group that stacks vertically on mobile
 */
export function ResponsiveButtonGroup({ 
  children, 
  className,
  stackOnMobile = true
}: { 
  children: ReactNode
  className?: string
  stackOnMobile?: boolean
}) {
  return (
    <div className={cn(
      'flex gap-2',
      stackOnMobile ? 'flex-col sm:flex-row' : 'flex-row flex-wrap',
      className
    )}>
      {children}
    </div>
  )
}