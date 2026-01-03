import type { Metadata, Viewport } from "next";
import "../globals.css";
import Navigation from "@/components/Navigation";
import MobileNavigation from "@/components/MobileNavigation";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SyncProvider } from "@/contexts/SyncContext";
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#7c3aed' },
    { media: '(prefers-color-scheme: dark)', color: '#7c3aed' },
  ],
};

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });

  return {
    title: `${t('appName')} - ${t('appSubtitle')}`,
    description: "A tablet-first home management app for families",
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: t('appName'),
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: [
        { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: [
        { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    other: {
      'mobile-web-app-capable': 'yes',
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <SyncProvider>
              <div className="flex h-screen bg-background">
                {/* Sidebar navigation - hidden on mobile */}
                <div className="hidden md:block">
                  <Navigation />
                </div>
                <main className="flex-1 overflow-auto pb-20 md:pb-0">
                  {children}
                </main>
                {/* Mobile bottom navigation - visible only on mobile */}
                <div className="md:hidden">
                  <MobileNavigation />
                </div>
              </div>
              <Toaster />
              <PWAInstallPrompt />
              <ServiceWorkerRegistration />
            </SyncProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}