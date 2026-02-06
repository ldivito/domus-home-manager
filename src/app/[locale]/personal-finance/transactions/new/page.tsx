'use client'

import { useSearchParams } from 'next/navigation'
import { TransactionForm } from '../components/TransactionForm'
import { TransactionType } from '@/types/personal-finance'

export default function NewTransactionPage() {
  const searchParams = useSearchParams()
  const type = searchParams.get('type') as TransactionType || 'expense'

  return (
    <div className="container mx-auto py-6">
      <TransactionForm 
        initialType={type}
        onSuccess={() => {
          // Will redirect to transactions list
        }}
      />
    </div>
  )
}