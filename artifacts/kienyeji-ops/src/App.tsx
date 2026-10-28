import { useEffect, useMemo, useRef, useState, createContext, useContext, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowDownLeft, ArrowRight, Banknote, BarChart3, BookOpenCheck, CalendarDays,
  Check, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardList, Egg, FileText,
  LayoutDashboard, LogOut, MapPin, Package, Plus, Receipt, Scale, Settings, ShieldCheck,
  ShoppingCart, Store, Truck, Users, Wallet, AlertTriangle
} from 'lucide-react';
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  getGetBusinessQueryKey, getGetBusinessReviewQueryKey, getGetDashboardSummaryQueryKey,
  getGetStockQueryKey, getListActionsQueryKey, getListExpensesQueryKey, getListProductsQueryKey,
  getListSalesQueryKey, getListStockCountsQueryKey,
  useCreateAction, useCreateBranch, useCreateBusiness, useCreateExpense, useCreateProduct,
  useCreateSale, useGetBusiness, useGetBusinessReview, useGetDashboardSummary, useGetStock,
  useListActions, useListExpenses, useListProducts, useListSales, useListStockCounts,
  useRecordCollection, useRecordStockCount, useRecordStockLoss, useReceiveStock,
  useUpdateAction, useUpdateBranch, useUpdateProduct,
} from '@workspace/api-client-react';
import type { BusinessReview, BusinessAction, Sale, StockItem } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000, refetchOnWindowFocus: false } } });
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: { colorPrimary: '#29483a', colorForeground: '#243a30', colorMutedForeground: '#738078', colorDanger: '#a84439', colorBackground: '#fbfaf6', colorInput: '#fffefb', colorInputForeground: '#2c4136', colorNeutral: '#d9d4c8', fontFamily: 'DM Sans, sans-serif', borderRadius: '0.7rem' },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fbfaf6] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#29483a] font-semibold', headerSubtitle: 'text-[#718077]', socialButtonsBlockButtonText: 'text-[#33483d]',
    formFieldLabel: 'text-[#52645a]', footerActionLink: 'text-[#29483a] font-semibold', footerActionText: 'text-[#738078]',
    dividerText: 'text-[#8b958d]', identityPreviewEditButton: 'text-[#496052]', formFieldSuccessText: 'text-[#416347]',
    alertText: 'text-[#914137]', logoBox: 'mb-2', logoImage: 'w-10 h-10 object-contain',
    socialButtonsBlockButton: 'border-[#ded9cc] bg-[#fffefb] hover:bg-[#f5f1e8]',
    formButtonPrimary: 'bg-[#29483a] hover:bg-[#315d49] text-white', formFieldInput: 'border-[#ded9cc] bg-[#fffefb]',
    footerAction: 'text-[#52645a]', dividerLine: 'bg-[#e6e1d5]', alert: 'border-[#f0d6d0]', otpCodeFieldInput: 'border-[#ded9cc]',
    formFieldRow: 'mb-4', main: 'gap-4',
  },
};

const BranchContext = createContext<{ branchId: string; setBranchId: (id: string) => void }>({ branchId: '', setBranchId: () => undefined });
const useBranch = () => useContext(BranchContext);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const nowLocal = () => `${today()}T${new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())}:00+03:00`;
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
function moneyCents(value?: string | number | null): bigint | null {
  const raw = String(value ?? '0').trim();
  const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const fraction = (match[3] || '').padEnd(3, '0');
  let cents = BigInt(match[2]) * 100n + BigInt(fraction.slice(0, 2));
  if (fraction[2] >= '5') cents += 1n;
  return match[1] ? -cents : cents;
}
function formatCents(value: bigint, currency = 'KES') {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${currency} ${negative ? '-' : ''}${whole}.${fraction}`;
}
const money = (value?: string | number | null, currency = 'KES') => {
  const cents = moneyCents(value);
  return cents === null ? `${currency} ${value ?? '—'}` : formatCents(cents, currency);
};
const sumMoney = (values: Array<string | number | null | undefined>) =>
  values.reduce((sum, value) => sum + (moneyCents(value) ?? 0n), 0n);
function decimalScaled(value: string, scale: number): bigint | null {
  const match = value.trim().match(new RegExp(`^(\\\\d+)(?:\\\\.(\\\\d{1,${scale}}))?$`));
  if (!match) return null;
  return BigInt(match[1]) * 10n ** BigInt(scale) + BigInt((match[2] || '').padEnd(scale, '0'));
}
const positiveDecimal = (value: string, scale: number) => {
  const scaled = decimalScaled(value, scale);
  return scaled !== null && scaled > 0n;
};
const nonNegativeDecimal = (value: string, scale: number) => {
  const scaled = decimalScaled(value, scale);
  return scaled !== null && scaled >= 0n;
};
const num = (value?: string | number | null) => Number(value || 0);
const errorText = (error: unknown) => (error as { message?: string })?.message || 'We could not save that entry. Check your connection and try again.';

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><div className="brand-mark">K</div>{!compact && <div><div className="brand-name">Kienyeji ShopOS</div><div className="brand-sub">Shop operations</div></div>}</div>;
}
function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (previous.current !== undefined && previous.current !== id) client.clear();
    previous.current = id;
  }), [addListener, client]);
  return null;
}
function SignInPage() {
  return <div className="min-h-[100dvh] flex items-center justify-center px-4 py-10" style={{ background: '#f4f1e8' }}>
    <div><div className="text-center mb-5"><Link href="/" className="inline-flex"><Logo /></Link><p className="subtitle mt-3">Keep the shop moving. Keep the books clear.</p></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>
  </div>;
}
function SignUpPage() {
  return <div className="min-h-[100dvh] flex items-center justify-center px-4 py-10" style={{ background: '#f4f1e8' }}>
    <div><div className="text-center mb-5"><Link href="/" className="inline-flex"><Logo /></Link><p className="subtitle mt-3">A clearer view of the work, every day.</p></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>
  </div>;
}

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/stock', label: 'Stock room', icon: Package },
  { href: '/sales', label: 'Sales & credit', icon: ShoppingCart },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/review', label: 'Business review', icon: BookOpenCheck },
  { href: '/actions', label: 'Owner actions', icon: ClipboardList },
  { href: '/settings', label: 'Shop settings', icon: Settings },
];
function Shell({ children, title }: { children: ReactNode; title: string }) {
  const { signOut } = useClerk();
  const { branchId, setBranchId } = useBranch();
  const { data: setup } = useGetBusiness();
  const branches = setup?.branches || [];
  const active = branches.filter(b => b.active);
  const [location] = useLocation();
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/dashboard" className="no-underline text-inherit"><Logo /></Link>
      <div className="nav-label">Your shop</div><nav className="nav-list">{nav.map(item => {
        const Icon = item.icon;
        return <Link key={item.href} href={item.href} className={`nav-link ${location === item.href ? 'active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><Icon /><span>{item.label}</span></Link>;
      })}</nav>
      <div className="sidebar-bottom">A reliable record of what came in, what went out, and what remains.<br /><span className="mono">Africa / Nairobi</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="crumb">{setup?.business?.name || 'Your business'} <span style={{ margin: '0 8px', color: '#b3b5a8' }}>/</span> {title}</div>
        <div className="top-right">{active.length > 0 && <label className="flex items-center gap-2"><MapPin size={14} /><select aria-label="Select branch" data-testid="select-branch" value={branchId} onChange={e => setBranchId(e.target.value)} className="bg-transparent border-0 text-xs outline-none max-w-[145px]">{active.length > 1 && <option value="">All branches</option>}{active.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><ChevronDown size={12} /></label>}<span className="top-date">{new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span><button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="button ghost small" aria-label="Sign out" data-testid="button-sign-out"><LogOut size={13} /> <span className="hidden sm:inline">Sign out</span></button></div>
      </header>
      <main className="main-content">{children}</main>
    </div>
    <nav className="mobile-nav">{nav.slice(0, 5).map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={location === item.href ? 'active' : ''}><Icon /><span>{item.label === 'Overview' ? 'Home' : item.label.split(' ')[0]}</span></Link>; })}</nav>
  </div>;
}
function PageHead({ title, description, eyebrow, action }: { title: string; description: string; eyebrow?: string; action?: ReactNode }) {
  return <div className="page-head"><div><div className="eyebrow">{eyebrow || 'Shop floor / Daily record'}</div><h1>{title}</h1><p className="subtitle">{description}</p></div>{action}</div>;
}
function Panel({ title, children, extra, className = '' }: { title: string; children: ReactNode; extra?: ReactNode; className?: string }) {
  return <section className={`panel panel-pad ${className}`}><div className="section-header"><h2 className="section-title">{title}</h2>{extra}</div>{children}</section>;
}
function QueryState({ loading, error, retry, children }: { loading: boolean; error: boolean; retry: () => void; children: ReactNode }) {
  if (loading) return <div className="panel panel-pad grid gap-4"><div className="loading-line w-1/3" /><div className="loading-line w-full" /><div className="loading-line w-4/5" /><div className="loading-line w-2/3" /></div>;
  if (error) return <div className="panel empty-state"><div className="empty-mark"><AlertTriangle size={20} /></div><h3>Couldn’t load this view</h3><p>Check your connection, then try again.</p><button type="button" className="button secondary small mt-4" onClick={retry} data-testid="button-retry">Try again</button></div>;
  return <>{children}</>;
}
function StatusNotice({ success, error }: { success?: string; error?: unknown }) {
  if (success) return <div className="notice success" role="status" data-testid="status-success"><CheckCircle2 size={15} className="inline mr-2" />{success}</div>;
  if (error) return <div className="notice error" role="alert" data-testid="status-error">{errorText(error)}</div>;
  return null;
}

