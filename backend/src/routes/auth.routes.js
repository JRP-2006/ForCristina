import { Router } from "express";
import { login } from "../controllers/auth.controller.js";
import { registerAdmin } from "../controllers/auth.register.controller.js";

const router = Router();

router.post("/login", login);

// SaaS: registro público (crea tenant + admin)
router.post("/register", registerAdmin);

export default router;