import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  Banknote,
  BarChart3,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Egg,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Plus,
  Receipt,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import NotFound from '@/pages/not-found';

type Business = {
  id: string;
  name: string;
  currency: string;
  openingDate: string;
};

type Branch = {
  id: string;
  name: string;
  location: string;
  stockCountOwner: string;
  cashReconciliationOwner: string;
  creditFollowUpOwner: string;
  dayCloseOwner: string;
  active: boolean;
};

type Product = {
  id: string;
  name: string;
  unit: string;
  lowStockThreshold: number;
  active: boolean;
};

type Sale = {
  id: string;
  branchId: string;
  productId: string;
  receiptNumber: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPerUnit: number;
  discount: number;
  total: number;
  paidAmount: number;
  amountDue: number;
  customerName: string;
  paymentMethod: string;
  soldAt: string;
  notes: string;
};

type Expense = {
  id: string;
  branchId: string;
  category: string;
  description: string;
  amount: number;
  paidAmount: number;
  amountDue: number;
  paymentMethod: string;
  expenseDate: string;
};

type ActionItem = {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  successMetric: string;
  status: 'open' | 'in_progress' | 'complete';
};

type StockCount = {
  id: string;
  branchId: string;
  productId: string;
  productName: string;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  countedAt: string;
  notes: string;
};

type StockMovement = {
  id: string;
  branchId: string;
  productId: string;
  kind: 'receive' | 'sale' | 'loss';
  quantity: number;
  reason: string;
  occurredAt: string;
};

type AppData = {
  business: Business | null;
  branches: Branch[];
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  actions: ActionItem[];
  stockCounts: StockCount[];
  stockMovements: StockMovement[];
};

const STORAGE_KEY = 'kienyeji-shopos-local-data';

const EMPTY_APP_DATA: AppData = {
  business: null,
  branches: [],
  products: [],
  sales: [],
  expenses: [],
  actions: [],
  stockCounts: [],
  stockMovements: [],
};

const getSupabaseClient = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes('your-project') || anonKey.includes('your-supabase')) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const readStoredData = (): AppData => {
  if (typeof window === 'undefined') return EMPTY_APP_DATA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_APP_DATA;
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed.business && !parsed.branches && !parsed.products) return EMPTY_APP_DATA;
    return parsed;
  } catch {
    return EMPTY_APP_DATA;
  }
};

const readSupabaseData = async (): Promise<AppData> => {
  const supabase = getSupabaseClient();
  if (!supabase) return readStoredData();

  const { data, error } = await supabase.from('shop_data').select('payload').eq('id', 'default').maybeSingle();
  if (error) {
    console.warn('Could not load Supabase data', error);
    return readStoredData();
  }

  if (!data?.payload) return readStoredData();
  return { ...EMPTY_APP_DATA, ...data.payload } as AppData;
};

const saveAppData = async (data: AppData) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from('shop_data').upsert(
    { id: 'default', payload: data, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('Could not save Supabase data', error);
  }
};

const useSupabaseAppData = () => {
  const [data, setData] = useState<AppData>(EMPTY_APP_DATA);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const loaded = await readSupabaseData();
      if (active) setData(loaded);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return { data, setData, save: saveAppData };
};

