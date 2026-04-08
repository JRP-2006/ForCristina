import { db } from "../db/sqlite.js";

export async function dailyReport(req, res) {
  const date = req.query.date; // YYYY-MM-DD
  if (!date) {
    return res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });
  }

  const totals = db
    .prepare(
      `
      SELECT
        COUNT(*) AS invoices,
        COALESCE(SUM(total), 0) AS total_sold
      FROM sales
      WHERE DATE(sale_date) = ?
      `
    )
    .get(date);

  const topProducts = db
    .prepare(
      `
      SELECT p.id, p.name, SUM(si.quantity) AS qty
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE DATE(s.sale_date) = ?
      GROUP BY p.id, p.name
      ORDER BY qty DESC
      LIMIT 10
      `
    )
    .all(date);

  res.json({
    date,
    invoices: Number(totals?.invoices || 0),
    total_sold: Number(totals?.total_sold || 0),
    topProducts: topProducts.map((r) => ({
      id: r.id,
      name: r.name,
      qty: Number(r.qty || 0),
    })),
  });
}

export async function monthlyReport(req, res) {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ message: "year and month required (month 1-12)" });
  }

  const month2 = String(month).padStart(2, "0");
  const yearStr = String(year);

  const totals = db
    .prepare(
      `
      SELECT
        COUNT(*) AS invoices,
        COALESCE(SUM(total), 0) AS total_sold
      FROM sales
      WHERE strftime('%Y', sale_date) = ?
        AND strftime('%m', sale_date) = ?
      `
    )
    .get(yearStr, month2);

  const byDay = db
    .prepare(
      `
      SELECT DATE(sale_date) AS day, COALESCE(SUM(total), 0) AS total
      FROM sales
      WHERE strftime('%Y', sale_date) = ?
        AND strftime('%m', sale_date) = ?
      GROUP BY DATE(sale_date)
      ORDER BY day ASC
      `
    )
    .all(yearStr, month2);

  res.json({
    year,
    month,
    invoices: Number(totals?.invoices || 0),
    total_sold: Number(totals?.total_sold || 0),
    byDay: byDay.map((r) => ({
      day: r.day,
      total: Number(r.total || 0),
    })),
  });
}