'use client'

import { useEffect } from 'react'
import { useSyncContext } from '@/contexts/SyncContext'

/**
 * Componente invisible que dispara un sync COMPLETO silencioso al entrar a la sección de Personal Finance.
 * Usa force=true para ignorar el lastSyncAt y asegurarse de traer todos los datos desde D1,
 * incluyendo billeteras/transacciones creadas desde otro cliente o vía API.
 */
export default function PersonalFinanceSyncTrigger() {
  const { triggerSync } = useSyncContext()

  useEffect(() => {
    triggerSync(true, true) // force full sync silencioso al montar
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
