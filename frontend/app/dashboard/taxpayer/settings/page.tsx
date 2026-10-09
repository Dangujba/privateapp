'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api, apiError } from '@/lib/api';

export default function TaxpayerSettingsPage() {
  const [fullName, setFullName] = useState(''); const [address, setAddress] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { api.getTaxpayerProfile().then(data => { setFullName(data.profile.fullName); setAddress(data.profile.address ?? ''); }).catch(err => setError(apiError(err))); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); try { await api.updateTaxpayerProfile({ fullName, address }); setMessage('Profile updated.'); } catch (err) { setError(apiError(err)); } };
  return <main className="min-h-screen p-6"><div className="mx-auto max-w-2xl"><Link href="/dashboard/taxpayer" className="mb-6 inline-flex items-center text-gray-600"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link><h1 className="text-2xl font-bold">Profile settings</h1><p className="mb-6 text-gray-500">Security roles, TIN verification and wallet ownership are enforced by the backend.</p><form onSubmit={submit} className="glass-card space-y-5 p-8">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-700">{message}</p>}<div><label htmlFor="settings-name" className="mb-2 block font-medium">Full name</label><input id="settings-name" className="input-primary" value={fullName} onChange={event => setFullName(event.target.value)} required /></div><div><label htmlFor="settings-address" className="mb-2 block font-medium">Postal address</label><textarea id="settings-address" className="input-primary min-h-28" value={address} onChange={event => setAddress(event.target.value)} /></div><button className="btn-primary">Save changes</button></form></div></main>;
}
