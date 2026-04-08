import { z } from "zod";
import { db } from "../db/sqlite.js";

const SaleCreate = z.object({
  client_id: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.number().int(),
        quantity: z.number().int().positive(),
        unit_price: z.number().positive(),
      })
    )
    .min(1),
});

export async function createSale(req, res) {
  const parsed = SaleCreate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { client_id, notes, items } = parsed.data;

  // calcular total
  const itemsWithSubtotal = items.map((i) => ({
    ...i,
    subtotal: Number((i.quantity * i.unit_price).toFixed(2)),
  }));
  const total = Number(
    itemsWithSubtotal.reduce((a, i) => a + i.subtotal, 0).toFixed(2)
  );

  try {
    const tx = db.transaction(() => {
      // crear sale
      const saleInfo = db
        .prepare("INSERT INTO sales (client_id, total, notes, sale_date, created_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))")
        .run(client_id ?? null, total, notes ?? null);

      const saleId = Number(saleInfo.lastInsertRowid);

      const getProduct = db.prepare("SELECT id, stock FROM products WHERE id = ?");
      const insertItem = db.prepare(
        "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)"
      );
      const updateStock = db.prepare(
        "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?"
      );

      for (const it of itemsWithSubtotal) {
        const prod = getProduct.get(it.product_id);
        if (!prod) throw new Error(`Product not found: ${it.product_id}`);
        if (Number(prod.stock) < it.quantity) {
          throw new Error(`Not enough stock for product ${it.product_id}`);
        }

        insertItem.run(saleId, it.product_id, it.quantity, it.unit_price, it.subtotal);
        updateStock.run(it.quantity, it.product_id);
      }

      return saleId;
    });

    const saleId = tx();
    return res.status(201).json({ id: saleId, total });
  } catch (e) {
    return res.status(400).json({ message: e.message || "Sale failed" });
  }
}

export async function listSales(req, res) {
  const rows = db
    .prepare(
      `
      SELECT s.*, c.name AS client_name
      FROM sales s
      LEFT JOIN clients c ON c.id = s.client_id
      ORDER BY s.id DESC
      LIMIT 200
      `
    )
    .all();

  res.json(rows);
}