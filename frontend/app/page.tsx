import Link from 'next/link';

type IconProps = { className?: string };

function SvgIcon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ArrowRightIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></SvgIcon>;
}

function BuildingIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M3 21h18"/><path d="M6 21V7l6-4 6 4v14"/><path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/><path d="M10 21v-3h4v3"/></SvgIcon>;
}

function CheckCircleIcon(props: IconProps) {
  return <SvgIcon {...props}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></SvgIcon>;
}

function LandmarkIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="m3 9 9-5 9 5"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8"/><path d="M3 18h18M2 21h20"/></SvgIcon>;
}

function ReceiptIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></SvgIcon>;
}

function ShieldIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M12 3 5 6v5c0 4.6 2.9 8.3 7 10 4.1-1.7 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></SvgIcon>;
}

function UserIcon(props: IconProps) {
  return <SvgIcon {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></SvgIcon>;
}

function WalletIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M4 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12"/><path d="M16 12h4"/><circle cx="16" cy="12" r=".5" fill="currentColor" stroke="none"/></SvgIcon>;
}

const revenueTypes = [
  'PAYE Remittance',
  'Direct / Self-Assessment',
  'Presumptive Turnover Tax',
  'Capital Gains Tax (Individuals)',
  'Stamp Duties on Individual Instruments',
  'Withholding Tax Remittance',
  'Consumption Tax and Entertainment Levy',
  'Property Tax and Road-Related Revenue',
  'Gaming, Lottery and Betting Revenue',
  'Trade, Transport, Haulage, Licence and Statutory Fees',
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500 text-lg font-black text-white">₦</div><div><p className="font-bold">YIRS Blockchain Revenue System</p><p className="text-xs text-slate-500">Yobe State Internal Revenue Service</p></div></div>
          <div className="flex items-center gap-3"><Link href="/login" className="btn-secondary">Sign in</Link><Link href="/register" className="btn-primary">Create account</Link></div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 dark:border-primary-900 dark:bg-primary-950/50 dark:text-primary-300"><LandmarkIcon className="h-4 w-4" /> Yobe State Revenue Administration</div>
          <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-6xl">Pay and verify state taxes and revenue securely on TON.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">A unified digital platform for individuals, businesses and revenue administrators to manage assessments, remittances, payments, receipts and blockchain verification.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/register?type=individual" className="btn-primary inline-flex items-center gap-2"><UserIcon className="h-5 w-5" /> Individual taxpayer</Link><Link href="/register?type=business" className="btn-secondary inline-flex items-center gap-2"><BuildingIcon className="h-5 w-5" /> Business / organisation</Link></div>
        </div>
        <div className="glass-card p-7">
          <p className="text-sm font-bold uppercase tracking-[.18em] text-primary-600">Revenue services</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{revenueTypes.map(item => <div key={item} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800"><CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-500" /><span className="text-sm font-medium">{item}</span></div>)}</div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mx-auto max-w-7xl px-6"><div className="mb-10 max-w-3xl"><p className="text-sm font-bold uppercase tracking-[.18em] text-primary-600">One system, three views</p><h2 className="mt-2 text-3xl font-black">Built around the people who pay, remit and administer Yobe State revenue.</h2></div>
          <div className="grid gap-6 md:grid-cols-3">
            {[{icon:UserIcon,title:'Individual Taxpayer',text:'View profile and TIN, pay applicable state taxes and fees, track transactions and open receipts.'},{icon:BuildingIcon,title:'Business / Organisation',text:'A dedicated dashboard for employer remittances, business assessments, statutory payments, compliance status and transaction history.'},{icon:LandmarkIcon,title:'YIRS Administration',text:'Monitor revenue, taxpayers, businesses, payments, reports, audit logs, revenue wallet and smart-contract status.'}].map(({icon:Icon,title,text})=><div key={title} className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800"><Icon className="h-8 w-8 text-primary-500"/><h3 className="mt-4 text-xl font-bold">{title}</h3><p className="mt-2 text-slate-600 dark:text-slate-300">{text}</p></div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16"><div className="grid gap-6 md:grid-cols-3">{[{icon:WalletIcon,title:'Direct blockchain payment',text:'A signed TON transaction sends the assessed amount to the configured YIRS revenue wallet through the RevenueCollector contract.'},{icon:ShieldIcon,title:'Server-side verification',text:'The backend verifies the transaction destination, amount, payload and replay status before confirming the payment.'},{icon:ReceiptIcon,title:'Traceable receipts',text:'Confirmed payments produce transaction records and receipts linked to the blockchain reference.'}].map(({icon:Icon,title,text})=><div key={title} className="glass-card p-6"><Icon className="h-8 w-8 text-primary-500"/><h3 className="mt-4 text-xl font-bold">{title}</h3><p className="mt-2 text-slate-600 dark:text-slate-300">{text}</p></div>)}</div></section>

      <section className="bg-slate-950 py-14 text-white"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between"><div><p className="text-2xl font-black">YIRS Blockchain Revenue System</p><p className="mt-2 text-slate-400">Digital state revenue collection, payment verification and reporting.</p></div><Link href="/login" className="inline-flex items-center gap-2 font-semibold text-primary-300">Open system <ArrowRightIcon className="h-5 w-5"/></Link></div></section>
      <footer className="bg-slate-950 px-6 pb-10 text-center text-sm text-slate-500">© {new Date().getFullYear()} YIRS Blockchain Revenue System.</footer>
    </main>
  );
}