function Landing() {
  return <div className="landing">
    <header className="landing-nav"><Link href="/" className="no-underline text-inherit"><Logo /></Link><div className="landing-links"><a href="#how-it-works">How it works</a><a href="#for-the-owner">For the owner</a><Link href="/sign-in" className="button ghost small">Sign in <ArrowRight size={13} /></Link></div></header>
    <section className="hero"><div className="hero-copy"><div className="hero-kicker">Built for the busy shop floor</div><h1>Know your shop.<br /><em>Every day.</em></h1><p>Stock, sales, expenses and customer credit in one clear place. So the day’s numbers still make sense when the rush is over.</p><div className="hero-cta"><Link href="/sign-up" className="button">Set up your shop <ArrowRight size={15} /></Link><Link href="/sign-in" className="button ghost">I already have an account</Link></div><p className="mono" style={{ fontSize: 10, marginTop: 17, color: '#8d958c' }}>MADE FOR KIENYEJI CHICKEN SHOPS · KES · EAST AFRICA TIME</p></div>
      <div className="hero-art" role="img" aria-label="Illustration of a neighborhood kienyeji chicken shop at sunset"><div className="art-sun" /><div className="art-hill back" /><div className="art-hill" /><div className="art-shop" /><div className="art-counter" /><div className="art-stool" /><div className="hero-stamp">A GOOD<br />DAY’S WORK<br />ACCOUNTED FOR</div></div>
    </section>
    <div className="trust-strip"><span><strong>01</strong> Stock that balances</span><span><strong>02</strong> Sales you can trace</span><span><strong>03</strong> Credit that stays visible</span><span><strong>04</strong> A proper close of day</span></div>
    <section className="landing-section" id="how-it-works"><div className="section-intro"><div className="eyebrow">Less guessing. Better records.</div><h2>From supplier delivery to today’s closing count.</h2><p>ShopOS makes the everyday numbers easier to capture and easier to trust. No complicated accounting language. Just the records a shop owner needs.</p></div><div className="feature-grid"><article className="feature"><div className="feature-num">01 / RECEIVE</div><h3>Start with what arrived</h3><p>Log the supplier, quantity and cost as a new batch. Know what is available before the first sale.</p></article><article className="feature"><div className="feature-num">02 / RECORD</div><h3>Keep each sale straight</h3><p>Capture cash, M-Pesa and credit without losing the customer name or the amount still owed.</p></article><article className="feature"><div className="feature-num">03 / RECONCILE</div><h3>Close with confidence</h3><p>Compare the stock on screen with what is in the shop. Give every loss and variance a reason.</p></article></div></section>
    <div className="quote-band" id="for-the-owner"><p>“The question is not just how much did we sell? It’s what is left, what is owed, and what needs my attention tomorrow.”</p><small>A clearer daily picture for the owner</small></div>
    <section className="landing-section"><div className="section-intro"><div className="eyebrow">Accountability, without the paperwork pile</div><h2>A record your whole team can understand.</h2><p>Use it on a phone between customers or review the week with a cup of tea. Every figure is tied to a shop-floor event and a date in Nairobi time.</p></div><div className="grid-two"><div className="panel panel-pad"><div className="section-header"><h2 className="section-title">Your day, in plain sight</h2><Activity size={18} color="#8a744d" /></div><div className="activity-list"><div className="activity-row"><div className="activity-icon"><Truck size={16} /></div><div className="activity-main"><div className="activity-title">Supplier delivery recorded</div><div className="activity-meta">Received · 07:42</div></div><span className="amount">+24 birds</span></div><div className="activity-row"><div className="activity-icon"><ShoppingCart size={16} /></div><div className="activity-main"><div className="activity-title">Sale recorded with receipt</div><div className="activity-meta">Cash · 10:18</div></div><span className="amount">KES 3,600</span></div><div className="activity-row"><div className="activity-icon"><Wallet size={16} /></div><div className="activity-main"><div className="activity-title">Customer payment collected</div><div className="activity-meta">M-Pesa · 14:06</div></div><span className="amount">KES 1,200</span></div></div></div><div className="panel panel-pad" style={{ background: '#e2e6d9' }}><div className="eyebrow">At the end of the day</div><h2 className="section-title" style={{ fontSize: 26, margin: '10px 0' }}>No more “I think we had…”</h2><p style={{ fontSize: 12, lineHeight: 1.7, color: '#6a786e' }}>A living view of cash collected, credit outstanding, stock on hand and operating costs. The facts you need to act early.</p><Link href="/sign-up" className="button small">Get your shop in order <ArrowRight size={14} /></Link></div></div></section>
    <footer className="landing-footer"><span><Logo /></span><span>Built for Kenyan neighbourhood chicken shops.</span><span>KES · Africa/Nairobi</span></footer>
  </div>;
}
function HomeRedirect() { return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>; }
function Guarded({ children }: { children: ReactNode }) { return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>; }

function SetupPage() {
  const { data } = useGetBusiness();
  const create = useCreateBusiness();
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState<unknown>();
  const existing = data?.business;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setMessage(''); setFailure(undefined);
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '').trim();
    const branch = String(form.get('branch') || '').trim();
    const location = String(form.get('location') || '').trim();
    const stockCountOwner = String(form.get('stockCountOwner') || '').trim();
    const cashReconciliationOwner = String(form.get('cashReconciliationOwner') || '').trim();
    const creditFollowUpOwner = String(form.get('creditFollowUpOwner') || '').trim();
    const dayCloseOwner = String(form.get('dayCloseOwner') || '').trim();
    if (!name || !branch || !location) { setFailure(new Error('Add a business name, branch name and location to continue.')); return; }
    create.mutate({ data: {
      name, primaryBranchName: branch, primaryBranchLocation: location, openingDate: String(form.get('openingDate') || today()),
      primaryBranchStockCountOwner: stockCountOwner,
      primaryBranchCashReconciliationOwner: cashReconciliationOwner,
      primaryBranchCreditFollowUpOwner: creditFollowUpOwner,
      primaryBranchDayCloseOwner: dayCloseOwner,
    } }, {
      onSuccess: () => { setMessage('Your shop is set up. Let’s get the first day on record.'); client.invalidateQueries({ queryKey: getGetBusinessQueryKey() }); },
      onError: setFailure,
    });
  };
  if (existing) return <Shell title="Shop setup"><PageHead title="Your shop is ready." description="Your business and first branch are already set up." /><Panel title={existing.name}><p className="subtitle">You can add another branch or products under Shop settings.</p><Link href="/dashboard" className="button mt-5">Go to overview <ArrowRight size={15} /></Link></Panel></Shell>;
  return <Shell title="Shop setup"><PageHead title="First, your shop." description="Set up the business and its first branch. You can add products and more branches later." eyebrow="Welcome / Setup" />
    <div className="form-layout"><form className="panel form-card" onSubmit={submit} noValidate><StatusNotice success={message} error={failure} />{message && <Link href="/dashboard" className="button mb-4">Go to overview <ArrowRight size={15} /></Link>}<div className="form-grid"><div className="field full"><label htmlFor="business-name">Business name</label><input id="business-name" name="name" required minLength={2} placeholder="e.g. Wanjiku’s Kienyeji" data-testid="input-business-name" /></div><div className="field"><label htmlFor="opening-date">Opening date</label><input id="opening-date" type="date" name="openingDate" defaultValue={today()} required data-testid="input-opening-date" /></div><div /><div className="field"><label htmlFor="branch-name">First branch name</label><input id="branch-name" name="branch" required placeholder="e.g. Githurai shop" data-testid="input-branch-name" /></div><div className="field"><label htmlFor="location">Town / location</label><input id="location" name="location" required placeholder="e.g. Githurai 45, Nairobi" data-testid="input-location" /></div>
      <div className="field full mt-2"><div className="eyebrow">Branch responsibility labels · optional</div><span className="field-help">These labels describe who keeps a routine visible; they do not grant staff permissions.</span></div>
      <div className="field"><label htmlFor="setup-stock-owner">Stock count</label><input id="setup-stock-owner" name="stockCountOwner" placeholder="Name or role" data-testid="input-setup-stock-owner"/></div>
      <div className="field"><label htmlFor="setup-cash-owner">Cash reconciliation</label><input id="setup-cash-owner" name="cashReconciliationOwner" placeholder="Name or role" data-testid="input-setup-cash-owner"/></div>
      <div className="field"><label htmlFor="setup-credit-owner">Credit follow-up</label><input id="setup-credit-owner" name="creditFollowUpOwner" placeholder="Name or role" data-testid="input-setup-credit-owner"/></div>
      <div className="field"><label htmlFor="setup-close-owner">Day close</label><input id="setup-close-owner" name="dayCloseOwner" placeholder="Name or role" data-testid="input-setup-close-owner"/></div>
    </div><div className="form-actions"><button className="button" type="submit" disabled={create.isPending} data-testid="button-create-business">{create.isPending ? 'Setting up…' : 'Set up business'} <ArrowRight size={15} /></button></div></form><aside className="panel panel-pad"><div className="empty-mark"><ShieldCheck size={20} /></div><h2 className="section-title">Built around your real shop</h2><p className="subtitle mt-3" style={{ lineHeight: 1.7 }}>Your records are grouped by business and branch. Prices and totals are kept in Kenyan shillings, with dates shown in East Africa time.</p><p className="mono text-xs mt-5" style={{ color: '#8b958d' }}>CURRENCY · KES<br />TIME ZONE · AFRICA/NAIROBI</p></aside></div>
  </Shell>;
}

