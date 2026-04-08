import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { dailyReport, monthlyReport } from "../controllers/reports.controller.js";
import { reportByAddress } from "../controllers/reports.byAddress.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/daily", dailyReport);     // ?date=YYYY-MM-DD
router.get("/monthly", monthlyReport); // ?year=2026&month=4
router.get("/by-address", reportByAddress);

export default router;