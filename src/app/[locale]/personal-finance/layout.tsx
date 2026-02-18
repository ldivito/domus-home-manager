import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import PersonalFinanceNav from './components/PersonalFinanceNav'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('personalFinance')
  
  return {
    title: t('title'),
    description: t('description')
  }
}

export default async function PersonalFinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations('personalFinance')

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-4 sm:pt-6">
      {/* Skip Navigation */}
      <div className="sr-only focus-within:not-sr-only">
        <a 
          href="#main-content" 
          className="block bg-primary text-primary-foreground px-4 py-2 text-sm font-medium focus:absolute focus:top-0 focus:left-0 z-50"
        >
          {t('layout.skipToMainContent')}
        </a>
        <a 
          href="#navigation" 
          className="block bg-primary text-primary-foreground px-4 py-2 text-sm font-medium focus:absolute focus:top-8 focus:left-0 z-50"
        >
          {t('layout.skipToNavigation')}
        </a>
      </div>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </header>
      
      {/* Navigation */}
      <nav id="navigation" aria-label={t('layout.navAriaLabel')}>
        <PersonalFinanceNav />
      </nav>
      
      {/* Main Content */}
      <main id="main-content" role="main" className="space-y-6">
        {children}
      </main>
      
      {/* Screen Reader Announcements */}
      <div 
        id="sr-announcements" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      />
    </div>
  )
}
