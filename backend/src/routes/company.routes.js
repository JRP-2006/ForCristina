import express from "express";
import { getCompany, upsertCompany } from "../controllers/company.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", requireAuth, getCompany);
router.post("/", requireAuth, upsertCompany);

export default router;