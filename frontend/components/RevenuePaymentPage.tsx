'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CHAIN, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { AlertCircle, ArrowLeft, Calculator, CheckCircle, Loader2, RefreshCw, Send, Wallet } from 'lucide-react';
import { api, apiError, type Calculation, type InitiatedPayment } from '@/lib/api';
import { useAuth } from '@/app/providers';

type PaymentState = 'draft' | 'awaiting_wallet' | 'submitted' | 'onchain_pending' | 'confirmed' | 'expired' | 'cancelled' | 'failed';

const individualTaxes = [
  ['direct_assessment', 'Direct Assessment / Self-Assessment'],
  ['capital_gains_individual', 'Capital Gains Tax'],
  ['stamp_duty_individual', 'Stamp Duty'],
  ['property_tax', 'Property Tax'],
  ['road_tax', 'Road Tax / Road-Related Revenue'],
  ['licence_permit', 'Licence / Permit / Statutory Fee'],
  ['other_state_revenue', 'Other State Tax, Fee or Levy'],
];
const businessTaxes = [
  ['paye_remittance', 'PAYE Remittance'],
  ['direct_assessment', 'Direct Assessment / Self-Assessment'],
  ['presumptive_turnover', 'Presumptive Turnover Tax'],
  ['withholding_remittance', 'Withholding Tax Remittance'],
  ['capital_gains', 'Capital Gains Tax'],
  ['stamp_duty', 'Stamp Duty'],
  ['consumption_tax', 'Consumption Tax'],
  ['entertainment_levy', 'Entertainment Levy'],
  ['property_tax', 'Property Tax'],
  ['road_transport', 'Road / Transport Revenue'],
  ['gaming_lottery', 'Gaming / Lottery / Betting Revenue'],
  ['trade_haulage', 'Trade / Haulage Fee'],
  ['licence_levy', 'Licence, Permit or Statutory Levy'],
  ['other_state_revenue', 'Other State Revenue'],
];

