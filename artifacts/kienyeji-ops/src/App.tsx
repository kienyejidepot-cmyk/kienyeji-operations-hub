import { useState } from "react";
import { Link, Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { setAuthToken } from "@/lib/api";
import { LayoutDashboard, LogOut, Package, Receipt, ShoppingCart, Settings, Store, Users, Wallet, Shield, BarChart3, Egg, Banknote } from "lucide-react";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import SettingsPage from "@/pages/settings";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

type NavItem = {
  href: string;
  label: string;
  icon: any;
  permission?: string;
};

function NavLink({ item, location }: { item: NavItem; location: string }) {
  const { user, logout, hasPermission } = useAuth();
  const canSee = !item.permission || hasPermission(item.permission);
  if (!canSee) return null;
  const Icon = item.icon;
  const active = location === item.href;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
        active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <Icon size={16} />
      <span>{item.label}</span>
    </Link>
  );
}

function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const nav: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/sales", label: "Sales", icon: ShoppingCart, permission: "sales.create" },
    { href: "/purchases", label: "Purchases", icon: Package, permission: "purchases.create" },
    { href: "/slaughter", label: "Slaughter Batches", icon: Egg, permission: "slaughter.create" },
    { href: "/inventory", label: "Inventory", icon: Package, permission: "inventory.view" },
    { href: "/expenses", label: "Expenses", icon: Receipt, permission: "expenses.create" },
    { href: "/customers", label: "Customers & Debts", icon: Users, permission: "customers.view" },
    { href: "/suppliers", label: "Suppliers & Payables", icon: Store, permission: "suppliers.view" },
    { href: "/cashbook", label: "Cashbook & Reconciliation", icon: Wallet, permission: "cashbook.view" },
    { href: "/accounting", label: "Accounting", icon: BarChart3, permission: "accounting.view_reports" },
    { href: "/reports", label: "Reports & Analytics", icon: Shield },
    { href: "/staff", label: "Staff & Payroll", icon: Users, permission: "payroll.view" },
    { href: "/compliance", label: "Compliance", icon: Shield },
    { href: "/growth", label: "Growth Planner", icon: Shield },
    { href: "/settings", label: "Settings & Audit Logs", icon: Settings, permission: "settings.manage" },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="hidden md:flex md:flex-col md:w-64 border-r border-slate-200 bg-white">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Store size={24} /> <span>Kienyeji ShopOS</span>
          </Link>
          <p className="text-xs text-slate-500 mt-1">KES &bull; Africa/Nairobi</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} location={location} />
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <Button onClick={() => logout()} className="w-full text-sm">
            <LogOut size={14} /> Sign out
          </Button>
          <p className="text-xs text-slate-500 mt-2">{user?.fullName}</p>
          <p className="text-xs text-slate-500">{user?.roles.join(", ")}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden p-2 text-slate-600"
              aria-label="Menu"
            >
            </button>
            <span className="text-lg font-semibold text-slate-900">{title}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 hidden sm:block">
              {new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", weekday: "short", day: "numeric", month: "short" }).format(new Date())}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={(e) => e.stopPropagation()} />
          <div className="relative w-full max-w-xs bg-white shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Menu</h3>
              <button onClick={() => setOpen(false)} className="p-2 text-slate-500" />
            </div>
            <nav className="py-2 space-y-1 px-4">
              {nav.map((item) => (
                <NavLink key={item.href} item={item} location={location} />
              ))}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <Button onClick={() => { setOpen(false); logout(); }} className="w-full text-sm">
                <LogOut size={14} /> Sign out
              </Button>
            </div>
          </div>
        </div>
        )}
      </div>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center">{children}</div>;
}

export default function AppRoutes() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <PublicShell>
        <LoginPage />
      </PublicShell>
    );
  }

  return (
    <WouterRouter>
      <AppShell title="Kienyeji ShopOS">
        <Switch>
          <Route path="/dashboard" component={DashboardPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/" component={DashboardPage} />
        </Switch>
      </AppShell>
    </WouterRouter>
  );
}
