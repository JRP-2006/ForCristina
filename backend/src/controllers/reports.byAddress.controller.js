import { db } from "../db/sqlite.js";

export async function reportByAddress(req, res) {
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ message: "year y month son requeridos (month 1-12)" });
  }

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  // A) Producto más vendido por dirección (Top 1 por cantidad)
  const byAddressRows = db
    .prepare(
      `
      WITH sales_in_range AS (
        SELECT s.id AS sale_id, s.client_id
        FROM sales s
        WHERE s.sale_date >= ? AND s.sale_date < ?
      ),
      items AS (
        SELECT
          COALESCE(NULLIF(TRIM(c.address), ''), 'MOSTRADOR / SIN DIRECCIÓN') AS address,
          p.id AS product_id,
          p.name AS product_name,
          SUM(si.quantity) AS qty,
          SUM(si.quantity * si.unit_price) AS revenue
        FROM sales_in_range r
        LEFT JOIN clients c ON c.id = r.client_id
        JOIN sale_items si ON si.sale_id = r.sale_id
        JOIN products p ON p.id = si.product_id
        GROUP BY address, product_id, product_name
      ),
      ranked AS (
        SELECT
          address, product_id, product_name, qty, revenue,
          ROW_NUMBER() OVER (PARTITION BY address ORDER BY qty DESC, revenue DESC) AS rn
        FROM items
      )
      SELECT
        address,
        product_id AS top_product_id,
        product_name AS top_product_name,
        qty AS top_qty,
        revenue AS top_revenue
      FROM ranked
      WHERE rn = 1
      ORDER BY address ASC
      `
    )
    .all(start, end);

  // B) Ganancia neta y % neto por producto en el mes
  const profitRows = db
    .prepare(
      `
      SELECT
        p.id,
        p.name,
        SUM(si.quantity) AS qty,
        SUM(si.quantity * si.unit_price) AS revenue,
        SUM(si.quantity * p.purchase_price) AS cost,
        SUM(si.quantity * (si.unit_price - p.purchase_price)) AS net_profit
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON p.id = si.product_id
      WHERE s.sale_date >= ? AND s.sale_date < ?
      GROUP BY p.id, p.name
      ORDER BY net_profit DESC
      `
    )
    .all(start, end);

  const profitByProduct = profitRows.map((r) => {
    const revenue = Number(r.revenue || 0);
    const net = Number(r.net_profit || 0);
    const pct = revenue > 0 ? (net / revenue) * 100 : 0;

    return {
      id: r.id,
      name: r.name,
      qty: Number(r.qty || 0),
      revenue,
      cost: Number(r.cost || 0),
      net_profit: net,
      net_profit_pct: Number(pct.toFixed(2)),
    };
  });

  res.json({
    year,
    month,
    byAddress: byAddressRows,
    profitByProduct,
  });
}