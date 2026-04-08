import { z } from "zod";
import { db } from "../db/sqlite.js";

const ProductCreate = z.object({
  name: z.string().min(1),
  purchase_price: z.number().positive(),
  stock: z.number().int().nonnegative().optional().default(0),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const ProductUpdate = ProductCreate.partial();

export async function listProducts(req, res) {
  const tenantId = Number(req.user?.tenantId);

  const rows = db
    .prepare("SELECT * FROM products WHERE tenant_id = ? AND active = 1 ORDER BY id DESC")
    .all(tenantId);

  res.json(rows);
}

export async function getProduct(req, res) {
  const tenantId = Number(req.user?.tenantId);
  const id = Number(req.params.id);

  const row = db
    .prepare("SELECT * FROM products WHERE tenant_id = ? AND id = ? LIMIT 1")
    .get(tenantId, id);

  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
}

export async function createProduct(req, res) {
  const tenantId = Number(req.user?.tenantId);

  const parsed = ProductCreate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const p = parsed.data;

  try {
    const stmt = db.prepare(
      `
      INSERT INTO products (tenant_id, name, purchase_price, stock, category, description)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    );

    const info = stmt.run(
      tenantId,
      p.name,
      p.purchase_price,
      p.stock,
      p.category ?? null,
      p.description ?? null
    );

    res.status(201).json({ id: Number(info.lastInsertRowid), ...p });
  } catch (err) {
    // Nota: ya no es UNIQUE por name global (si lo dejaste así en DB, te chocará entre tenants).
    // En SaaS lo ideal es UNIQUE(tenant_id, name) en la tabla.
    if (err && String(err.code) === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "Ya existe un producto con ese nombre." });
    }
    return res.status(500).json({ message: "Error creando producto." });
  }
}

export async function updateProduct(req, res) {
  const tenantId = Number(req.user?.tenantId);
  const id = Number(req.params.id);

  const parsed = ProductUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const p = parsed.data;

  const existing = db
    .prepare("SELECT id FROM products WHERE tenant_id = ? AND id = ? LIMIT 1")
    .get(tenantId, id);

  if (!existing) return res.status(404).json({ message: "Not found" });

  db.prepare(
    `UPDATE products SET
      name = COALESCE(?, name),
      purchase_price = COALESCE(?, purchase_price),
      stock = COALESCE(?, stock),
      category = COALESCE(?, category),
      description = COALESCE(?, description),
      updated_at = datetime('now')
     WHERE tenant_id = ? AND id = ?`
  ).run(
    p.name ?? null,
    p.purchase_price ?? null,
    p.stock ?? null,
    p.category ?? null,
    p.description ?? null,
    tenantId,
    id
  );

  const row = db
    .prepare("SELECT * FROM products WHERE tenant_id = ? AND id = ? LIMIT 1")
    .get(tenantId, id);

  res.json(row);
}

export async function deleteProduct(req, res) {
  const tenantId = Number(req.user?.tenantId);
  const id = Number(req.params.id);

  const existing = db
    .prepare("SELECT id FROM products WHERE tenant_id = ? AND id = ? LIMIT 1")
    .get(tenantId, id);

  if (!existing) return res.status(404).json({ message: "Not found" });

  try {
    db.prepare(
      "UPDATE products SET active = 0, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?"
    ).run(tenantId, id);

    return res.status(204).send();
  } catch (err) {
    if (err && String(err.code) === "SQLITE_CONSTRAINT_TRIGGER") {
      return res.status(409).json({
        message:
          "No se puede eliminar: el producto está asociado a registros (por ejemplo ventas/movimientos).",
      });
    }
    console.error(err);
    return res.status(500).json({ message: "Error eliminando producto." });
  }
}