import { Router } from "express";
import { login } from "../controllers/auth.controller.js";

const router = Router();
router.post("/login", login);

export default router;
import { registerAdmin } from "../controllers/auth.register.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

router.post("/register", requireAuth, registerAdmin);