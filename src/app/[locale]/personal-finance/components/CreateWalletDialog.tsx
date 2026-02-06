"use client";

import React, { useState } from 'react';

const CreateWalletDialog = () => {
  const [name, setName] = useState('');
  const [type, setType] = useState('Cash');

  const handleSubmit = () => {
    // TODO: Save the new wallet to the database
    console.log('Wallet Name:', name, 'Type:', type);
  };

  return (
    <div>
      <h2>Create New Wallet</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Name:</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="type">Type:</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="Cash">Cash</option>
          <option value="BankAccount">Bank Account</option>
          <option value="CreditCard">Credit Card</option>
        </select>

        <button type="submit">Create</button>
      </form>
    </div>
  );
};

export default CreateWalletDialog;