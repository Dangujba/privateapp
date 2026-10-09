'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../providers';
import { api, apiError, type AuditEntry } from '@/lib/api';

export default function AdminAuditPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    setError(''); setIsLoading(true);
    try {
      const data = await api.getAuditLogs({ page, limit: 50 });
      setLogs(data.auditLogs);
    } catch (error) {
      setError(apiError(error, 'Could not load audit logs'));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => { if (token) void fetchLogs(); }, [token, fetchLogs]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="spinner w-12 h-12" /></div>;
  }

  return (
    <div className="p-6">
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="table-header">Timestamp</th>
                <th className="table-header">User</th>
                <th className="table-header">Action</th>
                <th className="table-header">Resource</th>
                <th className="table-header">IP Address</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell text-sm">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="table-cell">{log.user_email || 'System'}</td>
                  <td className="table-cell font-mono text-sm">{log.action}</td>
                  <td className="table-cell">{log.resource_type}</td>
                  <td className="table-cell text-gray-500">{log.ip_address}</td>
                  <td className="table-cell">
                    <span className={`badge ${log.success !== false ? 'badge-success' : 'badge-error'}`}>
                      {log.success !== false ? 'Success' : 'Failed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <p className="text-center py-8 text-gray-500">No audit logs found</p>}
        </div>

        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-2 px-4">Previous</button>
          <span className="py-2 px-4">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 50} className="btn-secondary py-2 px-4">Next</button>
        </div>
      </div>
    </div>
  );
}
