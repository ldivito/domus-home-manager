'use client';

import { useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Download, Share, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const t = useTranslations('pwa');
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  // iOS-specific instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-card border rounded-lg p-4 shadow-lg z-50">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3 pr-4">
          <Share className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <p className="font-medium">{t('installTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('iosInstructions')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Android/Chrome install button
  if (!isInstallable) return null;

  return (
    <Button
      onClick={promptInstall}
      className="fixed bottom-24 right-4 md:bottom-4 shadow-lg z-50"
      size="lg"
    >
      <Download className="w-5 h-5 mr-2" />
      {t('installButton')}
    </Button>
  );
}
