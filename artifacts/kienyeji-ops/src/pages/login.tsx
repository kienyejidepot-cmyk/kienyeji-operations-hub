import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { api, setAuthToken } from "@/lib/api";
import { Lock, User, UserPlus, Building2, Calendar, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Step 1: personal
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // Step 2: business
  const [regBusinessName, setRegBusinessName] = useState("");
  const [regTradingName, setRegTradingName] = useState("");
  const [regTaxPin, setRegTaxPin] = useState("");
  const [regRegistrationNumber, setRegRegistrationNumber] = useState("");
  const [regVatRegistered, setRegVatRegistered] = useState(false);
  const [regOpeningDate, setRegOpeningDate] = useState("");

  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegLoading(true);
    try {
      if (regPassword !== regConfirmPassword) {
        setRegError("Passwords do not match.");
        return;
      }
      const data = await api.register({
        email: regEmail,
        password: regPassword,
        fullName: regFullName,
        phone: regPhone || undefined,
        businessName: regBusinessName,
        tradingName: regTradingName || undefined,
        taxPin: regTaxPin || undefined,
        registrationNumber: regRegistrationNumber || undefined,
        vatRegistered: regVatRegistered,
        openingDate: regOpeningDate || undefined,
      });
      setAuthToken(data.token);
      setLocation("/dashboard");
    } catch (err: any) {
      setRegError(err.message || "Registration failed. Please try again.");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="flex flex-col items-center text-center">
          {mode === "login" ? (
            <>
              <CardTitle className="flex items-center gap-2 justify-center">
                <Lock className="h-5 w-5" /> Kienyeji ShopOS
              </CardTitle>
              <CardDescription>Sign in to your slaughter shop management system.</CardDescription>
            </>
          ) : (
            <>
              <CardTitle className="flex items-center gap-2 justify-center">
                <UserPlus className="h-5 w-5" /> Create Account
              </CardTitle>
              <CardDescription>
                Set up your kienyeji slaughter shop — real business, not sample data.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <>
              {error && (
                <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm border border-red-100">
                  {error}
                </div>
              )}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="owner@kienyeji.shop"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </>
          ) : (
            <>
              {regError && (
                <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm border border-red-100">
                  {regError}
                </div>
              )}
              {regStep === 1 ? (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="owner@kienyeji.shop"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      placeholder="+254 700 000 000"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="At least 8 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password</Label>
                    <Input
                      type="password"
                      placeholder="Repeat your password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="button" onClick={() => setRegStep(2)} className="w-full">
                    Continue to Business Setup
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input
                      placeholder="Kienyeji Slaughter Shop"
                      value={regBusinessName}
                      onChange={(e) => setRegBusinessName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Trading Name (optional)</Label>
                    <Input
                      placeholder="Kienyeji Depot"
                      value={regTradingName}
                      onChange={(e) => setRegTradingName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax PIN (optional)</Label>
                    <Input placeholder="P000000000X" value={regTaxPin} onChange={(e) => setRegTaxPin(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Registration Number (optional)</Label>
                    <Input placeholder="REG-001" value={regRegistrationNumber} onChange={(e) => setRegRegistrationNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Checkbox
                      checked={regVatRegistered}
                      onCheckedChange={(checked) => setRegVatRegistered(checked === true)}
                    >
                      VAT Registered
                    </Checkbox>
                  </div>
                  <div className="space-y-2">
                    <Label>Opening Date</Label>
                    <Input type="date" value={regOpeningDate} onChange={(e) => setRegOpeningDate(e.target.value)} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Button type="button" variant="outline" onClick={() => setRegStep(1)}>
                      Back
                    </Button>
                    <Button type="submit" className="w-1/3" disabled={regLoading}>
                      {regLoading ? "Creating..." : "Create Shop & Account"}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="flex items-center space-x-2 text-sm">
          {mode === "login" ? (
            <>
              <User className="h-4 w-4" />
              <span className="text-slate-500">Demo: owner@sample-kienyeji.demo / changeme123</span>
            </>
          ) : (
            <span className="text-slate-600">Already have an account?</span>
          )}
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setRegError("");
            }}
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
