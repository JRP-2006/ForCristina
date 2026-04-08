import "dotenv/config";
import app from "./app.js";
import { migrate } from "./db/migrate.js";


migrate();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

