import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  api,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Decimal from "decimal.js";
import { ArrowRight, Plus, Settings, Users as UsersIcon, Building2, Landmark, PiggyBank, Shield, BarChart3 } from "lucide-react";
import { money } from "@/lib/utils";

const accountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  normalBalance: z.enum(["debit", "credit"]),
  parentId: z.string().optional(),
  isPostable: z.boolean().default(true),
  description: z.string().optional(),
});

const supplierSchema = z.object({
  name: z.string().min(1),
  supplierType: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  taxPin: z.string().optional(),
  supplierType2: z.string().optional(),
  location: z.string().optional(),
  paymentTermsDays: z.string().default("0"),
  creditLimit: z.string().default("0"),
  notes: z.string().optional(),
});

const customerSchema = z.object({
  name: z.string().min(1),
  customerType: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  taxPin: z.string().optional(),
  location: z.string().optional(),
  creditLimit: z.string().default("0"),
  creditTermsDays: z.string().default("0"),
  isCreditAllowed: z.boolean().default(false),
  notes: z.string().optional(),
});

const taxCodeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  type: z.string().min(1),
  rate: z.string().regex(/^\d+(\.\d{1,4})?$/),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

function moneyParse(v: string) {
  return new Decimal(v).toFixed(2);
}

export default function SettingsPage() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState("chartOfAccounts");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [taxCodes, setTaxCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { code: "", name: "", type: "expense", normalBalance: "debit", isPostable: true },
  });

  const supplierForm = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", supplierType: "farmer", paymentTermsDays: "0", creditLimit: "0" },
  });

  const customerForm = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", customerType: "retail", creditLimit: "0", creditTermsDays: "0", isCreditAllowed: false },
  });

  const taxForm = useForm<z.infer<typeof taxCodeSchema>>({
    resolver: zodResolver(taxCodeSchema),
    defaultValues: { code: "", name: "", type: "output_vat", rate: "0.0000", isActive: true },
  });

  const loadData = async () => {
    const [a, s, c, t] = await Promise.all([
      api.listChartOfAccounts().catch(() => []),
      api.listSuppliers().catch(() => []),
      api.listCustomers().catch(() => []),
      api.listTaxCodes().catch(() => []),
    ]);
    setAccounts(a);
    setSuppliers(s);
    setCustomers(c);
    setTaxCodes(t);
    setLoading(false);
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAccount = async (values: z.infer<typeof accountSchema>) => {
    try {
      await api.createChartOfAccount(values);
      form.reset();
      const updated = await api.listChartOfAccounts().catch(() => [] as any[]);
      setAccounts(updated);
    } catch (err: any) {
      alert(err.message || "Failed to create account");
    }
  };

  const handleCreateSupplier = async (values: z.infer<typeof supplierSchema>) => {
    try {
      await api.createSupplier({
        ...values,
        paymentTermsDays: values.paymentTermsDays,
        creditLimit: values.creditLimit,
      });
      supplierForm.reset();
      const updated = await api.listSuppliers().catch(() => [] as any[]);
      setSuppliers(updated);
    } catch (err: any) {
      alert(err.message || "Failed to create supplier");
    }
  };

  const handleCreateCustomer = async (values: z.infer<typeof customerSchema>) => {
    try {
      await api.createCustomer({
        ...values,
        creditLimit: values.creditLimit,
        creditTermsDays: values.creditTermsDays,
        isCreditAllowed: values.isCreditAllowed,
      });
      customerForm.reset();
      const updated = await api.listCustomers().catch(() => [] as any[]);
      setCustomers(updated);
    } catch (err: any) {
      alert(err.message || "Failed to create customer");
    }
  };

  const handleCreateTaxCode = async (values: z.infer<typeof taxCodeSchema>) => {
    try {
      await api.createTaxCode(values);
      taxForm.reset();
      const updated = await api.listTaxCodes().catch(() => [] as any[]);
      setTaxCodes(updated);
    } catch (err: any) {
      alert(err.message || "Failed to create tax code");
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  const canManage = hasPermission("settings.manage");
  const canViewReports = hasPermission("accounting.view_reports");

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shop Settings</h1>
          <p className="text-slate-500">
            Configure your kienyeji slaughter shop. Sample data is clearly marked &mdash; replace with live data before production use.
          </p>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="chartOfAccounts" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chartOfAccounts" className="flex flex-col items-center gap-2 px-3 py-2 text-sm">
            <PiggyBank className="h-5 w-5" /> Chart of Accounts
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex flex-col items-center gap-2 px-3 py-2 text-sm">
            <Building2 className="h-5 w-5" /> Suppliers
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex flex-col items-center gap-2 px-3 py-2 text-sm">
            <UsersIcon className="h-5 w-5" /> Customers
          </TabsTrigger>
          <TabsTrigger value="taxCodes" className="flex flex-col items-center gap-2 px-3 py-2 text-sm">
            <BarChart3 className="h-5 w-5" /> Tax Codes
          </TabsTrigger>
        </TabsList>

        {activeTab === "chartOfAccounts" && (
          <TabsContent value="chartOfAccounts" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Account</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={form.handleSubmit(handleCreateAccount)}>
                      <Form {...form}>
                        <FormField
                          control={form.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Code</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Name</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <select className="border rounded px-2 py-1 text-sm" {...field}>
                                <option value="asset">Asset</option>
                                <option value="liability">Liability</option>
                                <option value="equity">Equity</option>
                                <option value="revenue">Revenue</option>
                                <option value="expense">Expense</option>
                              </select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="normalBalance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Normal Balance</FormLabel>
                              <select className="border rounded px-2 py-1 text-sm" {...field}>
                                <option value="debit">Debit</option>
                                <option value="credit">Credit</option>
                              </select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <textarea className="border rounded px-2 py-1 text-sm" {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={!hasPermission("accounting.manage_chart")}>
                          Add Account
                        </Button>
                      </Form>
                    </form>
                  </CardContent>
                </Card>
              </div>
              <div className="md:col-span-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Chart of Accounts</CardTitle>
                    <CardDescription>
                      Value stock at cost, not selling price. Double-entry source of truth.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableCell>Code</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Normal Balance</TableCell>
                          <TableCell>Postable</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono text-xs">{a.code}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>{a.type}</TableCell>
                            <TableCell>{a.normalBalance}</TableCell>
                            <TableCell>{a.isPostable ? "Yes" : "No"}</TableCell>
                          </TableRow>
                        ))}
                        {accounts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-slate-400 text-sm">
                              No accounts yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}

        {activeTab === "suppliers" && (
          <TabsContent value="suppliers" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Supplier</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={supplierForm.handleSubmit(handleCreateSupplier)}>
                      <Form {...supplierForm}>
                        <FormField
                          control={supplierForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Supplier Name</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={supplierForm.control}
                          name="supplierType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Supplier Type</FormLabel>
                              <select className="border rounded px-2 py-1 text-sm" {...field}>
                                <option value="farmer">Farmer</option>
                                <option value="broker">Broker</option>
                                <option value="transporter">Transporter</option>
                                <option value="feed">Feed Supplier</option>
                                <option value="packaging">Packaging Supplier</option>
                                <option value="other">Other</option>
                              </select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={supplierForm.control}
                          name="contactPerson"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Person</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={supplierForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={supplierForm.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={supplierForm.control}
                          name="paymentTermsDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Terms (Days)</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={supplierForm.control}
                          name="creditLimit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Credit Limit (KES)</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={!hasPermission("suppliers.manage")}>
                          Add Supplier
                        </Button>
                      </Form>
                    </form>
                  </CardContent>
                </Card>
              </div>
              <div className="md:col-span-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Suppliers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Contact</TableCell>
                          <TableCell>Location</TableCell>
                          <TableCell>Credit Limit</TableCell>
                          <TableCell>Terms</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suppliers.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>{s.name}</TableCell>
                            <TableCell>{s.supplierType}</TableCell>
                            <TableCell>{s.contactPerson || "\u2014"}</TableCell>
                            <TableCell>{s.location || "\u2014"}</TableCell>
                            <TableCell>{money(s.creditLimit)}</TableCell>
                            <TableCell>{s.paymentTermsDays} days</TableCell>
                          </TableRow>
                        ))}
                        {suppliers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-slate-400 text-sm">
                              No suppliers yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}

        {activeTab === "customers" && (
          <TabsContent value="customers" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Customer</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={customerForm.handleSubmit(handleCreateCustomer)}>
                      <Form {...customerForm}>
                        <FormField
                          control={customerForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Customer Name</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={customerForm.control}
                          name="customerType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Customer Type</FormLabel>
                              <select className="border rounded px-2 py-1 text-sm" {...field}>
                                <option value="retail">Retail</option>
                                <option value="wholesale">Wholesale</option>
                                <option value="hotel">Hotel</option>
                                <option value="restaurant">Restaurant</option>
                                <option value="market_trader">Market Trader</option>
                              </select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={customerForm.control}
                          name="contactPerson"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Person</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={customerForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={customerForm.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={customerForm.control}
                          name="creditLimit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Credit Limit (KES)</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={customerForm.control}
                          name="creditTermsDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Credit Terms (Days)</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={customerForm.control}
                          name="isCreditAllowed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Allow Credit</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={!hasPermission("customers.manage")}>
                          Add Customer
                        </Button>
                      </Form>
                    </form>
                  </CardContent>
                </Card>
              </div>
              <div className="md:col-span-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Customers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Contact</TableCell>
                          <TableCell>Credit Limit</TableCell>
                          <TableCell>Terms</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.name}</TableCell>
                            <TableCell>{c.customerType}</TableCell>
                            <TableCell>{c.contactPerson || "\u2014"}</TableCell>
                            <TableCell>{money(c.creditLimit)}</TableCell>
                            <TableCell>{c.paymentTermsDays} days</TableCell>
                          </TableRow>
                        ))}
                        {customers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-slate-400 text-sm">
                              No customers yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}

        {activeTab === "taxCodes" && (
          <TabsContent value="taxCodes" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Tax Code</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={taxForm.handleSubmit(handleCreateTaxCode)}>
                      <Form {...taxForm}>
                        <FormField
                          control={taxForm.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tax Code</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={taxForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tax Name</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={taxForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <select className="border rounded px-2 py-1 text-sm" {...field}>
                                <option value="output_vat">Output VAT</option>
                                <option value="withholding">Withholding Tax</option>
                                <option value="none">None</option>
                              </select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={taxForm.control}
                          name="rate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rate (decimal, e.g. 0.1600)</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={!hasPermission("accounting.manage_chart")}>
                          Add Tax Code
                        </Button>
                      </Form>
                    </form>
                  </CardContent>
                </Card>
              </div>
              <div className="md:col-span-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Tax Codes</CardTitle>
                    <CardDescription>
                      Configurable per Kenyan tax rules. VAT default is 16%.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableCell>Code</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Rate</TableCell>
                          <TableCell>Active</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taxCodes.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell>{t.code}</TableCell>
                            <TableCell>{t.name}</TableCell>
                            <TableCell>{t.type}</TableCell>
                            <TableCell>{Number(t.rate).toFixed(4)}</TableCell>
                            <TableCell>{t.isActive ? "Yes" : "No"}</TableCell>
                          </TableRow>
                        ))}
                        {taxCodes.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-slate-400 text-sm">
                              No tax codes yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
