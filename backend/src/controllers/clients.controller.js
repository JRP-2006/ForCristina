import { z } from "zod";
import { db } from "../db/sqlite.js";

const ClientCreate = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
const ClientUpdate = ClientCreate.partial();

export async function listClients(req, res) {
  const rows = db.prepare("SELECT * FROM clients ORDER BY id DESC").all();
  res.json(rows);
}

export async function getClient(req, res) {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
}

export async function createClient(req, res) {
  const parsed = ClientCreate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const c = parsed.data;

  const info = db
    .prepare("INSERT INTO clients (name, phone, address, notes) VALUES (?, ?, ?, ?)")
    .run(c.name, c.phone ?? null, c.address ?? null, c.notes ?? null);

  res.status(201).json({ id: Number(info.lastInsertRowid), ...c });
}

export async function updateClient(req, res) {
  const id = Number(req.params.id);

  const parsed = ClientUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const c = parsed.data;

  const existing = db.prepare("SELECT id FROM clients WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ message: "Not found" });

  db.prepare(
    `UPDATE clients SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(c.name ?? null, c.phone ?? null, c.address ?? null, c.notes ?? null, id);

  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  res.json(row);
}

export async function deleteClient(req, res) {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM clients WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ message: "Not found" });
  res.status(204).send();
}