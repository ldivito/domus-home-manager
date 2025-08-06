import { redirect } from 'next/navigation';

// This page only renders when the user visits the root page
export default function RootPage() {
  // Redirect to default locale
  redirect('/en');
}