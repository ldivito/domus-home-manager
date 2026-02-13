'use client'

import React from 'react';
import { useTranslations } from 'next-intl';
import { CreateWalletDialog } from '../components/CreateWalletDialog';

const NewWalletPage = () => {
  const t = useTranslations('personalFinance')

  return (
    <div>
      <h1>{t('walletForm.createTitle')}</h1>
      <CreateWalletDialog />
    </div>
  );
};

export default NewWalletPage;
