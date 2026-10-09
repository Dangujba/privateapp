'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../../providers';
import { api, apiError, type AdminTaxpayer } from '@/lib/api';

export default function AdminTaxpayersPage() {
  const { token } = useAuth();
  const [taxpayers, setTaxpayers] = useState<AdminTaxpayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchTaxpayers = useCallback(async () => {
    setError(''); setIsLoading(true);
    try {
      setTaxpayers((await api.getAdminTaxpayers()).taxpayers);
    } catch (error) {
      setError(apiError(error, 'Could not load taxpayers'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (token) void fetchTaxpayers(); }, [token, fetchTaxpayers]);

  const handleVerify = async (id: string, verified: boolean) => {
    try {
      await api.verifyTaxpayer(id, { verified, complianceStatus: verified ? 'compliant' : 'pending' });
      await fetchTaxpayers();
    } catch (error) {
      setError(apiError(error, 'Taxpayer verification failed'));
    }
  };

  const filtered = taxpayers.filter(t => 
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.tin?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="spinner w-12 h-12" /></div>;
  }

  return (
    <div className="p-6">
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or TIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-primary pl-10"
            />
          </div>
          <span className="text-gray-500">{filtered.length} taxpayers</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="table-header">TIN</th>
                <th className="table-header">Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Status</th>
                <th className="table-header">Verified</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((tp) => (
                <tr key={tp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell font-mono">{tp.tin}</td>
                  <td className="table-cell font-medium">{tp.full_name}</td>
                  <td className="table-cell">{tp.email}</td>
                  <td className="table-cell">
                    <span className={`badge ${tp.compliance_status === 'compliant' ? 'badge-success' : 'badge-warning'}`}>
                      {tp.compliance_status}
                    </span>
                  </td>
                  <td className="table-cell">
                    {tp.tin_verified ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-gray-400" />}
                  </td>
                  <td className="table-cell">
                    {!tp.tin_verified && (
                      <button onClick={() => handleVerify(tp.id, true)} className="text-green-600 hover:text-green-700 text-sm font-medium">
                        Verify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-gray-500">No taxpayers found</p>}
        </div>
      </div>
    </div>
  );
}
