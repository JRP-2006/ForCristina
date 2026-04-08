import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./db/sqlite.js";

const email = "Cristina@gmail.com";
const password = "Administrador1048"; // Cambia esto por la contraseña que quieras para el admin
const name = "Administrador";

const hash = await bcrypt.hash(password, 10);

// SQLite: equivalente a INSERT IGNORE
db.prepare(
  "INSERT OR IGNORE INTO admins (email, password_hash, name) VALUES (?, ?, ?)"
).run(email, hash, name);

console.log("Admin seeded:");
console.log({ email, password });

process.exit(0);