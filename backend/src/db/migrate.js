import { db } from "./sqlite.js";

export function migrate() {
  // 1) Core tables
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      purchase_price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      client_id INTEGER,
      sale_date TEXT NOT NULL DEFAULT (datetime('now')),
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );

    -- One row per tenant
    CREATE TABLE IF NOT EXISTS company_settings (
      tenant_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      rut TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
  `);

  // 2) If DB existed before: add tenant_id columns safely + backfill
  // SQLite doesn't support ADD COLUMN IF NOT EXISTS, so use PRAGMA checks.

  // Ensure at least one tenant exists for legacy data
  const tenantCount = db.prepare("SELECT COUNT(1) AS c FROM tenants").get()?.c || 0;
  if (Number(tenantCount) === 0) {
    db.prepare("INSERT INTO tenants DEFAULT VALUES").run();
  }
  const defaultTenantId =
    db.prepare("SELECT id FROM tenants ORDER BY id ASC LIMIT 1").get()?.id || 1;

  function ensureColumn(table, colDef, colName = "tenant_id") {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const has = cols.some((c) => c.name === colName);
    if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef};`);
  }

  ensureColumn("products", "tenant_id INTEGER NOT NULL DEFAULT 1");
  ensureColumn("clients", "tenant_id INTEGER NOT NULL DEFAULT 1");
  ensureColumn("sales", "tenant_id INTEGER NOT NULL DEFAULT 1");
  ensureColumn("sale_items", "tenant_id INTEGER NOT NULL DEFAULT 1");

  // admins table existed previously without tenant_id; if so, add and backfill
  ensureColumn("admins", "tenant_id INTEGER NOT NULL DEFAULT 1");

  // Backfill any NULLs (paranoia)
  db.prepare("UPDATE admins SET tenant_id = ? WHERE tenant_id IS NULL").run(defaultTenantId);
  db.prepare("UPDATE products SET tenant_id = ? WHERE tenant_id IS NULL").run(defaultTenantId);
  db.prepare("UPDATE clients SET tenant_id = ? WHERE tenant_id IS NULL").run(defaultTenantId);
  db.prepare("UPDATE sales SET tenant_id = ? WHERE tenant_id IS NULL").run(defaultTenantId);
  db.prepare("UPDATE sale_items SET tenant_id = ? WHERE tenant_id IS NULL").run(defaultTenantId);

  // If you had the old company_settings(id=1) table, keep it or migrate manually.
  // Easiest approach: if there's legacy row (id=1), copy it to default tenant if company_settings is empty.
  // Note: old schema had company_settings(id=1...). New schema uses tenant_id PK.
  const companyCols = db.prepare("PRAGMA table_info(company_settings)").all();
  const hasId = companyCols.some((c) => c.name === "id");
  if (hasId) {
    // Legacy table exists: create new table if needed and copy data (one-time)
    // (If you prefer, tell me and I’ll give you a clean migration to rename tables.)
  }

  // Helpful indexes for SaaS filtering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_tenant ON sale_items(tenant_id);
  `);
}