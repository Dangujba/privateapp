'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, CheckCircle, Clock, CreditCard, FileText, History, ShieldCheck, Wallet } from 'lucide-react';
import { api, apiError, type BusinessProfileResponse, type PaymentRecord } from '@/lib/api';
import { useAuth } from '@/app/providers';

export default function BusinessDashboard() {
  const { user, token } = useAuth();
  const [data, setData] = useState<BusinessProfileResponse | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [profile, history] = await Promise.all([api.getBusinessProfile(), api.getPayments({ limit: 6 })]);
      setData(profile); setPayments(history.payments);
    } catch (err) { setError(apiError(err, 'Could not load the business dashboard')); }
  }, []);
  useEffect(() => { if (token) void load(); }, [token, load]);

  return <main className="min-h-screen p-6"><div className="mx-auto max-w-7xl">
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wider text-primary-600">YIRS Business Portal</p><h1 className="text-3xl font-bold">{data?.profile.businessName ?? 'Business Dashboard'}</h1><p className="text-gray-500">{user?.email}</p></div></header>
    {error && <p className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {data && <>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <Card icon={<Building2/>} label="TIN" value={data.profile.tin}/>
        <Card icon={<ShieldCheck/>} label="Business verification" value={data.profile.verified ? 'Verified' : 'Pending'}/>
        <Card icon={<CheckCircle/>} label="Compliance" value={data.profile.complianceStatus.replaceAll('_',' ')}/>
        <Card icon={<CreditCard/>} label="Total paid" value={`₦${data.stats.totalPaidNgn.toLocaleString()}`}/>
        <Card icon={<Clock/>} label="Pending payments" value={String(data.stats.pendingPayments)}/>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="glass-card p-6"><h2 className="text-lg font-bold">Business Profile</h2><dl className="mt-4 space-y-3 text-sm"><Row label="Business" value={data.profile.businessName}/><Row label="Category" value={data.profile.category.replaceAll('_',' ')}/><Row label="Address" value={data.profile.address || 'Not provided'}/><Row label="Confirmed payments" value={String(data.stats.confirmedPayments)}/><Row label="Last payment" value={data.stats.lastPaymentDate ? new Date(data.stats.lastPaymentDate).toLocaleDateString() : 'No payment yet'}/></dl></section>
        <section className="glass-card p-6"><h2 className="text-lg font-bold">Quick Actions</h2><div className="mt-4 space-y-3"><Link href="/dashboard/business/pay" className="btn-primary flex w-full items-center justify-center gap-2"><Wallet className="h-5 w-5"/>Make Tax / Revenue Payment</Link><Link href="/dashboard/business/transactions" className="btn-secondary flex w-full items-center justify-center gap-2"><History className="h-5 w-5"/>Payment History</Link></div><p className="mt-5 text-sm text-gray-500">Businesses and employers can use this portal for applicable remittances, assessments, levies, licences and other state revenue payments.</p></section>
        <section className="glass-card p-6"><h2 className="text-lg font-bold">Common Revenue Types</h2><div className="mt-4 flex flex-wrap gap-2">{['PAYE Remittance','Direct Assessment','Presumptive Turnover','Withholding Tax','Consumption Tax','Property Tax','Trade / Haulage','Gaming / Lottery'].map(x=><span key={x} className="badge badge-info">{x}</span>)}</div></section>
      </div>
      <section className="glass-card mt-6 overflow-hidden"><div className="flex items-center justify-between border-b p-5"><h2 className="text-lg font-bold">Recent Payments</h2><Link href="/dashboard/business/transactions" className="text-primary-600">View all</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr><th className="table-header">Reference</th><th className="table-header">Revenue Type</th><th className="table-header">Amount</th><th className="table-header">Status</th><th className="table-header">Date</th><th className="table-header">Receipt</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td className="table-cell font-mono text-xs">{p.transactionNumber}</td><td className="table-cell">{p.taxType.replaceAll('_',' ')}</td><td className="table-cell font-semibold">₦{p.amountNgn.toLocaleString()}</td><td className="table-cell"><span className={`badge ${p.status==='confirmed'?'badge-success':'badge-warning'}`}>{p.status.replaceAll('_',' ')}</span></td><td className="table-cell">{new Date(p.createdAt).toLocaleDateString()}</td><td className="table-cell">{p.status==='confirmed'?<Link className="text-primary-600" href={`/dashboard/business/receipts/${p.id}`}><FileText className="inline h-4 w-4"/> View</Link>:'—'}</td></tr>)}</tbody></table>{payments.length===0&&<p className="p-8 text-center text-gray-500">No payments yet.</p>}</div></section>
    </>}
  </div></main>;
}
function Card({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="glass-card p-5"><div className="mb-3 text-primary-500">{icon}</div><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-lg font-bold capitalize">{value}</p></div>}
function Row({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-4"><dt className="text-gray-500">{label}</dt><dd className="text-right font-medium capitalize">{value}</dd></div>}
