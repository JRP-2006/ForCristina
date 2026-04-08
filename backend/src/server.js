import "dotenv/config";
import app from "./app.js";
import { migrate } from "./db/migrate.js";

migrate();

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`API running on ${HOST}:${PORT}`);
});