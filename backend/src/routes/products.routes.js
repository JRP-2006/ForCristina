import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct
} from "../controllers/products.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;