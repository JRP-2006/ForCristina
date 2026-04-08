import { db } from "../db/sqlite.js";

export async function getCompany(req, res) {
  const row = db
    .prepare("SELECT name, rut, phone, address FROM company_settings WHERE id = 1 LIMIT 1")
    .get();

  if (!row) return res.json(null);
  return res.json(row);
}

export async function upsertCompany(req, res) {
  const { name, rut, phone, address } = req.body || {};
  if (!name || !rut || !phone || !address) {
    return res
      .status(400)
      .json({ message: "name, rut, phone y address son requeridos" });
  }

  db.prepare(
    `
    INSERT INTO company_settings (id, name, rut, phone, address, updated_at)
    VALUES (1, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      rut=excluded.rut,
      phone=excluded.phone,
      address=excluded.address,
      updated_at=datetime('now')
    `
  ).run(name, rut, phone, address);

  return res.json({ ok: true });
}