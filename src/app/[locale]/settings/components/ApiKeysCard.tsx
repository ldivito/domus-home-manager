'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Copy, KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { logger } from '@/lib/logger'

interface ApiKeyInfo {
  id: string
  name: string
  prefix: string
  scopes: Array<'read' | 'write'>
  householdId: string | null
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

type ScopeChoice = 'readWrite' | 'read'

/** Settings section to create, list and revoke API keys for the /api/v1 data API. */
export function ApiKeysCard() {
  const t = useTranslations('settings.apiKeys')
  const locale = useLocale()
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [name, setName] = useState('')
  const [scopeChoice, setScopeChoice] = useState<ScopeChoice>('readWrite')
  const [isCreating, setIsCreating] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyInfo | null>(null)

  const loadKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/api-keys', { credentials: 'include' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json() as { keys: ApiKeyInfo[] }
      setKeys(data.keys)
    } catch (error) {
      logger.error('Failed to load API keys:', error)
      toast.error(t('loadError'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsCreating(true)
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scopes: scopeChoice === 'read' ? ['read'] : ['read', 'write']
        })
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json() as { key: ApiKeyInfo; secret: string }
      setNewSecret(data.secret)
      setCopied(false)
      setName('')
      setKeys(prev => [data.key, ...prev])
      toast.success(t('created'))
    } catch (error) {
      logger.error('Failed to create API key:', error)
      toast.error(t('createError'))
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!newSecret) return
    try {
      await navigator.clipboard.writeText(newSecret)
      setCopied(true)
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyError'))
    }
  }

  const handleRevoke = async () => {
    const key = keyToRevoke
    setKeyToRevoke(null)
    if (!key) return
    try {
      const response = await fetch(`/api/api-keys/${encodeURIComponent(key.id)}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json() as { revokedAt: string }
      setKeys(prev => prev.map(k => (k.id === key.id ? { ...k, revokedAt: data.revokedAt } : k)))
      toast.success(t('revoked'))
    } catch (error) {
      logger.error('Failed to revoke API key:', error)
      toast.error(t('revokeError'))
    }
  }

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : t('never')

  return (
    <Card className="glass-card shadow-modern">
      <CardHeader className="pb-4 md:pb-6">
        <CardTitle className="text-xl md:text-2xl flex items-center">
          <KeyRound className="mr-2 md:mr-3 h-5 w-5 md:h-6 md:w-6 text-primary" />
          {t('title')}
        </CardTitle>
        <CardDescription className="text-sm">{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-6">
        {/* Create */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div className="space-y-2">
            <Label htmlFor="apiKeyName" className="text-sm">{t('name')}</Label>
            <Input
              id="apiKeyName"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              disabled={isCreating}
              className="h-10 md:h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">{t('permissions')}</Label>
            <Select value={scopeChoice} onValueChange={(value) => setScopeChoice(value as ScopeChoice)}>
              <SelectTrigger className="h-10 md:h-11 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="readWrite">{t('scopeReadWrite')}</SelectItem>
                <SelectItem value="read">{t('scopeRead')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim()} className="h-10 md:h-11">
            {isCreating ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {t('create')}
          </Button>
        </div>

        {/* Secret shown once */}
        {newSecret && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 md:p-4 space-y-2">
            <p className="text-sm font-medium">{t('secretTitle')}</p>
            <p className="text-xs md:text-sm text-muted-foreground">{t('secretWarning')}</p>
            <div className="flex gap-2">
              <code className="flex-1 min-w-0 truncate rounded-md bg-muted px-3 py-2 text-xs md:text-sm" title={newSecret}>
                {newSecret}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">{t('copy')}</span>
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setNewSecret(null)}>{t('done')}</Button>
          </div>
        )}

        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            keys.map(key => (
              <div
                key={key.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-border rounded-lg bg-muted/20"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm md:text-base truncate">{key.name}</span>
                    <code className="text-xs text-muted-foreground">{key.prefix}…</code>
                    {key.scopes.map(scope => (
                      <Badge key={scope} variant="secondary" className="text-xs">
                        {scope === 'read' ? t('scopeReadBadge') : t('scopeWriteBadge')}
                      </Badge>
                    ))}
                    {key.revokedAt && <Badge variant="destructive" className="text-xs">{t('revokedBadge')}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('createdAt', { date: formatDate(key.createdAt) })} · {t('lastUsed', { date: formatDate(key.lastUsedAt) })}
                  </p>
                </div>
                {!key.revokedAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setKeyToRevoke(key)}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('revoke')}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t('docsHint')}</p>
      </CardContent>

      <AlertDialog open={!!keyToRevoke} onOpenChange={(open) => !open && setKeyToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('revokeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('revokeConfirm', { name: keyToRevoke?.name ?? '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke}>{t('revoke')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
