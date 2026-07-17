'use client'

import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { CreateWalletDialog } from '../components/CreateWalletDialog';

const NewWalletPage = () => {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  return (
    <CreateWalletDialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) {
          router.push('/personal-finance/wallets')
        }
      }}
    />
  );
};

export default NewWalletPage;