function DashboardPage() {
  const { branchId } = useBranch();
  const params = useMemo(() => branchId ? { branchId } : undefined, [branchId]);
  const q = useGetDashboardSummary(params);
  const summary = q.data;
  const m = summary?.metrics;
  const trends = summary?.trends || [];
  const max = Math.max(1, ...trends.map(t => num(t.revenue)));
  return <Shell title="Overview"><PageHead title="The day, at a glance." description="A practical read on sales, cash, stock and the work still to do." action={<Link href="/sales" className="button"><Plus size={15} /> Record a sale</Link>} />
    <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()}>{summary && m ? <>
      <div className="metric-grid">
        <Metric label="Sales revenue" value={money(m.revenue, summary.currency)} foot={`${summary.from === summary.to ? 'Today' : `${formatDate(summary.from)} – ${formatDate(summary.to)}`}`} icon={<Banknote size={14} />} />
        <Metric label="Gross profit" value={money(m.grossProfit, summary.currency)} foot={`${money(m.averageGrossProfitPerUnit, summary.currency)} average / base unit`} icon={<CircleDollarSign size={14} />} />
        <Metric label="Cash collected" value={money(m.cashCollected, summary.currency)} foot={`${money(m.outstandingCredit, summary.currency)} still on credit`} icon={<Wallet size={14} />} />
        <Metric label="Net profit" value={money(m.netProfit, summary.currency)} foot={`${money(m.expenses, summary.currency)} operating costs`} icon={<Scale size={14} />} />
      </div>
      <div className="grid-two"><Panel title="Revenue rhythm" extra={<span className="pill">KES / day</span>}>
        {trends.length ? <div className="chart-area" aria-label="Daily revenue trend">{trends.slice(-9).map((t, i) => <div className="chart-bar-wrap" key={t.date} title={`${formatDate(t.date)} · ${money(t.revenue, summary.currency)}`}><div className="chart-bar" style={{ height: `${Math.max(5, num(t.revenue) / max * 100)}%`, animationDelay: `${i * 45}ms` }} /><span className="chart-label">{new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short' }).format(new Date(t.date))}</span></div>)}</div> : <Empty icon={<BarChart3 size={18} />} title="Trend is taking shape" body="As sales are recorded, the daily picture will appear here." />}
      </Panel><Panel title="Needs a closer look" extra={<span className="pill amber">{summary.lowStock.length} low</span>}>
        {summary.lowStock.length ? <div className="activity-list">{summary.lowStock.slice(0, 5).map((s, i) => <div className="activity-row" key={`${s.branchId}-${s.productId}`}><div className="activity-icon"><Package size={16} /></div><div className="activity-main"><div className="activity-title">{s.productName}</div><div className="activity-meta">{s.branchName}</div></div><span className="amount">{s.quantity} {s.unit}</span></div>)}</div> : <Empty icon={<CheckCircle2 size={18} />} title="Stock looks steady" body="No products are below their low-stock mark." />}
      </Panel></div>
      <div className="grid-two"><Panel title="Recent sales" extra={<Link href="/sales" className="text-xs text-[#50675a] no-underline">All sales <ArrowRight size={12} className="inline" /></Link>}>
        {summary.recentSales.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Receipt</th><th>Product</th><th>Paid</th><th>Due</th></tr></thead><tbody>{summary.recentSales.slice(0, 5).map(s => <tr key={s.id}><td className="mono">{s.receiptNumber}</td><td>{s.productName}<div className="text-[10px] text-[#879188]">{s.customerName || 'Walk-in'}</div></td><td>{money(s.paidAmount, summary.currency)}</td><td>{num(s.amountDue) ? <span className="pill amber">{money(s.amountDue, summary.currency)}</span> : '—'}</td></tr>)}</tbody></table></div> : <Empty icon={<ShoppingCart size={18} />} title="No sales recorded yet" body="Your first sale will show up here." />}</Panel>
        <Panel title="Stock & costs" extra={<Link href="/stock" className="text-xs text-[#50675a] no-underline">Open stock <ArrowRight size={12} className="inline" /></Link>}>
          <div className="activity-list">
            <div className="activity-row"><div className="activity-icon"><Package size={16}/></div><div className="activity-main"><div className="activity-title">Stock on hand by base unit</div>{(m.stockOnHandByUnit || []).length ? (m.stockOnHandByUnit || []).map(item=><div className="activity-meta" key={item.unit}>{item.quantity} {item.unit}</div>) : <div className="activity-meta">No stock quantity recorded</div>}</div><span className="amount">{money(m.stockValue, summary.currency)} value</span></div>
            <div className="activity-row"><div className="activity-icon"><ShoppingCart size={16}/></div><div className="activity-main"><div className="activity-title">Sold by base unit</div>{(m.unitsSoldByUnit || []).length ? (m.unitsSoldByUnit || []).map(item=><div className="activity-meta" key={item.unit}>{item.quantity} {item.unit}</div>) : <div className="activity-meta">No sales quantity recorded</div>}</div><span className="amount">Avg. gross / unit {money(m.averageGrossProfitPerUnit, summary.currency)}</span></div>
            <InfoRow icon={<ArrowDownLeft size={16} />} label="Stock losses" value={money(m.stockLossValue, summary.currency)} detail="Recorded cost of losses" />
            <InfoRow icon={<Receipt size={16} />} label="Unpaid expenses" value={money(m.expensesUnpaid, summary.currency)} detail="Still due to suppliers" />
          </div>
        </Panel></div>
    </> : null}</QueryState>
  </Shell>;
}
function Metric({ label, value, foot, icon, alert }: { label: string; value: string; foot: string; icon: ReactNode; alert?: boolean }) { return <div className={`panel metric ${alert ? 'alert' : ''}`}><div className="metric-label">{icon}{label}</div><div className="metric-value" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div><div className="metric-foot">{foot}</div></div>; }
function InfoRow({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) { return <div className="activity-row"><div className="activity-icon">{icon}</div><div className="activity-main"><div className="activity-title">{label}</div><div className="activity-meta">{detail}</div></div><span className="amount">{value}</span></div>; }
function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) { return <div className="empty-state"><div className="empty-mark">{icon}</div><h3>{title}</h3><p>{body}</p>{action && <div className="mt-4">{action}</div>}</div>; }

function StockPage() {
  const { branchId } = useBranch(); const params = useMemo(() => branchId ? { branchId } : undefined, [branchId]);
  const stockQ = useGetStock(params); const productsQ = useListProducts(); const countsQ = useListStockCounts(params);
  const receive = useReceiveStock(); const loss = useRecordStockLoss(); const count = useRecordStockCount();
  const client = useQueryClient(); const [mode, setMode] = useState<'receive'|'loss'|'count'>('receive');
  const [success, setSuccess] = useState(''); const [failure, setFailure] = useState<unknown>();
  const branchesQ = useGetBusiness(); const branches = branchesQ.data?.branches.filter(b=>b.active) || []; const products = productsQ.data?.filter(p=>p.active) || [];
  const invalidate = () => { client.invalidateQueries({ queryKey: getGetStockQueryKey() }); client.invalidateQueries({ queryKey: getGetStockQueryKey(params) }); client.invalidateQueries({ queryKey: getListStockCountsQueryKey() }); client.invalidateQueries({ queryKey: getListStockCountsQueryKey(params) }); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const formEl = e.currentTarget; setSuccess(''); setFailure(undefined); const f = new FormData(formEl);
    const branch = String(f.get('branch') || branchId || branches[0]?.id || '');
    const productId = String(f.get('product') || '');
    if (!branch || (mode !== 'receive' && !productId)) { setFailure(new Error('Choose a branch and product before saving.')); return; }
    if (mode === 'receive') {
      const supplierName = String(f.get('supplier') || '').trim(); const quantity = String(f.get('quantity') || '').trim(); const unitCost = String(f.get('unitCost') || '').trim();
      if (!supplierName || !quantity || !(Number(quantity) > 0) || !Number.isFinite(Number(quantity)) || !unitCost || Number(unitCost) < 0 || !Number.isFinite(Number(unitCost))) { setFailure(new Error('Enter a supplier, quantity greater than zero and a valid unit cost.')); return; }
      if (!productId) { setFailure(new Error('Choose a product for this delivery.')); return; }
      receive.mutate({ data: { branchId: branch, supplierName, reference: String(f.get('reference') || ''), receivedAt: nowLocal(), lines: [{ productId, quantity, unitCost }], notes: String(f.get('notes') || '') } }, { onSuccess: () => { setSuccess('Stock receipt saved. On-hand quantities have been refreshed.'); invalidate(); formEl.reset(); }, onError: setFailure });
      return;
    }
    const quantity = String(f.get('quantity') || '').trim(); if (!quantity || !Number.isFinite(Number(quantity)) || (mode === 'count' ? Number(quantity) < 0 : Number(quantity) <= 0)) { setFailure(new Error(mode === 'count' ? 'Counted quantity cannot be below zero.' : 'Quantity must be greater than zero.')); return; }
    if (mode === 'loss') {
      const cause = String(f.get('cause') || '').trim(); if (!cause) { setFailure(new Error('Add a reason for this stock loss.')); return; }
      loss.mutate({ data: { branchId: branch, productId, quantity, cause, notes: String(f.get('notes') || ''), occurredAt: nowLocal() } }, { onSuccess: () => { setSuccess('Stock loss recorded. On-hand quantities have been refreshed.'); invalidate(); formEl.reset(); }, onError: setFailure });
    } else {
      count.mutate({ data: { branchId: branch, productId, countedQuantity: quantity, countedAt: nowLocal(), notes: String(f.get('notes') || '') } }, { onSuccess: () => { setSuccess('Physical count recorded. Your variance is now in the count history.'); invalidate(); formEl.reset(); }, onError: setFailure });
    }
  };
  const pending = receive.isPending || loss.isPending || count.isPending;
  return <Shell title="Stock room"><PageHead title="Stock, accounted for." description="Receive batches, record losses and compare the screen with what is physically there." eyebrow="Inventory / Branch record" />
    <div className="form-layout"><section className="panel form-card"><div className="tabs">{([['receive','Receive stock'],['loss','Record loss'],['count','Physical count']] as const).map(([key, label]) => <button className={`tab ${mode===key?'active':''}`} type="button" onClick={()=>{setMode(key);setSuccess('');setFailure(undefined)}} key={key} data-testid={`tab-stock-${key}`}>{label}</button>)}</div>
      <StatusNotice success={success} error={failure} /><form onSubmit={submit} noValidate><div className="form-grid">
        <div className="field"><label>Branch</label><select name="branch" defaultValue={branchId || branches[0]?.id || ''} required data-testid="select-stock-branch">{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <div className="field"><label>Product</label><select name="product" defaultValue="" required data-testid="select-stock-product"><option value="" disabled>Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.unit}</option>)}</select></div>
        {mode==='receive' && <div className="field"><label>Supplier name</label><input name="supplier" required placeholder="Supplier or farm name" data-testid="input-stock-supplier" /></div>}
        <div className="field"><label>{mode==='count'?'Counted quantity':'Quantity'} <span className="field-help">{mode==='receive'?'received':mode==='loss'?'lost':'physically counted'}</span></label><input name="quantity" type="number" min="0.01" step="0.01" required data-testid="input-stock-quantity" /></div>
        {mode==='receive' && <><div className="field"><label>Cost per unit (KES)</label><input name="unitCost" type="number" min="0" step="0.01" required data-testid="input-stock-unit-cost" /></div><div className="field"><label>Supplier reference <span className="field-help">optional</span></label><input name="reference" placeholder="Invoice / delivery note" data-testid="input-stock-reference" /></div></>}
        {mode==='loss' && <div className="field"><label>Reason for loss</label><select name="cause" required data-testid="select-stock-cause"><option value="">Choose a reason</option><option value="Spoilage">Spoilage</option><option value="Damage">Damage</option><option value="Staff meal">Staff meal</option><option value="Other">Other</option></select></div>}
        <div className="field full"><label>Notes <span className="field-help">optional</span></label><textarea name="notes" placeholder="A detail worth keeping with this record" data-testid="input-stock-notes" /></div>
      </div><div className="form-actions"><button type="submit" className="button" disabled={pending || branches.length===0 || products.length===0} data-testid="button-save-stock">{pending?'Saving…':mode==='receive'?'Save stock receipt':mode==='loss'?'Record stock loss':'Save physical count'} <Check size={15} /></button></div></form>
    </section>
    <aside className="panel panel-pad"><div className="section-header"><h2 className="section-title">On hand now</h2><span className="pill">{stockQ.data?.length || 0} lines</span></div><QueryState loading={stockQ.isLoading} error={stockQ.isError} retry={()=>stockQ.refetch()}>{stockQ.data?.length ? <div className="activity-list">{stockQ.data.map((s: StockItem)=><div className="activity-row" key={`${s.branchId}-${s.productId}`}><div className="activity-icon"><Egg size={16}/></div><div className="activity-main"><div className="activity-title">{s.productName}</div><div className="activity-meta">{s.branchName} · {s.oldestBatchDate ? `oldest ${formatDate(s.oldestBatchDate)}`:'No dated batch'}</div></div><span className="amount">{s.quantity} {s.unit}</span></div>)}</div>:<Empty icon={<Package size={18}/>} title="No stock on record" body="Receive your first supplier delivery to begin." />}</QueryState></aside></div>
    <section className="panel panel-pad mt-4"><div className="section-header"><h2 className="section-title">Recent physical counts</h2><span className="pill">Count history</span></div><QueryState loading={countsQ.isLoading} error={countsQ.isError} retry={()=>countsQ.refetch()}>{countsQ.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Counted at</th></tr></thead><tbody>{countsQ.data.map(c=><tr key={c.id}><td>{c.productName}</td><td>{c.expectedQuantity}</td><td>{c.countedQuantity}</td><td><span className={`pill ${num(c.variance)===0?'green':num(c.variance)<0?'red':'amber'}`}>{num(c.variance)>0?'+':''}{c.variance}</span></td><td>{formatDate(c.countedAt)}</td></tr>)}</tbody></table></div>:<Empty icon={<ClipboardList size={18}/>} title="No counts recorded" body="A physical count creates a useful comparison against expected stock." />}</QueryState></section>
  </Shell>;
}

function SalesPage() {
  const { branchId }=useBranch(); const params=useMemo(()=>branchId?{branchId}:undefined,[branchId]);
  const salesQ=useListSales(params); const productsQ=useListProducts(); const setupQ=useGetBusiness();
  const sale=useCreateSale(); const collection=useRecordCollection(); const client=useQueryClient();
  const [tab,setTab]=useState<'sale'|'collection'>('sale');const[success,setSuccess]=useState('');const[failure,setFailure]=useState<unknown>();
  const activeBranches=setupQ.data?.branches.filter(b=>b.active)||[]; const products=productsQ.data?.filter(p=>p.active)||[]; const due=salesQ.data?.filter(s=>num(s.amountDue)>0)||[];
  const invalidate=()=>{client.invalidateQueries({queryKey:getListSalesQueryKey()});client.invalidateQueries({queryKey:getListSalesQueryKey(params)});client.invalidateQueries({queryKey:getGetDashboardSummaryQueryKey()});};
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const formEl=e.currentTarget;setSuccess('');setFailure(undefined);const f=new FormData(formEl);
    if(tab==='sale'){const branch=String(f.get('branch')||branchId||activeBranches[0]?.id||'');const productId=String(f.get('product')||'');const quantity=String(f.get('quantity')||'').trim();const unitPrice=String(f.get('unitPrice')||'').trim();const discount=String(f.get('discount')||'').trim();const method=String(f.get('paymentMethod')||'cash') as 'cash'|'mpesa'|'bank'|'credit'|'split';const paidAmount=String(f.get('paidAmount')||'').trim();
      if(!branch||!productId||!quantity||!(Number(quantity)>0)||!unitPrice||Number(unitPrice)<0||!paidAmount||Number(paidAmount)<0||!Number.isFinite(Number(quantity))||!Number.isFinite(Number(unitPrice))||!Number.isFinite(Number(paidAmount))){setFailure(new Error('Choose a branch and product, then enter a valid quantity, price and amount paid.'));return}
      if(discount&&(Number(discount)<0||!Number.isFinite(Number(discount)))){setFailure(new Error('Enter a valid discount amount or leave it blank.'));return}
      const saleTotal=Number(quantity)*Number(unitPrice)-Number(discount||0);if(saleTotal<0||Number(paidAmount)>saleTotal){setFailure(new Error('Discount cannot exceed the sale value, and amount paid cannot exceed the sale total.'));return}
      sale.mutate({data:{branchId:branch,productId,quantity,unitPrice,...(discount?{discount}:{}),customerName:String(f.get('customer')||'').trim(),paymentMethod:method,paidAmount,soldAt:nowLocal(),notes:String(f.get('notes')||'')}},{onSuccess:(result)=>{setSuccess(`Sale saved · receipt ${result.receiptNumber}`);invalidate();formEl.reset()},onError:setFailure});
    }else{const saleId=String(f.get('sale')||'');const amount=String(f.get('amount')||'').trim();if(!saleId||!amount||!(Number(amount)>0)||!Number.isFinite(Number(amount))){setFailure(new Error('Choose a credit sale and enter an amount greater than zero.'));return}
      const selected=due.find(s=>s.id===saleId);if(selected&&Number(amount)>num(selected.amountDue)){setFailure(new Error('Collection cannot exceed the outstanding balance.'));return}
      collection.mutate({data:{saleId,amount,paymentMethod:String(f.get('method')||'cash') as 'cash'|'mpesa'|'bank',reference:String(f.get('reference')||''),paidAt:nowLocal()}},{onSuccess:()=>{setSuccess('Customer payment recorded. Outstanding credit has been refreshed.');invalidate();formEl.reset()},onError:setFailure});
    }};
  return <Shell title="Sales & credit"><PageHead title="Sales, kept straight." description="Capture each sale and keep the balance due visible until it is collected." eyebrow="Till / Sales ledger" />
    <div className="form-layout"><section className="panel form-card"><div className="tabs"><button type="button" className={`tab ${tab==='sale'?'active':''}`} onClick={()=>{setTab('sale');setSuccess('');setFailure(undefined)}} data-testid="tab-new-sale">New sale</button><button type="button" className={`tab ${tab==='collection'?'active':''}`} onClick={()=>{setTab('collection');setSuccess('');setFailure(undefined)}} data-testid="tab-collect-credit">Collect credit</button></div><StatusNotice success={success} error={failure}/>
      <form onSubmit={submit} noValidate><div className="form-grid">{tab==='sale'?<>
        <div className="field"><label>Branch</label><select name="branch" defaultValue={branchId||activeBranches[0]?.id||''} required data-testid="select-sale-branch">{activeBranches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <div className="field"><label>Product</label><select name="product" required defaultValue="" data-testid="select-sale-product"><option value="" disabled>Select product</option>{products.map(p=><option value={p.id} key={p.id}>{p.name} · {p.unit}</option>)}</select></div>
        <div className="field"><label>Quantity</label><input name="quantity" type="number" min="0.01" step="0.01" required data-testid="input-sale-quantity"/></div>
        <div className="field"><label>Price per unit (KES)</label><input name="unitPrice" type="number" min="0" step="0.01" required data-testid="input-sale-price"/></div>
        <div className="field"><label>Discount (KES) <span className="field-help">optional</span></label><input name="discount" type="number" min="0" step="0.01" data-testid="input-sale-discount"/></div>
        <div className="field"><label>Payment method</label><select name="paymentMethod" defaultValue="cash" data-testid="select-sale-method"><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option><option value="credit">Credit</option><option value="split">Split payment</option></select></div>
        <div className="field"><label>Amount paid (KES)</label><input name="paidAmount" type="number" min="0" step="0.01" defaultValue="0" data-testid="input-sale-paid"/><span className="field-help">Enter 0 for a fully unpaid credit sale.</span></div>
        <div className="field full"><label>Customer name <span className="field-help">optional, useful for credit</span></label><input name="customer" placeholder="Customer name" data-testid="input-sale-customer"/></div>
        <div className="field full"><label>Notes <span className="field-help">optional</span></label><input name="notes" placeholder="Anything to note with this sale" data-testid="input-sale-notes"/></div>
      </>:<><div className="field full"><label>Outstanding sale</label><select name="sale" defaultValue="" required data-testid="select-collection-sale"><option value="" disabled>Select customer / receipt</option>{due.map(s=><option value={s.id} key={s.id}>{s.customerName||'Customer'} · {s.receiptNumber} · due {money(s.amountDue)}</option>)}</select></div><div className="field"><label>Amount collected (KES)</label><input name="amount" type="number" min="0.01" step="0.01" required data-testid="input-collection-amount"/></div><div className="field"><label>Method</label><select name="method" defaultValue="cash" data-testid="select-collection-method"><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option></select></div><div className="field full"><label>Payment reference <span className="field-help">optional</span></label><input name="reference" placeholder="M-Pesa transaction code" data-testid="input-collection-reference"/></div></>}</div><div className="form-actions"><button className="button" type="submit" disabled={sale.isPending||collection.isPending} data-testid="button-submit-sale">{sale.isPending||collection.isPending?'Saving…':tab==='sale'?'Save sale':'Record collection'} <Check size={15}/></button></div></form>
    </section><Panel title={tab==='sale'?'Quick checks':'Credit outstanding'} extra={<span className="pill amber">{due.length} balances</span>}>{tab==='sale'?<><InfoRow icon={<CircleDollarSign size={16}/>} label="Payment choices" value="5 ways" detail="Cash · M-Pesa · bank · credit · split"/><div className="notice mt-4" style={{background:'#f1eee3',color:'#68766d'}}>Sale totals are calculated from quantity and unit price. Record the actual amount received to keep credit accurate.</div></>:due.length?<div className="activity-list">{due.slice(0,6).map(s=><div className="activity-row" key={s.id}><div className="activity-icon"><Users size={16}/></div><div className="activity-main"><div className="activity-title">{s.customerName||'Customer'}</div><div className="activity-meta">{s.receiptNumber} · {formatDate(s.soldAt)}</div></div><span className="amount">{money(s.amountDue)}</span></div>)}</div>:<Empty icon={<CheckCircle2 size={18}/>} title="No credit to collect" body="Open balances will appear here after a credit sale."/>}</Panel></div>
    <Panel title="Recent sales" extra={<span className="pill">{salesQ.data?.length||0} records</span>} className="mt-4"><QueryState loading={salesQ.isLoading} error={salesQ.isError} retry={()=>salesQ.refetch()}>{salesQ.data?.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Receipt / time</th><th>Product</th><th>Qty</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead><tbody>{salesQ.data.slice(0,20).map((s:Sale)=><tr key={s.id}><td className="mono">{s.receiptNumber}<div className="text-[10px] text-[#879188]">{formatDate(s.soldAt)}</div></td><td>{s.productName}<div className="text-[10px] text-[#879188]">{s.customerName||'Walk-in'}</div></td><td>{s.quantity} {s.unit}</td><td>{money(s.total)}</td><td>{money(s.paidAmount)}</td><td>{num(s.amountDue)?<span className="pill amber">{money(s.amountDue)}</span>:'—'}</td></tr>)}</tbody></table></div>:<Empty icon={<ShoppingCart size={18}/>} title="The sales ledger is empty" body="Record a sale to begin your daily sales record."/>}</QueryState></Panel>
  </Shell>;
}

function ExpensesPage() {
  const {branchId}=useBranch(); const params=useMemo(()=>branchId?{branchId}:undefined,[branchId]);const q=useListExpenses(params);const setup=useGetBusiness();const create=useCreateExpense();const client=useQueryClient();const[success,setSuccess]=useState('');const[failure,setFailure]=useState<unknown>();
  const branches=setup.data?.branches.filter(b=>b.active)||[];
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const formEl=e.currentTarget;setSuccess('');setFailure(undefined);const f=new FormData(formEl);const amount=String(f.get('amount')||'').trim();const paidAmount=String(f.get('paidAmount')||'').trim();const branch=String(f.get('branch')||branchId||branches[0]?.id||'');const category=String(f.get('category')||'').trim();if(!branch||!category||!amount||!(Number(amount)>0)||!Number.isFinite(Number(amount))||!paidAmount||Number(paidAmount)<0||!Number.isFinite(Number(paidAmount))||Number(paidAmount)>Number(amount)){setFailure(new Error('Choose a branch and category. Amount must be positive and paid amount cannot exceed it.'));return}
    create.mutate({data:{branchId:branch,category,description:String(f.get('description')||''),amount,paymentStatus:Number(paidAmount)===0?'unpaid':Number(paidAmount)>=Number(amount)?'paid':'partial',paidAmount,paymentMethod:String(f.get('paymentMethod')||'cash') as 'cash'|'mpesa'|'bank'|'credit',expenseDate:String(f.get('expenseDate')||today())}},{onSuccess:()=>{setSuccess('Operating cost saved. Expense totals have been refreshed.');client.invalidateQueries({queryKey:getListExpensesQueryKey()});client.invalidateQueries({queryKey:getListExpensesQueryKey(params)});client.invalidateQueries({queryKey:getGetDashboardSummaryQueryKey()});formEl.reset()},onError:setFailure});
  };
  const totals=(q.data||[]).reduce((a,x)=>({amount:a.amount+num(x.amount),due:a.due+num(x.amountDue)}),{amount:0,due:0});
  return <Shell title="Expenses"><PageHead title="Costs, on the record." description="Log what it cost to keep the shop open, and what is still waiting to be paid." eyebrow="Operating costs / Daily record" />
    <div className="form-layout"><form className="panel form-card" onSubmit={submit} noValidate><StatusNotice success={success} error={failure}/><div className="form-grid">
      <div className="field"><label>Branch</label><select name="branch" defaultValue={branchId||branches[0]?.id||''} required data-testid="select-expense-branch">{branches.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></div>
      <div className="field"><label>Category</label><select name="category" required defaultValue="" data-testid="select-expense-category"><option value="" disabled>Choose category</option>{['Transport','Rent','Utilities','Packaging','Wages','Cleaning','Repairs','Other'].map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="field"><label>Total amount (KES)</label><input type="number" name="amount" min="0.01" step="0.01" required data-testid="input-expense-amount"/></div>
      <div className="field"><label>Paid so far (KES)</label><input type="number" name="paidAmount" min="0" step="0.01" defaultValue="0" data-testid="input-expense-paid"/></div>
      <div className="field"><label>Payment method</label><select name="paymentMethod" defaultValue="cash" data-testid="select-expense-method"><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option><option value="credit">Credit</option></select></div>
      <div className="field"><label>Date</label><input type="date" name="expenseDate" defaultValue={today()} required data-testid="input-expense-date"/></div>
      <div className="field full"><label>Description <span className="field-help">optional</span></label><input name="description" placeholder="What was this cost for?" data-testid="input-expense-description"/></div>
    </div><div className="form-actions"><button type="submit" className="button" disabled={create.isPending} data-testid="button-save-expense">{create.isPending?'Saving…':'Save expense'} <Check size={15}/></button></div></form>
    <Panel title="Expense snapshot"><div className="activity-list"><InfoRow icon={<Receipt size={16}/>} label="Recorded costs" value={money(totals.amount)} detail={`${q.data?.length||0} expense records`}/><InfoRow icon={<Wallet size={16}/>} label="Still to pay" value={money(totals.due)} detail="Outstanding expense balance"/></div><div className="notice mt-4" style={{background:'#f1eee3',color:'#68766d'}}>Partial payments are recorded as the amount paid and amount still due. Keep the supplier’s total cost intact.</div></Panel></div>
    <Panel title="Expense ledger" extra={<span className="pill">{q.data?.length||0} records</span>} className="mt-4"><QueryState loading={q.isLoading} error={q.isError} retry={()=>q.refetch()}>{q.data?.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead><tbody>{q.data.map(x=><tr key={x.id}><td>{formatDate(x.expenseDate)}</td><td>{x.category}</td><td>{x.description||'—'}</td><td>{money(x.amount)}</td><td>{money(x.paidAmount)}</td><td>{num(x.amountDue)?<span className="pill amber">{money(x.amountDue)}</span>:'—'}</td></tr>)}</tbody></table></div>:<Empty icon={<Receipt size={18}/>} title="No operating costs recorded" body="Start a clear record with your next shop expense."/>}</QueryState></Panel>
  </Shell>;
}

function FactCards({ facts }: { facts: BusinessReview['facts'] }) {
  if (!facts?.length) return <Empty icon={<FileText size={18}/>} title="No facts to show yet" body="The review will fill in as shop records accumulate." />;
  return <div className="fact-grid">{facts.map((fact,i)=><article className="panel fact-card" key={`${fact.label}-${i}`}><div className="fact-label">{fact.label}</div><div className="fact-value">{fact.value}</div><div className="fact-copy">{fact.interpretation}</div><div className="mono text-[9px] text-[#929b91] mt-3">{fact.evidenceCount} {fact.evidenceCount===1?'record':'records'} inform this fact</div><div className="mt-3 pt-3 border-t border-[#eeeade]"><div className="fact-label">Evidence source</div><div className="text-[11px] text-[#53645a] mt-1">{fact.sourceType || 'Not specified'}</div><div className="mono text-[9px] text-[#929b91] mt-1 break-all" data-testid={`review-record-ids-${i}`}>{fact.recordIds?.length ? `Records: ${fact.recordIds.join(', ')}` : 'No record IDs supplied'}</div></div></article>)}</div>;
}
function ReviewPage() {
  const {branchId}=useBranch();const params=useMemo(()=>branchId?{branchId}:undefined,[branchId]);const q=useGetBusinessReview(params);const r=q.data;
  return <Shell title="Business review"><PageHead title="A better question than “how was business?”" description="A structured read of the shop’s people, process and product — grounded in saved records." eyebrow="Owner’s desk / Management review" />
    <QueryState loading={q.isLoading} error={q.isError} retry={()=>q.refetch()}>{r?<><section className="review-intro"><div className="eyebrow">{r.period} <span style={{margin:'0 7px'}}>·</span>{r.branchName}</div><h2>{r.executiveSummary}</h2><p>Read this as a management prompt, not a verdict. Each observation is tied to the available records, and the limitations are listed below.</p></section>
      <Panel title="What the records say"><FactCards facts={r.facts}/></Panel>
      <div className="review-columns"><Panel title="People · Process · Product"><FactCards facts={r.peopleProcessProduct}/></Panel><Panel title="Unit economics"><FactCards facts={r.unitEconomics}/></Panel></div>
      <div className="review-columns"><Panel title="Cash & credit"><FactCards facts={r.cashAndCredit}/></Panel><Panel title="Key issues"><BulletList items={r.keyIssues}/></Panel></div>
      <div className="review-columns"><Panel title="Likely causes"><BulletList items={r.likelyCauses}/></Panel><Panel title="Recommendation summary"><p className="subtitle" style={{lineHeight:1.75}}>{r.recommendationSummary || 'No summary provided for this review period.'}</p></Panel></div>
      <div className="review-columns"><Panel title="Options to consider"><BulletList items={r.options}/></Panel><Panel title="Recommended next moves">{r.recommendations?.length?<div className="activity-list">{r.recommendations.map((a,i)=><div className="activity-row" key={`${a.title}-${i}`}><div className="activity-icon"><ArrowRight size={16}/></div><div className="activity-main"><div className="activity-title">{a.title}</div><div className="activity-meta">{a.rationale}</div></div><span className={`pill ${a.priority==='high'?'red':a.priority==='medium'?'amber':'green'}`}>{a.dueInDays}d</span></div>)}</div>:<Empty icon={<CheckCircle2 size={18}/>} title="No recommendations yet" body="There are not enough records for a focused next move."/>}</Panel></div>
      <Panel title="Data limitations" className="mt-4"><BulletList items={r.dataLimitations}/></Panel>
    </>:null}</QueryState>
  </Shell>;
}
function BulletList({ items }: { items: string[] }) { return items?.length?<ul className="list-clean">{items.map((x,i)=><li key={`${i}-${x}`}>{x}</li>)}</ul>:<p className="subtitle">Nothing to flag from the available information.</p>; }

function ActionsPage() {
  const q=useListActions();const create=useCreateAction();const update=useUpdateAction();const client=useQueryClient();const[success,setSuccess]=useState('');const[failure,setFailure]=useState<unknown>();
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const formEl=e.currentTarget;setSuccess('');setFailure(undefined);const f=new FormData(formEl);const title=String(f.get('title')||'').trim(),owner=String(f.get('owner')||'').trim(),successMetric=String(f.get('metric')||'').trim(),dueDate=String(f.get('dueDate')||'');if(!title||!owner||!successMetric||!dueDate){setFailure(new Error('Complete the action, owner, deadline and success measure.'));return}
    create.mutate({data:{title,owner,successMetric,dueDate,status:'open'}},{onSuccess:()=>{setSuccess('Owner action added to the list.');client.invalidateQueries({queryKey:getListActionsQueryKey()});formEl.reset()},onError:setFailure});
  };
  const actions=q.data||[];
  return <Shell title="Owner actions"><PageHead title="Turn the review into action." description="Make the next step specific: one owner, one deadline, one way to tell it worked." eyebrow="Follow-through / Owner’s list" />
    <div className="form-layout"><form className="panel form-card" onSubmit={submit} noValidate><StatusNotice success={success} error={failure}/><div className="form-grid"><div className="field full"><label>Action</label><input name="title" required placeholder="e.g. Confirm a second supplier price" data-testid="input-action-title"/></div><div className="field"><label>Owner</label><input name="owner" required placeholder="Who will take this forward?" data-testid="input-action-owner"/></div><div className="field"><label>Due date</label><input type="date" name="dueDate" min={today()} required data-testid="input-action-due-date"/></div><div className="field full"><label>Success measure</label><input name="metric" required placeholder="What will be different when it is done?" data-testid="input-action-metric"/></div></div><div className="form-actions"><button className="button" type="submit" disabled={create.isPending} data-testid="button-create-action">{create.isPending?'Adding…':'Add owner action'} <Plus size={15}/></button></div></form>
      <Panel title="How we’ll know"><div className="activity-list"><InfoRow icon={<Users size={16}/>} label="One clear owner" value="Named" detail="Accountability stays visible"/><InfoRow icon={<CalendarDays size={16}/>} label="A real deadline" value="Dated" detail="A next step without drift"/><InfoRow icon={<CheckCircle2 size={16}/>} label="A success measure" value="Clear" detail="Completion can be checked"/></div></Panel></div>
     <StatusNotice success={success} error={failure}/>
     <section className="panel panel-pad mt-4"><div className="section-header"><h2 className="section-title">The owner’s list</h2><span className="pill">{actions.length} actions</span></div><QueryState loading={q.isLoading} error={q.isError} retry={()=>q.refetch()}>{actions.length?<div className="activity-list">{actions.map((a:BusinessAction)=><div className="activity-row" key={a.id}><div className="activity-icon"><ClipboardList size={16}/></div><div className="activity-main"><div className="activity-title">{a.title}</div><div className="activity-meta">Owner: {a.owner} · Due {formatDate(a.dueDate)} · Success: {a.successMetric}</div></div><select aria-label={`Status for ${a.title}`} className="pill" value={a.status} disabled={update.isPending} data-testid={`select-action-status-${a.id}`} onChange={e=>{setSuccess('');setFailure(undefined);update.mutate({id:a.id,data:{status:e.target.value as BusinessAction['status']}},{onSuccess:()=>{setSuccess('Action status updated.');client.invalidateQueries({queryKey:getListActionsQueryKey()})},onError:setFailure})}}><option value="open">Open</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select></div>)}</div>:<Empty icon={<ClipboardList size={18}/>} title="Nothing on the owner’s list" body="Add one practical action to keep the next step from slipping."/>}</QueryState></section>
  </Shell>;
}

function SettingsPage() {
  const setup=useGetBusiness();const productsQ=useListProducts();const branchMutation=useCreateBranch();const productMutation=useCreateProduct();const saveBranch=useUpdateBranch();const saveProduct=useUpdateProduct();const client=useQueryClient();
  const[tab,setTab]=useState<'branches'|'products'>('branches');const[success,setSuccess]=useState('');const[failure,setFailure]=useState<unknown>();const[editingBranch,setEditingBranch]=useState('');const[editingProduct,setEditingProduct]=useState('');
  const invalidateBranches=()=>client.invalidateQueries({queryKey:getGetBusinessQueryKey()});
  const invalidateProducts=()=>{client.invalidateQueries({queryKey:getListProductsQueryKey()});client.invalidateQueries({queryKey:getGetStockQueryKey()});client.invalidateQueries({queryKey:getGetDashboardSummaryQueryKey()});};
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const formEl=e.currentTarget;setSuccess('');setFailure(undefined);const f=new FormData(formEl);
    if(tab==='branches'){
      const name=String(f.get('name')||'').trim(),location=String(f.get('location')||'').trim();
      if(!name||!location){setFailure(new Error('Enter a branch name and location.'));return}
      branchMutation.mutate({data:{name,location,stockCountOwner:String(f.get('stockCountOwner')||'').trim(),cashReconciliationOwner:String(f.get('cashReconciliationOwner')||'').trim(),creditFollowUpOwner:String(f.get('creditFollowUpOwner')||'').trim(),dayCloseOwner:String(f.get('dayCloseOwner')||'').trim()}},{onSuccess:()=>{setSuccess('Branch added.');invalidateBranches();formEl.reset()},onError:setFailure});
    }else{
      const name=String(f.get('name')||'').trim(),unit=String(f.get('unit')||'').trim(),lowStockThreshold=String(f.get('threshold')||'').trim();
      if(!name||!unit||!lowStockThreshold||Number(lowStockThreshold)<0||!Number.isFinite(Number(lowStockThreshold))){setFailure(new Error('Enter a product name, unit and valid low-stock threshold.'));return}
      productMutation.mutate({data:{name,unit,lowStockThreshold}},{onSuccess:()=>{setSuccess('Product added to your shop list.');invalidateProducts();formEl.reset()},onError:setFailure});
    }
  };
  const saveBranchDetails=(e:FormEvent<HTMLFormElement>,id:string)=>{e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get('name')||'').trim(),location=String(f.get('location')||'').trim();if(!name||!location){setFailure(new Error('Branch name and location are required.'));return}
    setFailure(undefined);setSuccess('');saveBranch.mutate({id,data:{name,location,stockCountOwner:String(f.get('stockCountOwner')||'').trim(),cashReconciliationOwner:String(f.get('cashReconciliationOwner')||'').trim(),creditFollowUpOwner:String(f.get('creditFollowUpOwner')||'').trim(),dayCloseOwner:String(f.get('dayCloseOwner')||'').trim()}},{onSuccess:()=>{setSuccess('Branch responsibilities saved.');setEditingBranch('');invalidateBranches()},onError:setFailure});
  };
  const saveProductDetails=(e:FormEvent<HTMLFormElement>,id:string)=>{e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get('name')||'').trim(),unit=String(f.get('unit')||'').trim(),lowStockThreshold=String(f.get('threshold')||'').trim();if(!name||!unit||!lowStockThreshold||Number(lowStockThreshold)<0||!Number.isFinite(Number(lowStockThreshold))){setFailure(new Error('Product name, unit and a valid threshold are required.'));return}
    setFailure(undefined);setSuccess('');saveProduct.mutate({id,data:{name,unit,lowStockThreshold}},{onSuccess:()=>{setSuccess('Product details saved.');setEditingProduct('');invalidateProducts()},onError:setFailure});
  };
  return <Shell title="Shop settings"><PageHead title="Set the shop up your way." description="Manage branches, daily responsibility labels and the products used in your records." eyebrow="Configuration / Business details" />
    <div className="tabs"><button className={`tab ${tab==='branches'?'active':''}`} onClick={()=>{setTab('branches');setSuccess('');setFailure(undefined)}} type="button" data-testid="tab-settings-branches">Branches</button><button className={`tab ${tab==='products'?'active':''}`} onClick={()=>{setTab('products');setSuccess('');setFailure(undefined)}} type="button" data-testid="tab-settings-products">Products</button></div>
    <StatusNotice success={success} error={failure}/>
    <div className="form-layout"><form className="panel form-card" onSubmit={submit} noValidate><div className="section-header"><h2 className="section-title">Add {tab==='branches'?'a branch':'a product'}</h2></div><div className="form-grid">{tab==='branches'?<>
      <div className="field"><label>Branch name</label><input name="name" required placeholder="e.g. Umoja branch" data-testid="input-branch-settings-name"/></div><div className="field"><label>Town / location</label><input name="location" required placeholder="e.g. Umoja Innercore" data-testid="input-branch-settings-location"/></div>
      <div className="field full"><div className="eyebrow">Daily responsibility labels</div><span className="field-help">These name a routine’s point person or role. They are labels only, not staff permissions.</span></div>
      <div className="field"><label>Stock count</label><input name="stockCountOwner" placeholder="Name or role" data-testid="input-branch-stock-owner"/></div><div className="field"><label>Cash reconciliation</label><input name="cashReconciliationOwner" placeholder="Name or role" data-testid="input-branch-cash-owner"/></div><div className="field"><label>Credit follow-up</label><input name="creditFollowUpOwner" placeholder="Name or role" data-testid="input-branch-credit-owner"/></div><div className="field"><label>Day close</label><input name="dayCloseOwner" placeholder="Name or role" data-testid="input-branch-day-close-owner"/></div>
    </>:<>
      <div className="field"><label>Product name</label><input name="name" required placeholder="e.g. Mature kienyeji" data-testid="input-product-name"/></div><div className="field"><label>Unit</label><select name="unit" defaultValue="bird" data-testid="select-product-unit"><option value="bird">Bird</option><option value="kg">Kilogram (kg)</option><option value="piece">Piece</option><option value="tray">Tray</option></select></div><div className="field"><label>Low-stock mark</label><input name="threshold" type="number" min="0" step="0.001" defaultValue="5" required data-testid="input-product-threshold"/><span className="field-help">Show a reminder when on-hand stock falls below this number.</span></div>
    </>}</div><div className="form-actions"><button type="submit" className="button" disabled={branchMutation.isPending||productMutation.isPending} data-testid="button-save-setting">{branchMutation.isPending||productMutation.isPending?'Saving…':`Add ${tab==='branches'?'branch':'product'}`} <Plus size={15}/></button></div></form>
      {tab==='branches'?<Panel title="Branches" extra={<span className="pill">{setup.data?.branches.filter(b=>b.active).length||0} active</span>}>{setup.data?.branches.length?<div className="activity-list">{setup.data.branches.map(b=><div className="activity-row block" key={b.id}><div className="flex items-start gap-3"><div className="activity-icon"><Store size={16}/></div><div className="activity-main"><div className="activity-title">{b.name}</div><div className="activity-meta">{b.location}</div><div className="activity-meta mt-2">Stock count: {b.stockCountOwner||'Unassigned'} · Cash reconciliation: {b.cashReconciliationOwner||'Unassigned'}</div><div className="activity-meta">Credit follow-up: {b.creditFollowUpOwner||'Unassigned'} · Day close: {b.dayCloseOwner||'Unassigned'}</div></div><span className={`pill ${b.active?'green':'red'}`}>{b.active?'Active':'Inactive'}</span></div>
        <div className="flex flex-wrap gap-2 mt-3 ml-11"><button type="button" className="button ghost small" onClick={()=>{setEditingBranch(editingBranch===b.id?'':b.id);setFailure(undefined)}} data-testid={`button-edit-branch-${b.id}`}>{editingBranch===b.id?'Cancel edit':'Edit branch'}</button><button type="button" className="button secondary small" disabled={saveBranch.isPending} onClick={()=>saveBranch.mutate({id:b.id,data:{active:!b.active}},{onSuccess:()=>{setSuccess(`Branch ${b.active?'deactivated':'activated'}.`);invalidateBranches()},onError:setFailure})} data-testid={`button-toggle-branch-${b.id}`}>{b.active?'Deactivate':'Activate'}</button></div>
        {editingBranch===b.id&&<form onSubmit={e=>saveBranchDetails(e,b.id)} className="mt-4 ml-11 p-4 rounded-xl bg-[#f4f1e8] grid gap-3">
          <div className="form-grid"><div className="field"><label>Branch name</label><input name="name" required defaultValue={b.name}/></div><div className="field"><label>Location</label><input name="location" required defaultValue={b.location}/></div><div className="field"><label>Stock count</label><input name="stockCountOwner" defaultValue={b.stockCountOwner}/></div><div className="field"><label>Cash reconciliation</label><input name="cashReconciliationOwner" defaultValue={b.cashReconciliationOwner}/></div><div className="field"><label>Credit follow-up</label><input name="creditFollowUpOwner" defaultValue={b.creditFollowUpOwner}/></div><div className="field"><label>Day close</label><input name="dayCloseOwner" defaultValue={b.dayCloseOwner}/></div></div>
          <span className="field-help">Responsibility labels describe routines only; they do not grant staff permissions.</span><button className="button small w-fit" type="submit" disabled={saveBranch.isPending}>{saveBranch.isPending?'Saving…':'Save branch'}</button>
        </form>}</div>)}</div>:<Empty icon={<Store size={18}/>} title="No branches set up" body="Your first branch will be created during business setup."/>}</Panel>:<Panel title="Products in your shop" extra={<span className="pill">{productsQ.data?.length||0} products</span>}>{productsQ.data?.length?<div className="activity-list">{productsQ.data.map(p=><div className="activity-row block" key={p.id}><div className="flex items-start gap-3"><div className="activity-icon"><Egg size={16}/></div><div className="activity-main"><div className="activity-title">{p.name}</div><div className="activity-meta">Low-stock mark: {p.lowStockThreshold} {p.unit}</div></div><span className={`pill ${p.active?'green':'red'}`}>{p.active?'Active':'Inactive'}</span></div><div className="flex flex-wrap gap-2 mt-3 ml-11"><button type="button" className="button ghost small" onClick={()=>setEditingProduct(editingProduct===p.id?'':p.id)} data-testid={`button-edit-product-${p.id}`}>{editingProduct===p.id?'Cancel edit':'Edit product'}</button><button type="button" className="button secondary small" disabled={saveProduct.isPending} onClick={()=>saveProduct.mutate({id:p.id,data:{active:!p.active}},{onSuccess:()=>{setSuccess(`Product ${p.active?'deactivated':'activated'}.`);invalidateProducts()},onError:setFailure})} data-testid={`button-toggle-product-${p.id}`}>{p.active?'Deactivate':'Activate'}</button></div>
          {editingProduct===p.id&&<form onSubmit={e=>saveProductDetails(e,p.id)} className="mt-4 ml-11 p-4 rounded-xl bg-[#f4f1e8]"><div className="form-grid"><div className="field"><label>Product name</label><input name="name" required defaultValue={p.name}/></div><div className="field"><label>Unit</label><select name="unit" defaultValue={p.unit}><option value="bird">Bird</option><option value="kg">Kilogram (kg)</option><option value="piece">Piece</option><option value="tray">Tray</option></select></div><div className="field"><label>Low-stock mark</label><input name="threshold" type="number" min="0" step="0.001" required defaultValue={p.lowStockThreshold}/></div></div><button className="button small mt-3" type="submit" disabled={saveProduct.isPending}>{saveProduct.isPending?'Saving…':'Save product'}</button></form>}</div>)}</div>:<Empty icon={<Egg size={18}/>} title="No products yet" body="Add the products your shop buys and sells."/>}</Panel>}</div>
    <div className="panel panel-pad mt-4"><div className="eyebrow">Business</div><h2 className="section-title">{setup.data?.business?.name||'Business profile'}</h2><p className="subtitle mt-2">Currency: {setup.data?.business?.currency||'KES'} · Opened {formatDate(setup.data?.business?.openingDate)}</p></div>
  </Shell>;
}

