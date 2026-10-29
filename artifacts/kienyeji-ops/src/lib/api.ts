const API_BASE = import.meta.env.VITE_API_URL || "/api";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

async function json<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await request(path, options);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    json<{ user: any; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (body: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    businessName: string;
    tradingName?: string;
    taxPin?: string;
    registrationNumber?: string;
    vatRegistered?: boolean;
    openingDate?: string;
  }) =>
    json<{ user: any; business: any; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => json("/auth/logout", { method: "POST" }),
  me: () => json<{ user: any }>("/auth/me"),

  // Users
  listUsers: () => json<any[]>("/users"),
  createUser: (body: any) => json("/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: any) =>
    json(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Roles
  listRoles: () => json<any[]>("/roles"),
  createRole: (body: any) =>
    json("/roles", { method: "POST", body: JSON.stringify(body) }),

  // Chart of accounts
  listChartOfAccounts: () => json<any[]>("/chart-of-accounts"),
  createChartOfAccount: (body: any) =>
    json("/chart-of-accounts", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Tax codes
  listTaxCodes: () => json<any[]>("/tax-codes"),
  createTaxCode: (body: any) =>
    json("/tax-codes", { method: "POST", body: JSON.stringify(body) }),

  // Suppliers
  listSuppliers: () => json<any[]>("/suppliers"),
  createSupplier: (body: any) =>
    json("/suppliers", { method: "POST", body: JSON.stringify(body) }),

  // Customers
  listCustomers: () => json<any[]>("/customers"),
  createCustomer: (body: any) =>
    json("/customers", { method: "POST", body: JSON.stringify(body) }),
};
