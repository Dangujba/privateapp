export interface User { id: string; email: string; role: 'individual' | 'business' | 'admin' | 'super_admin'; firstName: string; lastName: string; phone?: string | null; emailVerified: boolean; }
export interface AuthResponse { user: User; tokens?: { accessToken: string; refreshToken?: string }; }
export interface Calculation { amountNgn: number; exchangeRate: number; exchangeRateSource: string; exchangeRateTimestamp: string; amountTon: number; amountNanoton: string; }
export interface PaymentRecord { id: string; referenceId: string; transactionNumber: string; status: string; taxType: string; taxPeriod?: string | null; description?: string; amountNgn: number; amountTon: number; createdAt: string; confirmedAt?: string | null; txHash?: string | null; }
export interface InitiatedPayment { transaction: PaymentRecord; payment: { contractAddress: string; amountNanoton: string; payload: string; network: 'testnet' | 'mainnet'; validUntil: number }; }
export interface PaginatedPayments { payments: PaymentRecord[]; transactions: PaymentRecord[]; pagination: { page: number; limit: number; total: number; pages: number }; }
export interface TaxpayerProfileResponse { profile: { id: string; tin: string; fullName: string; address?: string | null; complianceStatus: string; verified: boolean }; stats: { totalPaid: number; pendingPayments: number; lastPaymentDate: string | null; complianceStatus: string }; }
export interface BusinessProfileResponse { profile: { id: string; tin: string; businessName: string; category: string; address?: string | null; verified: boolean; complianceStatus: string }; stats: { totalPayments: number; confirmedPayments: number; totalPaidNgn: number; pendingPayments: number; lastPaymentDate: string | null }; }
export interface AdminDashboardData { revenue: { totalNgn: number; todayNgn: number }; users: { total: number; totalIndividuals: number; totalBusinesses: number }; transactions: { total: number; pending: number; today: number }; blockchain: { contractAddress?: string | null; contractBalance?: number | null; totalCollected?: number | null; isPaused?: boolean | null; status: string }; exchangeRate: { tonNgn: number; source: string; timestamp: string }; }
export interface AdminPayment extends PaymentRecord { payer?: { name: string; email: string; tin?: string }; }
export interface AdminTaxpayer { id: string; tin: string; full_name: string; email: string; compliance_status: string; tin_verified: boolean; }
export interface AdminBusiness { id: string; tin: string; business_name: string; category: string; compliance_status: string; is_verified: boolean; }
export interface RevenueRow { label: string; period: string; totalRevenueNgn: number; totalTon: number; transactionCount: number; }
export interface RevenueReport { period: string; year: number; data: RevenueRow[]; }
export interface AuditEntry { id: string; created_at: string; user_email?: string | null; action: string; resource_type: string; ip_address?: string | null; success: boolean; }
export interface ContractDeployment { id: string; contractType: string; network: string; address?: string | null; status: string; transactionHash?: string | null; createdAt: string; }
export interface AdminSettings { receivingWallet: string; tonNetwork: string; contractAddress: string; collectorAddress: string; contractVersion: string; exchangeRateSource: string; }
type QueryParams = Record<string, string | number | boolean | null | undefined>;
class ApiClientError extends Error { constructor(message: string, readonly status: number) { super(message); this.name = 'ApiClientError'; } }
export function apiError(error: unknown, fallback = 'Request failed') { if (error instanceof ApiClientError) return error.message; if (error instanceof TypeError && /fetch|network/i.test(error.message)) return 'Cannot reach the backend. Make sure the API server is running.'; return error instanceof Error ? error.message : fallback; }
class ApiClient {
  private refreshPromise: Promise<void> | null = null;
  private query(path: string, params?: QueryParams) { if (!params) return path; const search = new URLSearchParams(); for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value)); const encoded = search.toString(); return encoded ? `${path}?${encoded}` : path; }
  private async request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> { let response: Response; try { response = await fetch(`/api/v1${path}`, { ...init, credentials: 'include', signal: AbortSignal.timeout(30_000) }); } catch (error) { if (error instanceof DOMException && error.name === 'TimeoutError') throw new ApiClientError('The request timed out. Please try again.', 0); throw new ApiClientError('Cannot reach the backend. Make sure the API server is running.', 0); } const isRefreshable = !['/auth/login', '/auth/register', '/auth/refresh'].includes(path); if (response.status === 401 && !retried && isRefreshable) { this.refreshPromise ??= this.request<unknown>('/auth/refresh', { method: 'POST' }, true).then(() => undefined).finally(() => { this.refreshPromise = null; }); await this.refreshPromise; return this.request<T>(path, init, true); } const data = response.status === 204 ? null : await response.json().catch(() => null) as unknown; if (!response.ok) { const message = (data as { error?: { message?: unknown } } | null)?.error?.message; throw new ApiClientError(typeof message === 'string' ? message : `Request failed with status ${response.status}`, response.status); } return data as T; }
  private json<T>(path: string, method: 'POST' | 'PUT', body: unknown, headers?: HeadersInit) { return this.request<T>(path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); }
  login(email: string, password: string) { return this.json<AuthResponse>('/auth/login', 'POST', { email, password }); }
  register(data: Record<string, unknown>) { return this.json<AuthResponse>('/auth/register', 'POST', data); }
  async logout() { await this.request<unknown>('/auth/logout', { method: 'POST' }); }
  getProfile() { return this.request<{ user: User; taxpayerProfile?: unknown; businessProfile?: unknown; wallets: Array<{ address: string }> }>('/auth/me'); }
  requestWalletChallenge() { return this.request<{ payload: string; expiresIn: number }>('/auth/wallet/challenge', { method: 'POST' }); }
  verifyWallet(data: unknown) { return this.json<{ verified: boolean; address: string }>('/auth/wallet/verify', 'POST', data); }
  calculatePayment(amountNgn: string) { return this.json<{ calculation: Calculation }>('/payments/calculate', 'POST', { amountNgn }); }
  initiatePayment(data: { amountNgn: string; taxType: string; taxPeriod?: string; description?: string; senderAddress: string }, idempotencyKey: string) { return this.json<InitiatedPayment>('/payments/initiate', 'POST', data, { 'Idempotency-Key': idempotencyKey }); }
  submitPayment(id: string, boc: string) { return this.json<{ status: string; message: string }>(`/payments/${id}/confirm`, 'POST', { boc }); }
  verifyPayment(id: string) { return this.request<{ status: string; payment?: PaymentRecord; message?: string }>(`/payments/${id}/verify`, { method: 'POST' }); }
  getPayments(params?: { page?: number; limit?: number; status?: string }) { return this.request<PaginatedPayments>(this.query('/payments', params)); }
  getPayment(id: string) { return this.request<{ payment: PaymentRecord }>(`/payments/${id}`); }
  getReceipt(id: string) { return this.request<{ receipt: { receiptNumber: string; issuedAt: string; payment: PaymentRecord; snapshot: Record<string, string> } }>(`/payments/${id}/receipt`); }
  getTaxpayerProfile() { return this.request<TaxpayerProfileResponse>('/taxpayers/profile'); }
  updateTaxpayerProfile(data: unknown) { return this.json<unknown>('/taxpayers/profile', 'PUT', data); }
  getBusinessProfile() { return this.request<BusinessProfileResponse>('/businesses/profile'); }
  updateBusinessProfile(data: { businessName?: string; category?: string; address?: string }) { return this.json<{ profile: BusinessProfileResponse['profile'] }>('/businesses/profile', 'PUT', data); }
  getAdminDashboard() { return this.request<AdminDashboardData & { dashboard: AdminDashboardData }>('/admin/dashboard'); }
  getAdminTransactions(params?: { page?: number; limit?: number; status?: string }) { return this.request<{ transactions: AdminPayment[]; pagination: PaginatedPayments['pagination'] }>(this.query('/admin/transactions', params)); }
  getAdminTaxpayers() { return this.request<{ taxpayers: AdminTaxpayer[] }>('/admin/taxpayers'); }
  getAdminBusinesses() { return this.request<{ businesses: AdminBusiness[] }>('/admin/businesses'); }
  verifyTaxpayer(id: string, data: unknown) { return this.json<unknown>(`/admin/taxpayers/${id}/verify`, 'PUT', data); }
  verifyBusiness(id: string, data: unknown) { return this.json<unknown>(`/admin/businesses/${id}/verify`, 'PUT', data); }
  getRevenueReport(params?: { period?: string; year?: number }) { return this.request<RevenueReport & { report: RevenueReport }>(this.query('/admin/reports/revenue', params)); }
  getAuditLogs(params?: { page?: number; limit?: number }) { return this.request<{ logs: AuditEntry[]; auditLogs: AuditEntry[]; pagination: PaginatedPayments['pagination'] }>(this.query('/admin/audit-logs', params)); }
  getAdminSettings() { return this.request<{ settings: AdminSettings }>('/admin/settings'); }
  updateReceivingWallet(walletAddress: string) { return this.json<{ walletAddress: string }>('/admin/settings/wallet', 'PUT', { walletAddress }); }
  getContracts() { return this.request<{ contracts: ContractDeployment[] }>('/admin/contracts'); }
  prepareContractDeployment(contractType: 'RevenueCollector', initialParams: Record<string, unknown>) { return this.json<{ deployment: ContractDeployment; message: string }>('/admin/contracts/deploy', 'POST', { contractType, initialParams }); }
}
export const api = new ApiClient();
