import { db } from "../db/sqlite.js";

export async function getCompany(req, res) {
  const tenantId = Number(req.user?.tenantId);
  const row = db
    .prepare(
      "SELECT name, rut, phone, address, updated_at FROM company_settings WHERE tenant_id = ? LIMIT 1"
    )
    .get(tenantId);

  if (!row) return res.json(null);
  return res.json(row);
}

export async function upsertCompany(req, res) {
  const tenantId = Number(req.user?.tenantId);
  const { name, rut, phone, address } = req.body || {};

  if (!name || !rut || !phone || !address) {
    return res.status(400).json({ message: "name, rut, phone y address son requeridos" });
  }

  db.prepare(
    `
    INSERT INTO company_settings (tenant_id, name, rut, phone, address, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(tenant_id) DO UPDATE SET
      name=excluded.name,
      rut=excluded.rut,
      phone=excluded.phone,
      address=excluded.address,
      updated_at=datetime('now')
    `
  ).run(tenantId, name, rut, phone, address);

  return res.json({ ok: true });
}