function AppRoutes() {
  const [branchId,setBranchId]=useState('');
  return <BranchContext.Provider value={{branchId,setBranchId}}><ClerkCacheInvalidator /><Switch>
    <Route path="/" component={HomeRedirect}/>
    <Route path="/sign-in/*?" component={SignInPage}/>
    <Route path="/sign-up/*?" component={SignUpPage}/>
    <Route path="/setup"><Guarded><SetupPage/></Guarded></Route>
    <Route path="/dashboard"><Guarded><DashboardPage/></Guarded></Route>
    <Route path="/stock"><Guarded><StockPage/></Guarded></Route>
    <Route path="/sales"><Guarded><SalesPage/></Guarded></Route>
    <Route path="/expenses"><Guarded><ExpensesPage/></Guarded></Route>
    <Route path="/review"><Guarded><ReviewPage/></Guarded></Route>
    <Route path="/actions"><Guarded><ActionsPage/></Guarded></Route>
    <Route path="/settings"><Guarded><SettingsPage/></Guarded></Route>
    <Route component={NotFound}/>
  </Switch></BranchContext.Provider>;
}
function ClerkRouter() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to get the full picture of your shop.' } }, signUp: { start: { title: 'Set up your shop account', subtitle: 'Start keeping your daily shop records clear.' } } }}
    routerPush={to=>setLocation(stripBase(to))} routerReplace={to=>setLocation(stripBase(to),{replace:true})}>
    <AppRoutes/>
  </ClerkProvider>;
}
function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><ClerkRouter/></WouterRouter></QueryClientProvider>;
}

export default App;
