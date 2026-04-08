import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { createSale, listSales } from "../controllers/sales.controller.js";

const router = Router();
router.use(requireAuth);

router.post("/", createSale);
router.get("/", listSales);

export default router;