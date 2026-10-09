'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, apiError } from '@/lib/api';

const businessCategories = [
  ['employer_organisation', 'Employer / Organisation'],
  ['trader', 'Trader'],
  ['manufacturer', 'Manufacturer'],
  ['service_provider', 'Service Provider'],
  ['professional', 'Professional / Self-employed'],
  ['contractor', 'Contractor'],
  ['landlord_property_owner', 'Landlord / Property Owner'],
  ['hotel_restaurant_event_centre', 'Hotel / Restaurant / Event Centre'],
  ['entertainment_media', 'Entertainment / Media'],
  ['transport_haulage', 'Transport / Haulage'],
  ['livestock_agro_dealer', 'Livestock / Agro Dealer'],
  ['gaming_lottery_betting', 'Gaming / Lottery / Betting'],
] as const;

export default function BusinessSettingsPage() {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('service_provider');
  const [address, setAddress] = useState('');
  const [tin, setTin] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getBusinessProfile()
      .then(({ profile }) => {
        setBusinessName(profile.businessName);
        setCategory(profile.category);
        setAddress(profile.address ?? '');
        setTin(profile.tin);
      })
      .catch((err) => setError(apiError(err, 'Could not load business profile')));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      await api.updateBusinessProfile({ businessName, category, address });
      setMessage('Business profile updated successfully.');
    } catch (err) {
      setError(apiError(err, 'Could not update business profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Business Settings</h1>
          <p className="mt-1 text-gray-500">Manage the organisation information used for YIRS revenue records and receipts.</p>
        </div>

        <form onSubmit={submit} className="glass-card space-y-5 p-6 sm:p-8">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-700">{message}</p>}

          <div>
            <label className="mb-2 block font-medium">TIN</label>
            <input className="input-primary bg-gray-50 dark:bg-gray-800" value={tin} disabled />
            <p className="mt-1 text-xs text-gray-500">TIN is managed by YIRS and cannot be changed from this page.</p>
          </div>

          <div>
            <label htmlFor="business-name" className="mb-2 block font-medium">Business / Organisation name</label>
            <input id="business-name" className="input-primary" value={businessName} onChange={(event) => setBusinessName(event.target.value)} required />
          </div>

          <div>
            <label htmlFor="business-category" className="mb-2 block font-medium">Business category</label>
            <select id="business-category" className="input-primary" value={category} onChange={(event) => setCategory(event.target.value)} required>
              {businessCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="business-address" className="mb-2 block font-medium">Business address</label>
            <textarea id="business-address" className="input-primary min-h-28" value={address} onChange={(event) => setAddress(event.target.value)} />
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </div>
    </main>
  );
}
