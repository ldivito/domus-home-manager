// /personal-finance/wallets/[walletId]/page.tsx

import React from 'react';

const WalletDetailPage = async ({ params }: { params: Promise<{ walletId: string }> }) => {
  const { walletId } = await params;

  return (
    <div>
      <h1>Wallet Detail</h1>
      <p>Wallet ID: {walletId}</p>
      {/* TODO: Display wallet details here */}
    </div>
  );
};

export default WalletDetailPage;