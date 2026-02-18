'use client'

import { useEffect } from 'react'
import { useSyncContext } from '@/contexts/SyncContext'

/**
 * Componente invisible que dispara un sync silencioso al entrar a la sección de Personal Finance.
 * Asegura que los datos de Dexie estén al día con D1 apenas el usuario abre la sección.
 */
export default function PersonalFinanceSyncTrigger() {
  const { triggerSync } = useSyncContext()

  useEffect(() => {
    triggerSync(false, true) // sync silencioso al montar
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
