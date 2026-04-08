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
  const rows = db.prepare("SELECT * FROM products ORDER BY id DESC").all();
  res.json(rows);
}

export async function getProduct(req, res) {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
}

export async function createProduct(req, res) {
  const parsed = ProductCreate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const p = parsed.data;

  try {
    const stmt = db.prepare(
      "INSERT INTO products (name, purchase_price, stock, category, description) VALUES (?, ?, ?, ?, ?)"
    );

    const info = stmt.run(
      p.name,
      p.purchase_price,
      p.stock,
      p.category ?? null,
      p.description ?? null
    );

    res.status(201).json({ id: Number(info.lastInsertRowid), ...p });
  } catch (err) {
    // SQLite duplicate key => SQLITE_CONSTRAINT_UNIQUE
    if (err && String(err.code) === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "Ya existe un producto con ese nombre." });
    }
    return res.status(500).json({ message: "Error creando producto." });
  }
}

export async function updateProduct(req, res) {
  const id = Number(req.params.id);

  const parsed = ProductUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const p = parsed.data;

  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ message: "Not found" });

  db.prepare(
    `UPDATE products SET
      name = COALESCE(?, name),
      purchase_price = COALESCE(?, purchase_price),
      stock = COALESCE(?, stock),
      category = COALESCE(?, category),
      description = COALESCE(?, description),
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    p.name ?? null,
    p.purchase_price ?? null,
    p.stock ?? null,
    p.category ?? null,
    p.description ?? null,
    id
  );

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.json(row);
}

export async function deleteProduct(req, res) {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ message: "Not found" });
  res.status(204).send();
}