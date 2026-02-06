'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Hook for keyboard navigation within financial components
 * Provides arrow key navigation, Enter/Space activation, and Escape handling
 */
export function useKeyboardNavigation<T extends HTMLElement>({
  items,
  onItemActivate,
  onEscape,
  circular = true,
  autoFocus = false
}: {
  items: Array<{ id: string; element?: T | null }>
  onItemActivate?: (item: { id: string; element?: T | null }, index: number) => void
  onEscape?: () => void
  circular?: boolean
  autoFocus?: boolean
}) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto focus first item if requested
  useEffect(() => {
    if (autoFocus && items.length > 0 && activeIndex === -1) {
      setActiveIndex(0)
    }
  }, [autoFocus, items.length, activeIndex])

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        return
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          setActiveIndex((current) => {
            if (current === -1) return 0
            if (current === items.length - 1) {
              return circular ? 0 : current
            }
            return current + 1
          })
          break

        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          setActiveIndex((current) => {
            if (current === -1) return items.length - 1
            if (current === 0) {
              return circular ? items.length - 1 : current
            }
            return current - 1
          })
          break

        case 'Home':
          event.preventDefault()
          setActiveIndex(0)
          break

        case 'End':
          event.preventDefault()
          setActiveIndex(items.length - 1)
          break

        case 'Enter':
        case ' ':
          event.preventDefault()
          if (activeIndex !== -1 && activeIndex < items.length) {
            onItemActivate?.(items[activeIndex], activeIndex)
          }
          break

        case 'Escape':
          event.preventDefault()
          setActiveIndex(-1)
          onEscape?.()
          break

        default:
          // Handle alphanumeric keys for quick navigation
          if (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) {
            const key = event.key.toLowerCase()
            const startIndex = activeIndex === -1 ? 0 : activeIndex + 1
            
            // Search from current position to end
            for (let i = startIndex; i < items.length; i++) {
              const item = items[i]
              if (item.id.toLowerCase().startsWith(key)) {
                event.preventDefault()
                setActiveIndex(i)
                return
              }
            }
            
            // Search from beginning to current position
            for (let i = 0; i < startIndex; i++) {
              const item = items[i]
              if (item.id.toLowerCase().startsWith(key)) {
                event.preventDefault()
                setActiveIndex(i)
                return
              }
            }
          }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, items, onItemActivate, onEscape, circular])

  // Focus active element
  useEffect(() => {
    if (activeIndex !== -1 && activeIndex < items.length) {
      const activeItem = items[activeIndex]
      if (activeItem.element) {
        activeItem.element.focus()
      }
    }
  }, [activeIndex, items])

  return {
    containerRef,
    activeIndex,
    setActiveIndex,
    isItemActive: (index: number) => index === activeIndex,
    getItemProps: (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      'aria-selected': index === activeIndex,
      'data-active': index === activeIndex
    })
  }
}

/**
 * Hook for managing focus within modals and dialogs
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean = true) {
  const containerRef = useRef<T>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    
    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement

    // Find focusable elements
    const getFocusableElements = () => {
      const selectors = [
        'button',
        '[href]',
        'input',
        'select', 
        'textarea',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
      ].join(', ')
      
      return Array.from(container.querySelectorAll(selectors)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1'
      ) as HTMLElement[]
    }

    // Focus first element
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      
      // Restore previous focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [active])

  return containerRef
}

/**
 * Hook for accessible announcements to screen readers
 */
export function useScreenReaderAnnouncement() {
  const [announcement, setAnnouncement] = useState('')

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement(message)
    
    // Clear announcement after it's been read
    setTimeout(() => {
      setAnnouncement('')
    }, 1000)
  }

  return { announce, announcement }
}

/**
 * Hook for skip navigation links
 */
export function useSkipNavigation(skipLinks: Array<{ id: string; label: string }>) {
  const [showSkipLinks, setShowSkipLinks] = useState(false)

  const handleSkipLinkFocus = () => setShowSkipLinks(true)
  const handleSkipLinkBlur = () => setShowSkipLinks(false)

  const skipTo = (targetId: string) => {
    const target = document.getElementById(targetId)
    if (target) {
      target.focus()
      // Ensure the element is focusable
      if (target.tabIndex === -1) {
        target.tabIndex = -1
      }
    }
  }

  return { 
    skipTo, 
    showSkipLinks, 
    handleSkipLinkFocus, 
    handleSkipLinkBlur,
    skipLinks
  }
}