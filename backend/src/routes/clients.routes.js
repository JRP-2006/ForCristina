import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  listClients, getClient, createClient, updateClient, deleteClient
} from "../controllers/clients.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", listClients);
router.get("/:id", getClient);
router.post("/", createClient);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);

export default router;