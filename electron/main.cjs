const { app, BrowserWindow } = require("electron");
const path = require("path");

const BACKEND_ENTRY = "backend/src/server.js"; // <-- cámbialo si tu entry es otro

function startBackend() {
  // Donde SQLite guardará el .sqlite (Windows: AppData/Roaming/ForCristina)
  process.env.APP_DATA_DIR = app.getPath("userData");

  // Puerto del backend (por ahora fijo para no complicar)
  process.env.PORT = process.env.PORT || "4000";

  // JWT_SECRET por defecto (puedes cambiarlo luego)
  process.env.JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

  const backendPath = path.join(__dirname, "..", BACKEND_ENTRY);

  // Arrancar backend (debe hacer app.listen)
  require(backendPath);
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  const indexPath = path.join(__dirname, "..", "frontend", "dist", "index.html");
  await win.loadFile(indexPath);
}

app.whenReady().then(async () => {
  startBackend();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});