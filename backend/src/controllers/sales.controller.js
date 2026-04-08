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

function recomputeSaleTotal(tenantId, saleId) {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(subtotal), 0) AS total FROM sale_items WHERE tenant_id = ? AND sale_id = ?"
    )
    .get(tenantId, saleId);

  const total = Number(Number(row.total || 0).toFixed(2));
  db.prepare("UPDATE sales SET total = ? WHERE tenant_id = ? AND id = ?").run(total, tenantId, saleId);
  return total;
}

export async function createSale(req, res) {
  const tenantId = Number(req.user?.tenantId);

  const parsed = SaleCreate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { client_id, notes, items } = parsed.data;

  // Si viene client_id, valida que sea del mismo tenant
  if (client_id != null) {
    const c = db
      .prepare("SELECT id FROM clients WHERE tenant_id = ? AND id = ? LIMIT 1")
      .get(tenantId, client_id);
    if (!c) return res.status(400).json({ message: "Cliente inválido" });
  }

  const itemsWithSubtotal = items.map((i) => ({
    ...i,
    subtotal: Number((i.quantity * i.unit_price).toFixed(2)),
  }));
  const total = Number(itemsWithSubtotal.reduce((a, i) => a + i.subtotal, 0).toFixed(2));

  try {
    const tx = db.transaction(() => {
      const saleInfo = db
        .prepare(
          `
          INSERT INTO sales (tenant_id, client_id, total, notes, sale_date, created_at)
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
          `
        )
        .run(tenantId, client_id ?? null, total, notes ?? null);

      const saleId = Number(saleInfo.lastInsertRowid);

      const getProduct = db.prepare(
        "SELECT id, stock, purchase_price FROM products WHERE tenant_id = ? AND id = ? LIMIT 1"
      );
      const insertItem = db.prepare(
        `
        INSERT INTO sale_items (tenant_id, sale_id, product_id, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
        `
      );
      const updateStock = db.prepare(
        "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?"
      );

      for (const it of itemsWithSubtotal) {
        const prod = getProduct.get(tenantId, it.product_id);
        if (!prod) throw new Error(`Producto inválido: ${it.product_id}`);

        // no vender por debajo del costo
        const minPrice = Number(prod.purchase_price);
        if (Number(it.unit_price) < minPrice) {
          throw new Error(
            `Precio de venta inválido para el producto ${it.product_id}. Mínimo permitido: ${minPrice}`
          );
        }

        // stock
        if (Number(prod.stock) < Number(it.quantity)) {
          throw new Error(`No hay stock suficiente para el producto ${it.product_id}`);
        }

        insertItem.run(tenantId, saleId, it.product_id, it.quantity, it.unit_price, it.subtotal);
        updateStock.run(it.quantity, tenantId, it.product_id);
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
  const tenantId = Number(req.user?.tenantId);

  const rows = db
    .prepare(
      `
      SELECT s.*, c.name AS client_name
      FROM sales s
      LEFT JOIN clients c
        ON c.id = s.client_id
       AND c.tenant_id = s.tenant_id
      WHERE s.tenant_id = ?
      ORDER BY s.id DESC
      LIMIT 200
      `
    )
    .all(tenantId);

  res.json(rows);
}

/**
 * GET /api/sales/:id
 */
export async function getSale(req, res) {
  const tenantId = Number(req.user?.tenantId);
  const id = Number(req.params.id);

  const sale = db
    .prepare("SELECT * FROM sales WHERE tenant_id = ? AND id = ? LIMIT 1")
    .get(tenantId, id);

  if (!sale) return res.status(404).json({ message: "Not found" });

  const items = db
    .prepare(
      `
      SELECT si.*, p.name AS product_name
      FROM sale_items si
      JOIN products p
        ON p.id = si.product_id
       AND p.tenant_id = si.tenant_id
      WHERE si.tenant_id = ?
        AND si.sale_id = ?
      ORDER BY si.id ASC
      `
    )
    .all(tenantId, id);

  return res.json({ ...sale, items });
}

const SaleItemQtyPatch = z.object({
  quantity: z.number().int().min(1),
});

/**
 * PATCH /api/sales/:saleId/items/:itemId
 */
export async function updateSaleItemQuantity(req, res) {
  const tenantId = Number(req.user?.tenantId);
  const saleId = Number(req.params.saleId);
  const itemId = Number(req.params.itemId);

  if (!Number.isFinite(saleId) || !Number.isFinite(itemId)) {
    return res.status(400).json({ message: "Invalid saleId/itemId" });
  }

  const parsed = SaleItemQtyPatch.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { quantity: newQty } = parsed.data;

  try {
    const tx = db.transaction(() => {
      const item = db
        .prepare(
          `
          SELECT id, tenant_id, sale_id, product_id, quantity, unit_price
          FROM sale_items
          WHERE tenant_id = ? AND id = ? AND sale_id = ?
          LIMIT 1
          `
        )
        .get(tenantId, itemId, saleId);

      if (!item) {
        const err = new Error("Sale item not found");
        err.status = 404;
        throw err;
      }

      // Asegura que la sale también pertenezca al tenant (doble check)
      const sale = db
        .prepare("SELECT id FROM sales WHERE tenant_id = ? AND id = ? LIMIT 1")
        .get(tenantId, saleId);
      if (!sale) {
        const err = new Error("Sale not found");
        err.status = 404;
        throw err;
      }

      const oldQty = Number(item.quantity);
      const delta = Number(newQty) - oldQty;

      if (delta !== 0) {
        const prod = db
          .prepare("SELECT id, stock FROM products WHERE tenant_id = ? AND id = ? LIMIT 1")
          .get(tenantId, item.product_id);

        if (!prod) throw new Error(`Product not found: ${item.product_id}`);

        if (delta > 0 && Number(prod.stock) < delta) {
          const err = new Error("Not enough stock");
          err.status = 409;
          throw err;
        }

        // stock = stock - delta
        db.prepare(
          "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?"
        ).run(delta, tenantId, item.product_id);
      }

      const subtotal = Number((Number(newQty) * Number(item.unit_price)).toFixed(2));

      db.prepare(
        "UPDATE sale_items SET quantity = ?, subtotal = ? WHERE tenant_id = ? AND id = ? AND sale_id = ?"
      ).run(newQty, subtotal, tenantId, itemId, saleId);

      const total = recomputeSaleTotal(tenantId, saleId);

      const updatedItem = db
        .prepare(
          "SELECT * FROM sale_items WHERE tenant_id = ? AND id = ? AND sale_id = ? LIMIT 1"
        )
        .get(tenantId, itemId, saleId);

      return { updatedItem, total };
    });

    const { updatedItem, total } = tx();
    return res.json({ item: updatedItem, total });
  } catch (e) {
    const status = e.status || 400;
    return res.status(status).json({ message: e.message || "Update failed" });
  }
}

/**
 * DELETE /api/sales/:saleId/items/:itemId
 */
export async function deleteSaleItem(req, res) {
  const tenantId = Number(req.user?.tenantId);
  const saleId = Number(req.params.saleId);
  const itemId = Number(req.params.itemId);

  if (!Number.isFinite(saleId) || !Number.isFinite(itemId)) {
    return res.status(400).json({ message: "Invalid saleId/itemId" });
  }

  try {
    const tx = db.transaction(() => {
      const item = db
        .prepare(
          `
          SELECT id, sale_id, product_id, quantity
          FROM sale_items
          WHERE tenant_id = ? AND id = ? AND sale_id = ?
          LIMIT 1
          `
        )
        .get(tenantId, itemId, saleId);

      if (!item) {
        const err = new Error("Sale item not found");
        err.status = 404;
        throw err;
      }

      // borrar item
      db.prepare("DELETE FROM sale_items WHERE tenant_id = ? AND id = ? AND sale_id = ?")
        .run(tenantId, itemId, saleId);

      // devolver stock
      db.prepare(
        "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?"
      ).run(Number(item.quantity), tenantId, item.product_id);

      const total = recomputeSaleTotal(tenantId, saleId);
      return { total };
    });

    const { total } = tx();
    return res.json({ ok: true, total });
  } catch (e) {
    const status = e.status || 400;
    return res.status(status).json({ message: e.message || "Delete failed" });
  }
}