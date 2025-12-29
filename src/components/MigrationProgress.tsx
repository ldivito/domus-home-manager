'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Database, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { checkMigrationNeeded, performMigration, type MigrationResult } from '@/lib/migration'
import { logger } from '@/lib/logger'

export default function MigrationProgress() {
  const t = useTranslations('migration')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkMigration()
  }, [])

  const checkMigration = async () => {
    try {
      const status = await checkMigrationNeeded()
      setNeedsMigration(status.needsMigration || false)
    } catch (err) {
      logger.error('Error checking migration:', err)
    }
  }

  const handleMigrate = async () => {
    setIsMigrating(true)
    setError(null)

    try {
      const migrationResult = await performMigration()
      setResult(migrationResult)

      if (migrationResult.success) {
        // Wait a moment then reload the page
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setError(migrationResult.error || 'Migration failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setIsMigrating(false)
    }
  }

  // Don't show anything if migration is not needed
  if (!needsMigration && !result) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">{t('title')}</h2>
        </div>

        {!result && (
          <>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('description')}
              </p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {t('warning')}
                </p>
              </div>
            </div>

            <Button
              onClick={handleMigrate}
              disabled={isMigrating}
              className="w-full"
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('migrating')}
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  {t('startMigration')}
                </>
              )}
            </Button>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </>
        )}

        {result && result.success && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  {t('success')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('migrated', {
                    records: result.recordsMigrated,
                    tables: result.tablesProcessed.length
                  })}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {t('reloading')}
            </p>
          </div>
        )}

        {result && !result.success && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  {t('failed')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {result.error}
                </p>
              </div>
            </div>
            <Button
              onClick={handleMigrate}
              variant="outline"
              className="w-full"
            >
              {t('retry')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