export default function RevenuePaymentPage({ portal }: { portal: 'individual' | 'business' }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const choices = portal === 'business' ? businessTaxes : individualTaxes;
  const [taxType, setTaxType] = useState(choices[0][0]);
  const [taxPeriod, setTaxPeriod] = useState('2026');
  const [description, setDescription] = useState('');
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [payment, setPayment] = useState<InitiatedPayment | null>(null);
  const [state, setState] = useState<PaymentState>('draft');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const idempotencyKey = useRef('');
  const dashboardPath = portal === 'business' ? '/dashboard/business' : '/dashboard/taxpayer';
  const receiptPath = portal === 'business' ? '/dashboard/business/receipts' : '/dashboard/taxpayer/receipts';

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (portal === 'business' && user?.role !== 'business') || (portal === 'individual' && user?.role !== 'individual'))) router.replace('/login');
  }, [authLoading, isAuthenticated, portal, router, user?.role]);

  const checkStatus = useCallback(async () => {
    if (!payment) return;
    try {
      const result = await api.verifyPayment(payment.transaction.id);
      setState(result.status as PaymentState);
      if (result.status === 'confirmed') setStep(4);
      if (result.status === 'expired') setError('This payment intent expired. Start a new payment.');
    } catch (err) { setError(apiError(err, 'Could not check blockchain status')); }
  }, [payment]);

  useEffect(() => {
    if (!payment || !['submitted', 'onchain_pending'].includes(state)) return;
    const timer = window.setInterval(() => void checkStatus(), 5000);
    return () => window.clearInterval(timer);
  }, [payment, state, checkStatus]);

  const calculate = async () => {
    setBusy(true); setError('');
    try { setCalculation((await api.calculatePayment(amount)).calculation); setStep(2); }
    catch (err) { setError(apiError(err, 'Calculation failed')); }
    finally { setBusy(false); }
  };

  const openWallet = async (forceReconnect = false) => {
    setError('');
    try {
      if (forceReconnect && wallet) await tonConnectUI.disconnect();
      const { payload } = await api.requestWalletChallenge();
      tonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: payload } });
      await tonConnectUI.openModal();
    } catch (err) {
      setError(apiError(err, 'Could not open TON wallet connection'));
    }
  };

  const startPayment = async () => {
    if (!wallet) { setState('awaiting_wallet'); await openWallet(false); return; }
    setBusy(true); setError(''); setState('awaiting_wallet');
    try {
      idempotencyKey.current ||= crypto.randomUUID();
      const initiated = await api.initiatePayment({ amountNgn: amount, taxType, taxPeriod, description, senderAddress: wallet.account.address }, idempotencyKey.current);
      setPayment(initiated); setStep(3);
      const result = await tonConnectUI.sendTransaction({ validUntil: initiated.payment.validUntil, network: initiated.payment.network === 'testnet' ? CHAIN.TESTNET : CHAIN.MAINNET, from: wallet.account.address, messages: [{ address: initiated.payment.contractAddress, amount: initiated.payment.amountNanoton, payload: initiated.payment.payload }] });
      await api.submitPayment(initiated.transaction.id, result.boc);
      setState('onchain_pending');
    } catch (err) {
      const message = apiError(err, 'Payment failed');
      setError(/Connect and verify this wallet with TON Proof/i.test(message) ? 'This wallet is connected but TON Proof verification is incomplete. Click Reconnect & Verify Wallet above, approve the connection in Tonkeeper, then try the payment again.' : message);
      setState(/reject|cancel/i.test(message) ? 'cancelled' : 'failed'); setStep(payment ? 3 : 2);
    } finally { setBusy(false); }
  };

  return <main className="min-h-screen p-6"><div className="mx-auto max-w-2xl">
    <Link href={dashboardPath} className="mb-4 inline-flex items-center text-gray-600 hover:text-primary-500"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Link>
    <h1 className="text-2xl font-bold">YIRS Tax & Revenue Payment</h1>
    <p className="mb-6 text-gray-600 dark:text-gray-300">Select the applicable revenue type, enter the assessed amount and complete payment through your connected TON wallet.</p>
    <section className="mb-8 rounded-2xl border border-primary-100 bg-primary-50/60 p-5 dark:border-primary-900/40 dark:bg-primary-950/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-bold"><Wallet className="h-5 w-5 text-primary-600"/>TON Wallet</div>
          {wallet ? <><p className="mt-1 text-sm text-green-700 dark:text-green-400">Wallet connected</p><p className="mt-1 break-all font-mono text-xs text-gray-500">{wallet.account.address}</p></> : <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Connect your testnet wallet and approve TON Proof before making a payment.</p>}
        </div>
        <button type="button" onClick={() => void openWallet(Boolean(wallet))} className="btn-ton inline-flex shrink-0 items-center justify-center gap-2">
          <Wallet className="h-5 w-5"/>{wallet ? 'Reconnect & Verify Wallet' : 'Connect Wallet'}
        </button>
      </div>
      <p className="mt-3 text-xs text-gray-500">TON Proof verifies wallet ownership. The system never asks for your seed phrase or private key.</p>
    </section>
    <div className="mb-8 flex items-center" aria-label={`Payment step ${step} of 4`}>{[1,2,3,4].map(value => <div key={value} className="flex flex-1 items-center last:flex-none"><div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${value <= step ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}`}>{value < step ? <CheckCircle className="h-5 w-5"/> : value}</div>{value < 4 && <div className={`mx-2 h-1 flex-1 ${value < step ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}/>}</div>)}</div>
    {error && <div role="alert" className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"><AlertCircle className="h-5 w-5 shrink-0"/>{error}</div>}
    {step === 1 && <section className="glass-card space-y-5 p-6">
      <div><label className="mb-2 block text-sm font-medium">Revenue type</label><select value={taxType} onChange={e => setTaxType(e.target.value)} className="input-primary">{choices.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label className="mb-2 block text-sm font-medium">Tax / revenue period</label><input value={taxPeriod} onChange={e => setTaxPeriod(e.target.value)} className="input-primary" placeholder="2026 or Q4 2026" /></div>
      <div><label className="mb-2 block text-sm font-medium">Amount (₦)</label><input type="number" min="100" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="input-primary" placeholder="10000" /></div>
      <div><label className="mb-2 block text-sm font-medium">Description / assessment reference</label><textarea value={description} onChange={e => setDescription(e.target.value)} className="input-primary min-h-24" placeholder="Optional assessment or payment note" /></div>
      <button onClick={calculate} disabled={busy || !amount || !taxType} className="btn-primary flex w-full items-center justify-center gap-2">{busy ? <Loader2 className="h-5 w-5 animate-spin"/> : <Calculator className="h-5 w-5"/>}Review Payment</button>
    </section>}
    {step === 2 && calculation && <section className="glass-card space-y-5 p-6">
      <h2 className="text-lg font-bold">Payment Summary</h2>
      <Row label="Revenue type" value={choices.find(item => item[0] === taxType)?.[1] ?? taxType}/><Row label="Period" value={taxPeriod || '—'}/><Row label="Amount" value={`₦${calculation.amountNgn.toLocaleString(undefined,{minimumFractionDigits:2})}`}/><Row label="TON equivalent" value={`${calculation.amountTon.toFixed(6)} TON`}/><Row label="Rate" value={`₦${calculation.exchangeRate.toLocaleString()} / TON`}/>
      <div className="flex gap-3"><button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button><button onClick={() => void startPayment()} disabled={busy} className="btn-primary flex flex-1 items-center justify-center gap-2">{wallet ? <Send className="h-5 w-5"/> : <Wallet className="h-5 w-5"/>}{wallet ? 'Pay with TON' : 'Connect Wallet'}</button></div>
    </section>}
    {step === 3 && payment && <section className="glass-card space-y-5 p-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100"><RefreshCw className={`h-7 w-7 text-blue-600 ${state === 'onchain_pending' ? 'animate-spin' : ''}`}/></div><h2 className="text-xl font-bold">Blockchain verification</h2><p className="text-gray-600">Status: <strong>{state.replaceAll('_',' ')}</strong></p><p className="font-mono text-xs text-gray-500">{payment.transaction.transactionNumber}</p><button onClick={() => void checkStatus()} className="btn-secondary">Check Now</button></section>}
    {step === 4 && payment && <section className="glass-card space-y-5 p-6 text-center"><CheckCircle className="mx-auto h-16 w-16 text-green-500"/><h2 className="text-2xl font-bold">Payment confirmed</h2><p>Your YIRS revenue payment has been verified on TON.</p><Link href={`${receiptPath}/${payment.transaction.id}`} className="btn-primary inline-flex">View Receipt</Link></section>}
  </div></main>;
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-5 border-b border-gray-100 pb-3"><span className="text-gray-500">{label}</span><span className="text-right font-semibold">{value}</span></div>; }
