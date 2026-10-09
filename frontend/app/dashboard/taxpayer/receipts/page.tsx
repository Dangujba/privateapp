'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { api, apiError, type PaymentRecord } from '@/lib/api';

export default function ReceiptsPage() {
  const [items, setItems] = useState<PaymentRecord[]>([]); const [error, setError] = useState('');
  useEffect(() => { api.getPayments({ status: 'confirmed', limit: 100 }).then(data => setItems(data.payments)).catch(err => setError(apiError(err))); }, []);
  return <main className="min-h-screen p-6"><div className="mx-auto max-w-4xl"><Link href="/dashboard/taxpayer" className="mb-6 inline-flex items-center text-gray-600"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link><h1 className="text-2xl font-bold">Receipts</h1><p className="mb-6 text-gray-500">Receipts exist only for independently confirmed transactions.</p>{error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}<div className="space-y-3">{items.map(item => <Link key={item.id} href={`/dashboard/taxpayer/receipts/${item.id}`} className="glass-card flex items-center justify-between p-5 hover:border-primary-400"><div className="flex items-center gap-4"><FileText className="h-6 w-6 text-primary-500" /><div><p className="font-semibold">{item.transactionNumber}</p><p className="text-sm text-gray-500">{new Date(item.confirmedAt ?? item.createdAt).toLocaleString()}</p></div></div><strong>₦{item.totalNgn.toLocaleString()}</strong></Link>)}{items.length === 0 && !error && <div className="glass-card p-10 text-center text-gray-500">No confirmed receipts yet.</div>}</div></div></main>;
}
