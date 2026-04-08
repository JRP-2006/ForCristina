import bcrypt from "bcryptjs";
import { db } from "../db/sqlite.js";

export async function registerAdmin(req, res) {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ message: "name, email and password required" });
  }

  const password_hash = await bcrypt.hash(password, 10);

  try {
    const tx = db.transaction(() => {
      // 1) create tenant
      const tInfo = db.prepare("INSERT INTO tenants DEFAULT VALUES").run();
      const tenantId = Number(tInfo.lastInsertRowid);

      // 2) create admin for that tenant
      const aInfo = db
        .prepare("INSERT INTO admins (tenant_id, email, password_hash, name) VALUES (?, ?, ?, ?)")
        .run(tenantId, email, password_hash, name);

      return { tenantId, adminId: Number(aInfo.lastInsertRowid) };
    });

    const out = tx();
    return res.status(201).json({ ok: true, tenantId: out.tenantId, adminId: out.adminId });
  } catch (e) {
    if (String(e?.code) === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: "Error creating admin" });
  }
}