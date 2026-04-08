import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./db/pool.js";

const email = "admin@confites.local";
const password = "admin123";
const name = "Administrador";

const hash = await bcrypt.hash(password, 10);

await pool.query(
  "INSERT IGNORE INTO admins (email, password_hash, name) VALUES (?, ?, ?)",
  [email, hash, name]
);

console.log("Admin seeded:");
console.log({ email, password });

process.exit(0);