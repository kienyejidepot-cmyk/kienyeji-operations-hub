import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote, Egg, Package, Receipt, Scale, ShoppingCart, Users, Wallet } from "lucide-react";

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listChartOfAccounts().catch(() => []);
    setLoading(false);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
          <p className="text-slate-500">
            Kienyeji slaughter shop management system
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission("sales.create") && (
            <Button>Record Sale</Button>
          )}
          {hasPermission("purchases.create") && (
            <Button>Record Purchase</Button>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4" /> Cash on Hand
            </CardTitle>
            <CardDescription>Physical cash in till</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">KES 0.00</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Dressed Stock
            </CardTitle>
            <CardDescription>Kilograms on hand</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0 kg</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-4 w-4" /> Gross Margin
            </CardTitle>
            <CardDescription>Net sales &minus; COGS</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0.0%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Connected to API. Authentication active for{" "}
              <strong>{user?.fullName || "user"}</strong> ({user?.roles.join(", ") || "no roles"}).
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>Add suppliers under Settings &rarr; Suppliers</li>
              <li>Add customers under Settings &rarr; Customers</li>
              <li>Review chart of accounts under Settings &rarr; Chart of Accounts</li>
              <li>Record your first sale or purchase</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
