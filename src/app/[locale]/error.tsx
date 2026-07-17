'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Neutral bilingual texts: this boundary must render even if the i18n
// message context itself is part of what crashed, so we avoid useTranslations.
const texts = {
  en: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Your data is stored locally and is safe.',
    retry: 'Try again',
    home: 'Go to home',
  },
  es: {
    title: 'Algo salió mal',
    description: 'Ocurrió un error inesperado. Tus datos están guardados localmente y a salvo.',
    retry: 'Reintentar',
    home: 'Ir al inicio',
  },
} as const

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams<{ locale: string }>()
  const locale = params?.locale === 'es' ? 'es' : 'en'
  const t = texts[locale]

  useEffect(() => {
    console.error('Unhandled error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" aria-hidden="true" />
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="max-w-md text-muted-foreground">{t.description}</p>
      <div className="flex gap-3">
        <Button onClick={reset}>{t.retry}</Button>
        {/* Hard navigation on purpose: after a crash we want a clean reload */}
        <Button variant="outline" asChild>
          <a href={`/${locale}`}>{t.home}</a>
        </Button>
      </div>
    </div>
  )
}
