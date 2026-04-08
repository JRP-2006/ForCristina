import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  createSale,
  listSales,
  getSale,
  deleteSaleItem,
  updateSaleItemQuantity,
} from "../controllers/sales.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", listSales);
router.post("/", createSale);

router.get("/:id", getSale);

// editar/eliminar renglones de una venta
router.patch("/:saleId/items/:itemId", updateSaleItemQuantity);
router.delete("/:saleId/items/:itemId", deleteSaleItem);

export default router;