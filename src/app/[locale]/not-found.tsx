import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'

// Neutral bilingual texts (no new message keys needed for this boundary)
const texts = {
  en: {
    title: 'Page not found',
    description: 'The page you are looking for does not exist or was moved.',
    home: 'Go to home',
  },
  es: {
    title: 'Página no encontrada',
    description: 'La página que buscás no existe o fue movida.',
    home: 'Ir al inicio',
  },
} as const

export default async function LocaleNotFound() {
  const rawLocale = await getLocale()
  const locale = rawLocale === 'es' ? 'es' : 'en'
  const t = texts[locale]

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="max-w-md text-muted-foreground">{t.description}</p>
      <Button asChild>
        <Link href="/">{t.home}</Link>
      </Button>
    </div>
  )
}
