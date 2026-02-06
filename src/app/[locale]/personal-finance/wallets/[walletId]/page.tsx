// /personal-finance/wallets/[walletId]/page.tsx

import React from 'react';

const WalletDetailPage = ({ params }) => {
  const { walletId } = params;

  return (
    <div>
      <h1>Wallet Detail</h1>
      <p>Wallet ID: {walletId}</p>
      {/* TODO: Display wallet details here */}
    </div>
  );
};

export default WalletDetailPage;