const money = (value?: number | string | null, currency = 'KES') => {
  const amount = Number(value ?? 0);
  return `${currency} ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const formatDate = (value?: string | null) => (value ? new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—');
const nowLocal = () => new Date().toISOString();
const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const defaultBusiness = (): Business => ({
  id: makeId(),
  name: 'Kienyeji Market Shop',
  currency: 'KES',
  openingDate: today(),
});

const defaultBranches = (): Branch[] => [
  {
    id: makeId(),
    name: 'Main Branch',
    location: 'Kikuyu, Nairobi',
    stockCountOwner: 'Moses',
    cashReconciliationOwner: 'Grace',
    creditFollowUpOwner: 'Asha',
    dayCloseOwner: 'Manager',
    active: true,
  },
];

const defaultProducts = (): Product[] => [
  { id: makeId(), name: 'Live kienyeji chicken', unit: 'bird', lowStockThreshold: 8, active: true },
  { id: makeId(), name: 'Whole dressed chicken', unit: 'bird', lowStockThreshold: 6, active: true },
  { id: makeId(), name: 'Chicken wings', unit: 'kg', lowStockThreshold: 4, active: true },
  { id: makeId(), name: 'Giblets', unit: 'kg', lowStockThreshold: 3, active: true },
];

const getInventoryForProduct = (data: AppData, branchId: string, productId: string) =>
  data.stockMovements
    .filter((item) => item.branchId === branchId && item.productId === productId)
    .reduce((sum, item) => {
      if (item.kind === 'receive') return sum + item.quantity;
      if (item.kind === 'sale' || item.kind === 'loss') return sum - item.quantity;
      return sum;
    }, 0);

const BranchContext = createContext<{ branchId: string; setBranchId: (value: string) => void }>({
  branchId: '',
  setBranchId: () => undefined,
});
const useBranch = () => useContext(BranchContext);

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">K</div>
      {!compact && (
        <div>
          <div className="brand-name">Kienyeji ShopOS</div>
          <div className="brand-sub">Local manual ledger</div>
        </div>
      )}
    </div>
  );
}

function PageHead({ title, description, eyebrow, action }: { title: string; description: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow || 'Shop floor / Daily record'}</div>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({ title, children, extra, className = '' }: { title: string; children: ReactNode; extra?: ReactNode; className?: string }) {
  return (
    <section className={`panel panel-pad ${className}`}>
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, foot, icon }: { label: string; value: string; foot: string; icon: ReactNode }) {
  return (
    <div className="panel metric">
      <div className="metric-label">{icon}{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{foot}</div>
    </div>
  );
}

function InfoRow({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="activity-row">
      <div className="activity-icon">{icon}</div>
      <div className="activity-main">
        <div className="activity-title">{label}</div>
        <div className="activity-meta">{detail}</div>
      </div>
      <span className="amount">{value}</span>
    </div>
  );
}

function Empty({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function StatusNotice({ success, error }: { success?: string; error?: string }) {
  if (success) return <div className="notice success" role="status">{success}</div>;
  if (error) return <div className="notice error" role="alert">{error}</div>;
  return null;
}

function Shell({ children, title }: { children: ReactNode; title: string }) {
  const { branchId, setBranchId } = useBranch();
  const [location] = useLocation();
  const { data } = useSupabaseAppData();
  const activeBranches = data.branches.filter((branch) => branch.active);
  const nav = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/stock', label: 'Stock room', icon: Package },
    { href: '/sales', label: 'Sales & credit', icon: ShoppingCart },
    { href: '/expenses', label: 'Expenses', icon: Receipt },
    { href: '/review', label: 'Business review', icon: BookOpenCheck },
    { href: '/actions', label: 'Owner actions', icon: ClipboardList },
    { href: '/settings', label: 'Shop settings', icon: Settings },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="no-underline text-inherit"><Logo /></Link>
        <div className="nav-label">Your shop</div>
        <nav className="nav-list">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`nav-link ${location === item.href ? 'active' : ''}`}>
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">Manual local records only.<br /><span className="mono">Africa / Nairobi</span></div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="crumb">{data.business?.name || 'Your business'} <span style={{ margin: '0 8px', color: '#b3b5a8' }}>/</span> {title}</div>
          <div className="top-right">
            {activeBranches.length > 0 && (
              <label className="flex items-center gap-2">
                <MapPin size={14} />
                <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="bg-transparent border-0 text-xs outline-none max-w-[145px]">
                  {activeBranches.length > 1 && <option value="">All branches</option>}
                  {activeBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </label>
            )}
            <span className="top-date">{new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span>
            <button type="button" className="button ghost small" aria-label="Local mode">
              <LogOut size={13} /> <span className="hidden sm:inline">Local mode</span>
            </button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

function SetupPage() {
  const { data, setData, save } = useSupabaseAppData();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const branchName = String(form.get('branch') || '').trim();
    const location = String(form.get('location') || '').trim();

    if (!name || !branchName || !location) {
      setError('Add a business name, branch name and location to continue.');
      return;
    }

    const business: Business = {
      id: makeId(),
      name,
      currency: 'KES',
      openingDate: String(form.get('openingDate') || today()),
    };

    const branch: Branch = {
      id: makeId(),
      name: branchName,
      location,
      stockCountOwner: String(form.get('stockCountOwner') || '').trim(),
      cashReconciliationOwner: String(form.get('cashReconciliationOwner') || '').trim(),
      creditFollowUpOwner: String(form.get('creditFollowUpOwner') || '').trim(),
      dayCloseOwner: String(form.get('dayCloseOwner') || '').trim(),
      active: true,
    };

    const next: AppData = {
      business,
      branches: [branch],
      products: defaultProducts(),
      sales: [],
      expenses: [],
      actions: [],
      stockCounts: [],
      stockMovements: [],
    };

    setData(next);
    void save(next);
    setMessage('Shop setup complete. Start entering live-bird and sales records manually.');
    setError('');
  };

  if (data.business) {
    return (
      <Shell title="Shop setup">
        <PageHead title="Your shop is ready." description="The system is running in local manual mode with entries saved in this browser." />
        <Panel title={data.business.name}>
          <p className="subtitle">You can add more branches and products under Shop settings.</p>
          <Link href="/dashboard" className="button mt-5">Go to overview <ArrowRight size={15} /></Link>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell title="Shop setup">
      <PageHead title="First, your shop." description="Set up the business and the first branch in local-only mode." eyebrow="Welcome / Setup" />
      <div className="form-layout">
        <form className="panel form-card" onSubmit={submit} noValidate>
          <StatusNotice success={message} error={error} />
          <div className="form-grid">
            <div className="field full"><label>Business name</label><input name="name" required placeholder="e.g. Wanjiku Kienyeji" /></div>
            <div className="field"><label>Opening date</label><input type="date" name="openingDate" defaultValue={today()} /></div>
            <div />
            <div className="field"><label>First branch name</label><input name="branch" required placeholder="e.g. Githurai shop" /></div>
            <div className="field"><label>Town / location</label><input name="location" required placeholder="e.g. Githurai 45, Nairobi" /></div>
            <div className="field"><label>Stock count</label><input name="stockCountOwner" placeholder="Name or role" /></div>
            <div className="field"><label>Cash reconciliation</label><input name="cashReconciliationOwner" placeholder="Name or role" /></div>
            <div className="field"><label>Credit follow-up</label><input name="creditFollowUpOwner" placeholder="Name or role" /></div>
            <div className="field"><label>Day close</label><input name="dayCloseOwner" placeholder="Name or role" /></div>
          </div>
          <div className="form-actions">
            <button className="button" type="submit">Set up business <ArrowRight size={15} /></button>
          </div>
        </form>
        <aside className="panel panel-pad">
          <div className="empty-mark"><ShieldCheck size={20} /></div>
          <h2 className="section-title">Local-only operations</h2>
          <p className="subtitle mt-3" style={{ lineHeight: 1.7 }}>All records are stored in this browser and entered by hand. No API or external service is required.</p>
          <p className="mono text-xs mt-5" style={{ color: '#8b958d' }}>CURRENCY · KES<br />TIME ZONE · AFRICA/NAIROBI</p>
        </aside>
      </div>
    </Shell>
  );
}

function DashboardPage() {
  const { branchId } = useBranch();
  const { data } = useSupabaseAppData();
  const filteredSales = data.sales.filter((sale) => (branchId ? sale.branchId === branchId : true));
  const filteredExpenses = data.expenses.filter((expense) => (branchId ? expense.branchId === branchId : true));
  const totalRevenue = filteredSales.reduce((sum, item) => sum + item.total, 0);
  const totalCost = filteredSales.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);
  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const cashCollected = filteredSales.reduce((sum, item) => sum + item.paidAmount, 0);
  const amountDue = filteredSales.reduce((sum, item) => sum + item.amountDue, 0);
  const grossProfit = totalRevenue - totalCost;
  const netProfit = grossProfit - totalExpenses;

  const lowStock = data.products.filter((product) => {
    const branchList = data.branches.filter((branch) => (branchId ? branch.id === branchId : true));
    const qty = branchList.reduce((sum, branch) => sum + getInventoryForProduct(data, branch.id, product.id), 0);
    return qty <= product.lowStockThreshold;
  });

  return (
    <Shell title="Overview">
      <PageHead title="The day, at a glance." description="Manual figures for stock, sales, costs and close-of-day review." action={<Link href="/sales" className="button"><Plus size={15} /> Record a sale</Link>} />
      <div className="metric-grid">
        <Metric label="Sales revenue" value={money(totalRevenue)} foot="Manual sales ledger" icon={<Banknote size={14} />} />
        <Metric label="Gross profit" value={money(grossProfit)} foot="Revenue minus cost" icon={<CircleDollarSign size={14} />} />
        <Metric label="Cash collected" value={money(cashCollected)} foot={`${money(amountDue)} still on credit`} icon={<Wallet size={14} />} />
        <Metric label="Net profit" value={money(netProfit)} foot={`${money(totalExpenses)} operating costs`} icon={<Scale size={14} />} />
      </div>

      <div className="grid-two">
        <Panel title="Revenue rhythm" extra={<span className="pill">KES / day</span>}>
          <div className="chart-area" aria-label="Local sales chart">
            {[1, 2, 3, 4, 5, 6].map((index) => {
              const height = 18 + ((index * 15) % 75);
              return (
                <div className="chart-bar-wrap" key={index}>
                  <div className="chart-bar" style={{ height: `${height}%` }}></div>
                  <span className="chart-label">D{index}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Needs a closer look" extra={<span className="pill amber">{lowStock.length} low</span>}>
          {lowStock.length ? (
            <div className="activity-list">
              {lowStock.map((product) => (
                <div className="activity-row" key={product.id}>
                  <div className="activity-icon"><Package size={16} /></div>
                  <div className="activity-main">
                    <div className="activity-title">{product.name}</div>
                    <div className="activity-meta">Below target level</div>
                  </div>
                  <span className="amount">{product.lowStockThreshold} {product.unit}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={<CheckCircle2 size={18} />} title="Stock looks steady" body="No products are below their low-stock mark." />
          )}
        </Panel>
      </div>

      <div className="grid-two">
        <Panel title="Recent sales" extra={<Link href="/sales" className="text-xs text-[#50675a] no-underline">All sales <ArrowRight size={12} className="inline" /></Link>}>
          {filteredSales.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Receipt</th><th>Product</th><th>Paid</th><th>Due</th></tr></thead>
                <tbody>
                  {filteredSales.slice(0, 5).map((sale) => (
                    <tr key={sale.id}>
                      <td className="mono">{sale.receiptNumber}</td>
                      <td>{sale.productName}<div className="text-[10px] text-[#879188]">{sale.customerName || 'Walk-in'}</div></td>
                      <td>{money(sale.paidAmount)}</td>
                      <td>{sale.amountDue > 0 ? <span className="pill amber">{money(sale.amountDue)}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={<ShoppingCart size={18} />} title="No sales recorded yet" body="Your first sale will show up here." />
          )}
        </Panel>

        <Panel title="Expense snapshot" extra={<Link href="/expenses" className="text-xs text-[#50675a] no-underline">Open expenses <ArrowRight size={12} className="inline" /></Link>}>
          <div className="activity-list">
            <InfoRow icon={<Receipt size={16} />} label="Recorded costs" value={money(totalExpenses)} detail={`${filteredExpenses.length} expense entries`} />
            <InfoRow icon={<Wallet size={16} />} label="Still to pay" value={money(filteredExpenses.reduce((sum, item) => sum + item.amountDue, 0))} detail="Outstanding expense balance" />
          </div>
        </Panel>
      </div>
    </Shell>
  );
}

function StockPage() {
  const { branchId } = useBranch();
  const { data, setData, save } = useSupabaseAppData();
  const [mode, setMode] = useState<'receive' | 'loss' | 'count'>('receive');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const branchOptions = data.branches.filter((branch) => branch.active);
  const productOptions = data.products.filter((product) => product.active);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedBranch = String(form.get('branch') || branchId || branchOptions[0]?.id || '');
    const selectedProduct = String(form.get('product') || '');
    const quantity = Number(form.get('quantity') || 0);

    if (!selectedBranch || !selectedProduct || quantity <= 0) {
      setError('Choose a branch and product before saving.');
      return;
    }

    const movement: StockMovement = {
      id: makeId(),
      branchId: selectedBranch,
      productId: selectedProduct,
      kind: mode === 'receive' ? 'receive' : mode === 'loss' ? 'loss' : 'sale',
      quantity,
      reason: mode === 'receive' ? String(form.get('supplier') || 'Supplier delivery') : mode === 'loss' ? String(form.get('cause') || 'Stock loss') : 'Manual count adjustment',
      occurredAt: nowLocal(),
    };

    const next: AppData = {
      ...data,
      stockMovements: [...data.stockMovements, movement],
    };

    if (mode === 'count') {
      const product = data.products.find((item) => item.id === selectedProduct);
      const count: StockCount = {
        id: makeId(),
        branchId: selectedBranch,
        productId: selectedProduct,
        productName: product?.name || 'Product',
        expectedQuantity: getInventoryForProduct(data, selectedBranch, selectedProduct),
        countedQuantity: quantity,
        variance: quantity - getInventoryForProduct(data, selectedBranch, selectedProduct),
        countedAt: nowLocal(),
        notes: String(form.get('notes') || 'Manual count'),
      };
      next.stockCounts = [...data.stockCounts, count];
      setSuccess('Physical count recorded.');
    } else if (mode === 'loss') {
      setSuccess('Loss recorded.');
    } else {
      setSuccess('Stock receipt saved.');
    }

    setData(next);
    void save(next);
    setError('');
    event.currentTarget.reset();
  };

  return (
    <Shell title="Stock room">
      <PageHead title="Stock, accounted for." description="Manual receiving, losses and physical stock count records." eyebrow="Inventory / Branch record" />
      <div className="form-layout">
        <section className="panel form-card">
          <div className="tabs">
            {(['receive', 'loss', 'count'] as const).map((item) => (
              <button key={item} type="button" className={`tab ${mode === item ? 'active' : ''}`} onClick={() => setMode(item)}>
                {item === 'receive' ? 'Receive stock' : item === 'loss' ? 'Record loss' : 'Physical count'}
              </button>
            ))}
          </div>

          <StatusNotice success={success} error={error} />
          <form onSubmit={submit} noValidate>
            <div className="form-grid">
              <div className="field">
                <label>Branch</label>
                <select name="branch" defaultValue={branchId || branchOptions[0]?.id || ''} required>
                  {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Product</label>
                <select name="product" defaultValue="" required>
                  <option value="" disabled>Select product</option>
                  {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.unit}</option>)}
                </select>
              </div>

              {mode === 'receive' && (
                <div className="field">
                  <label>Supplier name</label>
                  <input name="supplier" placeholder="Supplier or farm name" required />
                </div>
              )}
              {mode === 'loss' && (
                <div className="field">
                  <label>Reason</label>
                  <select name="cause" defaultValue="">
                    <option value="">Choose a reason</option>
                    <option value="Spoilage">Spoilage</option>
                    <option value="Damage">Damage</option>
                    <option value="Mortality">Mortality</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}
              <div className="field">
                <label>{mode === 'count' ? 'Counted quantity' : 'Quantity'}</label>
                <input name="quantity" type="number" min="0.01" step="0.01" required />
              </div>
              <div className="field full">
                <label>Notes</label>
                <textarea name="notes" placeholder="Any detail worth keeping" />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="button">
                {mode === 'receive' ? 'Save stock receipt' : mode === 'loss' ? 'Record stock loss' : 'Save physical count'} <Check size={15} />
              </button>
            </div>
          </form>
        </section>

        <aside className="panel panel-pad">
          <div className="section-header"><h2 className="section-title">On hand now</h2><span className="pill">{data.products.length} products</span></div>
          <div className="activity-list">
            {data.products.filter((product) => product.active).map((product) => {
              const qty = data.branches.filter((branch) => branch.active).reduce((sum, branch) => sum + getInventoryForProduct(data, branch.id, product.id), 0);
              return (
                <div className="activity-row" key={product.id}>
                  <div className="activity-icon"><Egg size={16} /></div>
                  <div className="activity-main">
                    <div className="activity-title">{product.name}</div>
                    <div className="activity-meta">{product.unit}</div>
                  </div>
                  <span className="amount">{qty} {product.unit}</span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function SalesPage() {
  const { branchId } = useBranch();
  const { data, setData, save } = useSupabaseAppData();
  const [tab, setTab] = useState<'sale' | 'collection'>('sale');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const branchOptions = data.branches.filter((branch) => branch.active);
  const productOptions = data.products.filter((product) => product.active);
  const outstanding = data.sales.filter((sale) => sale.amountDue > 0);

  const saveSale = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const branch = String(form.get('branch') || branchId || branchOptions[0]?.id || '');
    const productId = String(form.get('product') || '');
    const quantity = Number(form.get('quantity') || 0);
    const unitPrice = Number(form.get('unitPrice') || 0);
    const costPerUnit = Number(form.get('costPerUnit') || 0);
    const discount = Number(form.get('discount') || 0);
    const paidAmount = Number(form.get('paidAmount') || 0);

    if (!branch || !productId || quantity <= 0 || unitPrice <= 0) {
      setError('Complete the branch, product, quantity and price before saving.');
      return;
    }

    const product = data.products.find((item) => item.id === productId);
    const total = quantity * unitPrice - discount;
    const sale: Sale = {
      id: makeId(),
      branchId: branch,
      productId,
      receiptNumber: `SALE-${Date.now()}`,
      productName: product?.name || 'Product',
      quantity,
      unitPrice,
      costPerUnit,
      discount,
      total,
      paidAmount,
      amountDue: Math.max(0, total - paidAmount),
      customerName: String(form.get('customer') || 'Walk-in'),
      paymentMethod: String(form.get('paymentMethod') || 'cash'),
      soldAt: nowLocal(),
      notes: String(form.get('notes') || ''),
    };

    const next: AppData = {
      ...data,
      sales: [sale, ...data.sales],
      stockMovements: [...data.stockMovements, { id: makeId(), branchId: branch, productId, kind: 'sale', quantity, reason: 'Customer sale', occurredAt: nowLocal() }],
    };

    setData(next);
    void save(next);
    setSuccess(`Sale saved. Receipt ${sale.receiptNumber}`);
    setError('');
    event.currentTarget.reset();
  };

  const saveCollection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saleId = String(form.get('sale') || '');
    const amount = Number(form.get('amount') || 0);

    if (!saleId || amount <= 0) {
      setError('Choose a valid sale and payment amount.');
      return;
    }

    const next: AppData = {
      ...data,
      sales: data.sales.map((sale) => {
        if (sale.id !== saleId) return sale;
        const newPaid = sale.paidAmount + amount;
        return { ...sale, paidAmount: newPaid, amountDue: Math.max(0, sale.total - newPaid) };
      }),
    };

    setData(next);
    void save(next);
    setSuccess('Customer payment recorded.');
    setError('');
    event.currentTarget.reset();
  };

  return (
    <Shell title="Sales & credit">
      <PageHead title="Sales, kept straight." description="Add sales manually and record customer payment against outstanding balances." eyebrow="Till / Sales ledger" />
      <div className="form-layout">
        <section className="panel form-card">
          <div className="tabs">
            <button type="button" className={`tab ${tab === 'sale' ? 'active' : ''}`} onClick={() => setTab('sale')}>New sale</button>
            <button type="button" className={`tab ${tab === 'collection' ? 'active' : ''}`} onClick={() => setTab('collection')}>Collect credit</button>
          </div>
          <StatusNotice success={success} error={error} />

          {tab === 'sale' ? (
            <form onSubmit={saveSale} noValidate>
              <div className="form-grid">
                <div className="field"><label>Branch</label><select name="branch" defaultValue={branchId || branchOptions[0]?.id || ''}>{branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
                <div className="field"><label>Product</label><select name="product" defaultValue=""><option value="" disabled>Select product</option>{productOptions.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.unit}</option>)}</select></div>
                <div className="field"><label>Quantity</label><input name="quantity" type="number" min="0.01" step="0.01" /></div>
                <div className="field"><label>Unit price (KES)</label><input name="unitPrice" type="number" min="0" step="0.01" /></div>
                <div className="field"><label>Cost per unit</label><input name="costPerUnit" type="number" min="0" step="0.01" defaultValue="0" /></div>
                <div className="field"><label>Discount (KES)</label><input name="discount" type="number" min="0" step="0.01" defaultValue="0" /></div>
                <div className="field"><label>Amount paid</label><input name="paidAmount" type="number" min="0" step="0.01" defaultValue="0" /></div>
                <div className="field"><label>Payment method</label><select name="paymentMethod" defaultValue="cash"><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option><option value="credit">Credit</option></select></div>
                <div className="field full"><label>Customer name</label><input name="customer" placeholder="Customer name" /></div>
                <div className="field full"><label>Notes</label><input name="notes" placeholder="Any detail worth keeping" /></div>
              </div>
              <div className="form-actions"><button className="button" type="submit">Save sale <Check size={15} /></button></div>
            </form>
          ) : (
            <form onSubmit={saveCollection} noValidate>
              <div className="form-grid">
                <div className="field full">
                  <label>Outstanding sale</label>
                  <select name="sale" defaultValue="">
                    <option value="" disabled>Select sale to collect</option>
                    {outstanding.map((sale) => (
                      <option key={sale.id} value={sale.id}>{sale.customerName} · {sale.receiptNumber} · {money(sale.amountDue)}</option>
                    ))}
                  </select>
                </div>
                <div className="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" /></div>
              </div>
              <div className="form-actions"><button className="button" type="submit">Record collection <Check size={15} /></button></div>
            </form>
          )}
        </section>

        <Panel title={tab === 'sale' ? 'Quick checks' : 'Credit outstanding'} extra={<span className="pill amber">{outstanding.length} balances</span>}>
          {tab === 'sale' ? (
            <>
              <InfoRow icon={<CircleDollarSign size={16} />} label="Payment choices" value="4 ways" detail="Cash · M-Pesa · bank · credit" />
              <div className="notice mt-4" style={{ background: '#f1eee3', color: '#68766d' }}>Sale totals are calculated from quantity × unit price minus any discount.</div>
            </>
          ) : outstanding.length ? (
            <div className="activity-list">
              {outstanding.slice(0, 5).map((sale) => (
                <div className="activity-row" key={sale.id}>
                  <div className="activity-icon"><Users size={16} /></div>
                  <div className="activity-main">
                    <div className="activity-title">{sale.customerName}</div>
                    <div className="activity-meta">{sale.receiptNumber}</div>
                  </div>
                  <span className="amount">{money(sale.amountDue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={<CheckCircle2 size={18} />} title="No credit to collect" body="Open balances will appear here." />
          )}
        </Panel>
      </div>

      <Panel title="Recent sales" extra={<span className="pill">{data.sales.length} records</span>} className="mt-4">
        {data.sales.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Receipt</th><th>Product</th><th>Qty</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead>
              <tbody>
                {data.sales.slice(0, 20).map((sale) => (
                  <tr key={sale.id}>
                    <td className="mono">{sale.receiptNumber}</td>
                    <td>{sale.productName}<div className="text-[10px] text-[#879188]">{sale.customerName}</div></td>
                    <td>{sale.quantity}</td>
                    <td>{money(sale.total)}</td>
                    <td>{money(sale.paidAmount)}</td>
                    <td>{sale.amountDue > 0 ? <span className="pill amber">{money(sale.amountDue)}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<ShoppingCart size={18} />} title="The sales ledger is empty" body="Record a sale to begin the day." />
        )}
      </Panel>
    </Shell>
  );
}

function ExpensesPage() {
  const { data, setData, save } = useSupabaseAppData();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const branchOptions = data.branches.filter((branch) => branch.active);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const branchId = String(form.get('branch') || branchOptions[0]?.id || '');
    const category = String(form.get('category') || '').trim();
    const amount = Number(form.get('amount') || 0);
    const paidAmount = Number(form.get('paidAmount') || 0);

    if (!branchId || !category || amount <= 0) {
      setError('Choose a branch and enter a valid expense amount.');
      return;
    }

    const expense: Expense = {
      id: makeId(),
      branchId,
      category,
      description: String(form.get('description') || ''),
      amount,
      paidAmount,
      amountDue: Math.max(0, amount - paidAmount),
      paymentMethod: String(form.get('paymentMethod') || 'cash'),
      expenseDate: String(form.get('expenseDate') || today()),
    };

    const next: AppData = { ...data, expenses: [expense, ...data.expenses] };
    setData(next);
    void save(next);
    setSuccess('Expense saved');
    setError('');
    event.currentTarget.reset();
  };

  const totals = data.expenses.reduce(
    (sum, item) => ({ amount: sum.amount + item.amount, due: sum.due + item.amountDue }),
    { amount: 0, due: 0 },
  );

  return (
    <Shell title="Expenses">
      <PageHead title="Costs, on the record." description="Manual expense entries for feed, transport, wages and operating costs." eyebrow="Operating costs / Daily record" />
      <div className="form-layout">
        <form className="panel form-card" onSubmit={submit} noValidate>
          <StatusNotice success={success} error={error} />
          <div className="form-grid">
            <div className="field"><label>Branch</label><select name="branch" defaultValue={branchOptions[0]?.id || ''}>{branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
            <div className="field"><label>Category</label><select name="category" defaultValue=""><option value="">Choose category</option><option>Feed</option><option>Transport</option><option>Utilities</option><option>Packaging</option><option>Salaries</option><option>Cleaning</option><option>Repairs</option><option>Other</option></select></div>
            <div className="field"><label>Total amount</label><input type="number" name="amount" min="0.01" step="0.01" required /></div>
            <div className="field"><label>Paid so far</label><input type="number" name="paidAmount" min="0" step="0.01" defaultValue="0" /></div>
            <div className="field"><label>Payment method</label><select name="paymentMethod" defaultValue="cash"><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option><option value="credit">Credit</option></select></div>
            <div className="field"><label>Date</label><input type="date" name="expenseDate" defaultValue={today()} /></div>
            <div className="field full"><label>Description</label><input name="description" placeholder="What was this cost for?" /></div>
          </div>
          <div className="form-actions"><button type="submit" className="button">Save expense <Check size={15} /></button></div>
        </form>

        <Panel title="Expense snapshot">
          <div className="activity-list">
            <InfoRow icon={<Receipt size={16} />} label="Recorded costs" value={money(totals.amount)} detail={`${data.expenses.length} expense entries`} />
            <InfoRow icon={<Wallet size={16} />} label="Still to pay" value={money(totals.due)} detail="Outstanding expense balance" />
          </div>
        </Panel>
      </div>

      <Panel title="Expense ledger" extra={<span className="pill">{data.expenses.length} records</span>} className="mt-4">
        {data.expenses.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead>
              <tbody>
                {data.expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{formatDate(expense.expenseDate)}</td>
                    <td>{expense.category}</td>
                    <td>{expense.description || '—'}</td>
                    <td>{money(expense.amount)}</td>
                    <td>{money(expense.paidAmount)}</td>
                    <td>{expense.amountDue > 0 ? <span className="pill amber">{money(expense.amountDue)}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<Receipt size={18} />} title="No operating costs recorded" body="Start with the next feed, transport or wage payment." />
        )}
      </Panel>
    </Shell>
  );
}

function ReviewPage() {
  const { data } = useSupabaseAppData();
  const salesTotal = data.sales.reduce((sum, item) => sum + item.total, 0);
  const expensesTotal = data.expenses.reduce((sum, item) => sum + item.amount, 0);
  const costTotal = data.sales.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);
  const margin = salesTotal > 0 ? ((salesTotal - costTotal) / salesTotal) * 100 : 0;

  return (
    <Shell title="Business review">
      <PageHead title="A better question than “how was business?”" description="Manual review from the recorded sales and expenses in the local ledger." eyebrow="Owner’s desk / Management review" />
      <Panel title="Executive summary">
        <div className="activity-list">
          <InfoRow icon={<Banknote size={16} />} label="Gross sales" value={money(salesTotal)} detail="All recorded sales" />
          <InfoRow icon={<Receipt size={16} />} label="Operating costs" value={money(expensesTotal)} detail="Expense ledger" />
          <InfoRow icon={<Scale size={16} />} label="Gross margin" value={`${margin.toFixed(1)}%`} detail="Calculated from price minus cost" />
          <InfoRow icon={<Activity size={16} />} label="Branch count" value={String(data.branches.filter((branch) => branch.active).length)} detail="Active branches" />
        </div>
      </Panel>
    </Shell>
  );
}

function ActionsPage() {
  const { data, setData, save } = useSupabaseAppData();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const owner = String(form.get('owner') || '').trim();
    const dueDate = String(form.get('dueDate') || '');
    const successMetric = String(form.get('metric') || '').trim();

    if (!title || !owner || !dueDate || !successMetric) {
      setError('Complete the action, owner, deadline and success measure.');
      return;
    }

    const newAction: ActionItem = {
      id: makeId(),
      title,
      owner,
      dueDate,
      successMetric,
      status: 'open',
    };

    const next: AppData = { ...data, actions: [newAction, ...data.actions] };
    setData(next);
    void save(next);
    setSuccess('Owner action added.');
    setError('');
    event.currentTarget.reset();
  };

  return (
    <Shell title="Owner actions">
      <PageHead title="Turn the review into action." description="Manual follow-up for what needs attention next." eyebrow="Follow-through / Owner’s list" />
      <div className="form-layout">
        <form className="panel form-card" onSubmit={submit} noValidate>
          <StatusNotice success={success} error={error} />
          <div className="form-grid">
            <div className="field full"><label>Action</label><input name="title" required placeholder="e.g. Confirm a second supplier price" /></div>
            <div className="field"><label>Owner</label><input name="owner" required placeholder="Who will take this forward?" /></div>
            <div className="field"><label>Due date</label><input type="date" name="dueDate" min={today()} required /></div>
            <div className="field full"><label>Success measure</label><input name="metric" required placeholder="What will be different when it is done?" /></div>
          </div>
          <div className="form-actions"><button className="button" type="submit">Add owner action <Plus size={15} /></button></div>
        </form>

        <Panel title="The owner’s list" extra={<span className="pill">{data.actions.length} actions</span>}>
          {data.actions.length ? (
            <div className="activity-list">
              {data.actions.map((action) => (
                <div className="activity-row" key={action.id}>
                  <div className="activity-icon"><ClipboardList size={16} /></div>
                  <div className="activity-main">
                    <div className="activity-title">{action.title}</div>
                    <div className="activity-meta">Owner: {action.owner} · Due {formatDate(action.dueDate)} · Success: {action.successMetric}</div>
                  </div>
                  <select value={action.status} onChange={(event) => {
                    const next: AppData = { ...data, actions: data.actions.map((item) => item.id === action.id ? { ...item, status: event.target.value as ActionItem['status'] } : item) };
                    setData(next);
                    void save(next);
                  }} className="pill">
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="complete">Complete</option>
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={<ClipboardList size={18} />} title="Nothing on the owner’s list" body="Add one practical action to keep progress visible." />
          )}
        </Panel>
      </div>
    </Shell>
  );
}

function SettingsPage() {
  const { data, setData, save } = useSupabaseAppData();
  const [tab, setTab] = useState<'branches' | 'products'>('branches');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const addBranch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const location = String(form.get('location') || '').trim();
    if (!name || !location) {
      setError('Branch name and location are required.');
      return;
    }

    const branch: Branch = {
      id: makeId(),
      name,
      location,
      stockCountOwner: String(form.get('stockCountOwner') || '').trim(),
      cashReconciliationOwner: String(form.get('cashReconciliationOwner') || '').trim(),
      creditFollowUpOwner: String(form.get('creditFollowUpOwner') || '').trim(),
      dayCloseOwner: String(form.get('dayCloseOwner') || '').trim(),
      active: true,
    };

    const next: AppData = { ...data, branches: [...data.branches, branch] };
    setData(next);
    void save(next);
    setSuccess('Branch added.');
    setError('');
    event.currentTarget.reset();
  };

  const addProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const unit = String(form.get('unit') || '').trim();
    const threshold = Number(form.get('threshold') || 0);
    if (!name || !unit || threshold < 0) {
      setError('Product name, unit and a valid threshold are required.');
      return;
    }

    const product: Product = { id: makeId(), name, unit, lowStockThreshold: threshold, active: true };
    const next: AppData = { ...data, products: [...data.products, product] };
    setData(next);
    void save(next);
    setSuccess('Product added.');
    setError('');
    event.currentTarget.reset();
  };

  return (
    <Shell title="Shop settings">
      <PageHead title="Set the shop up your way." description="Manage branches and products without any external service." eyebrow="Configuration / Business details" />
      <div className="tabs">
        <button type="button" className={`tab ${tab === 'branches' ? 'active' : ''}`} onClick={() => setTab('branches')}>Branches</button>
        <button type="button" className={`tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>Products</button>
      </div>
      <StatusNotice success={success} error={error} />

      <div className="form-layout">
        {tab === 'branches' ? (
          <form className="panel form-card" onSubmit={addBranch} noValidate>
            <div className="section-header"><h2 className="section-title">Add a branch</h2></div>
            <div className="form-grid">
              <div className="field"><label>Branch name</label><input name="name" required placeholder="e.g. Umoja branch" /></div>
              <div className="field"><label>Town / location</label><input name="location" required placeholder="e.g. Umoja Innercore" /></div>
              <div className="field"><label>Stock count</label><input name="stockCountOwner" placeholder="Name or role" /></div>
              <div className="field"><label>Cash reconciliation</label><input name="cashReconciliationOwner" placeholder="Name or role" /></div>
              <div className="field"><label>Credit follow-up</label><input name="creditFollowUpOwner" placeholder="Name or role" /></div>
              <div className="field"><label>Day close</label><input name="dayCloseOwner" placeholder="Name or role" /></div>
            </div>
            <div className="form-actions"><button type="submit" className="button">Add branch <Plus size={15} /></button></div>
          </form>
        ) : (
          <form className="panel form-card" onSubmit={addProduct} noValidate>
            <div className="section-header"><h2 className="section-title">Add a product</h2></div>
            <div className="form-grid">
              <div className="field"><label>Product name</label><input name="name" required placeholder="e.g. Mature kienyeji" /></div>
              <div className="field"><label>Unit</label><select name="unit" defaultValue="bird"><option value="bird">Bird</option><option value="kg">Kilogram (kg)</option><option value="piece">Piece</option><option value="tray">Tray</option></select></div>
              <div className="field"><label>Low-stock mark</label><input name="threshold" type="number" min="0" step="0.01" defaultValue="5" required /></div>
            </div>
            <div className="form-actions"><button type="submit" className="button">Add product <Plus size={15} /></button></div>
          </form>
        )}

        <Panel title={tab === 'branches' ? 'Branches' : 'Products'} extra={<span className="pill">{tab === 'branches' ? data.branches.length : data.products.length}</span>}>
          {tab === 'branches' ? (
            data.branches.length ? (
              <div className="activity-list">
                {data.branches.map((branch) => (
                  <div className="activity-row block" key={branch.id}>
                    <div className="flex items-start gap-3">
                      <div className="activity-icon"><Store size={16} /></div>
                      <div className="activity-main">
                        <div className="activity-title">{branch.name}</div>
                        <div className="activity-meta">{branch.location}</div>
                      </div>
                      <span className={`pill ${branch.active ? 'green' : 'red'}`}>{branch.active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon={<Store size={18} />} title="No branches set up" body="Add your first branch to begin operations." />
            )
          ) : (
            data.products.length ? (
              <div className="activity-list">
                {data.products.map((product) => (
                  <div className="activity-row" key={product.id}>
                    <div className="activity-icon"><Egg size={16} /></div>
                    <div className="activity-main">
                      <div className="activity-title">{product.name}</div>
                      <div className="activity-meta">{product.unit} · low stock {product.lowStockThreshold}</div>
                    </div>
                    <span className="amount">{product.active ? 'Active' : 'Inactive'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon={<Egg size={18} />} title="No products yet" body="Add the items your shop sells." />
            )
          )}
        </Panel>
      </div>
    </Shell>
  );
}

function AppRoutes() {
  const [branchId, setBranchId] = useState('');
  const { data } = useSupabaseAppData();
  const business = data.business;
  return (
    <BranchContext.Provider value={{ branchId, setBranchId }}>
      <Switch>
        <Route path="/" component={business ? DashboardPage : SetupPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/stock" component={StockPage} />
        <Route path="/sales" component={SalesPage} />
        <Route path="/expenses" component={ExpensesPage} />
        <Route path="/review" component={ReviewPage} />
        <Route path="/actions" component={ActionsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </BranchContext.Provider>
  );
}

function App() {
  return (
    <WouterRouter>
      <AppRoutes />
    </WouterRouter>
  );
}

export default App;
