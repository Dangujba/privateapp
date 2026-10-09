'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, Users, CreditCard, ChevronRight, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../providers';
import { api, apiError, type AdminDashboardData, type AdminPayment } from '@/lib/api';

export default function AdminDashboard() {
  const { token } = useAuth();
  
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [transactions, setTransactions] = useState<AdminPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      setError('');
      const [dashboardData, txData] = await Promise.all([api.getAdminDashboard(), api.getAdminTransactions({ limit: 10 })]);
      setDashboard(dashboardData.dashboard);
      setTransactions(txData.transactions);
    } catch (requestError) {
      setError(apiError(requestError, 'Could not load the dashboard'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void fetchDashboardData();
  }, [token, fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && <p role="alert" className="mb-6 rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
      {dashboard && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-500 dark:text-gray-400">Total Revenue</span>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                ₦{(dashboard.revenue?.totalNgn || 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-1">Confirmed state revenue collections</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-500 dark:text-gray-400">Today’s Revenue</span>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                ₦{(dashboard.revenue?.todayNgn || 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-500 dark:text-gray-400">Total Users</span>
                <Users className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {(dashboard.users?.total || 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {dashboard.users?.totalIndividuals || 0} Individuals • {dashboard.users?.totalBusinesses || 0} Businesses
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-500 dark:text-gray-400">Transactions</span>
                <CreditCard className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {(dashboard.transactions?.total || 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {dashboard.transactions?.pending || 0} pending • {dashboard.transactions?.today || 0} today
              </p>
            </div>
          </div>

          {/* Blockchain Status & Exchange Rate */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Smart Contract Status</h3>
              {dashboard.blockchain ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <span className="text-gray-600 dark:text-gray-300">Contract Balance</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {dashboard.blockchain.contractBalance?.toFixed(4) || '0'} TON
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <span className="text-gray-600 dark:text-gray-300">Total Collected</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {dashboard.blockchain.totalCollected?.toFixed(4) || '0'} TON
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <span className="text-gray-600 dark:text-gray-300">Contract Status</span>
                    <span className={`badge ${dashboard.blockchain.isPaused ? 'badge-error' : 'badge-success'}`}>
                      {dashboard.blockchain.isPaused ? 'Paused' : 'Active'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                  <p>No contract deployed yet</p>
                  <Link href="/dashboard/admin/settings" className="text-green-600 hover:underline text-sm">
                    Configure in Settings →
                  </Link>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Exchange Rate</h3>
              <div className="text-center py-8">
                <p className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
                  ₦{(dashboard.exchangeRate?.tonNgn || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className="text-gray-500">per 1 TON</p>
                <p className="text-sm text-gray-400 mt-4">
                  Source: {dashboard.exchangeRate?.source || 'N/A'} • Updated: {dashboard.exchangeRate?.timestamp ? new Date(dashboard.exchangeRate.timestamp).toLocaleTimeString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
              <Link href="/dashboard/admin/transactions" className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="table-header">Transaction</th>
                    <th className="table-header">Payer</th>
                    <th className="table-header">Amount</th>
                    <th className="table-header">TON</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="table-cell font-mono text-sm">{tx.transactionNumber}</td>
                      <td className="table-cell">
                        <div>
                          <p className="font-medium">{tx.payer?.name || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{tx.payer?.tin}</p>
                        </div>
                      </td>
                      <td className="table-cell font-bold">₦{tx.amountNgn?.toLocaleString()}</td>
                      <td className="table-cell text-blue-600 dark:text-blue-400">{tx.amountTon?.toFixed(4)}</td>
                      <td className="table-cell">
                        <span className={`badge ${
                          tx.status === 'confirmed' ? 'badge-success' :
                          tx.status === 'pending' ? 'badge-warning' :
                          tx.status === 'processing' ? 'badge-info' : 'badge-error'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && (
                <p className="text-center py-8 text-gray-500">No transactions yet</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
