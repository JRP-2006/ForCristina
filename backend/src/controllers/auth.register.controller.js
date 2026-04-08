import bcrypt from "bcryptjs";
import { db } from "../db/sqlite.js";

export async function registerAdmin(req, res) {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ message: "name, email and password required" });
  }

  const password_hash = await bcrypt.hash(password, 10);

  try {
    const info = db
      .prepare("INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)")
      .run(email, password_hash, name);

    return res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
  } catch (e) {
    // SQLite duplicate key
    if (String(e?.code) === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: "Error creating admin" });
  }
}