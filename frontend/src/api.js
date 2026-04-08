const API_URL = "http://localhost:4000/api";


export function setToken(token) {
  localStorage.setItem("token", token);
}

export function getToken() {
  return localStorage.getItem("token");
}

export function clearToken() {
  localStorage.removeItem("token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

export const api = {
  login: ({ email, password }) =>
  request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }),

  // products
  listProducts: () => request("/products"),
  createProduct: (p) => request("/products", { method: "POST", body: JSON.stringify(p) }),
  updateProduct: (id, p) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(p) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),

  // clients
    // clients
  listClients: () => request("/clients"),
  createClient: (c) => request("/clients", { method: "POST", body: JSON.stringify(c) }),
  updateClient: (id, c) => request(`/clients/${id}`, { method: "PUT", body: JSON.stringify(c) }),
  deleteClient: (id) => request(`/clients/${id}`, { method: "DELETE" }),

  // sales
  createSale: (sale) => request("/sales", { method: "POST", body: JSON.stringify(sale) }),
  listSales: () => request("/sales"),

  // reports
  dailyReport: (date) => request(`/reports/daily?date=${encodeURIComponent(date)}`),
  monthlyReport: (year, month) => request(`/reports/monthly?year=${year}&month=${month}`),
  byAddressReport: (year, month) =>
  request(`/reports/by-address?year=${year}&month=${month}`),

  // company
getCompany: () => request("/company"),
saveCompany: (data) => request("/company", { method: "POST", body: JSON.stringify(data) }),

/* admins */
registerAdmin: (data) =>
  request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
};
