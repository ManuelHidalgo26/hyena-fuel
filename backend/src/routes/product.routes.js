import { Router } from "express";
import {
    getProducts,
    getAllProductsAdmin,
    getProductBySlug,
    createProduct,
    updateProduct,
} from "../controllers/product.controller.js";

const router = Router();

router.get("/admin", getAllProductsAdmin);   // antes de /:slug para evitar colisión
router.get("/", getProducts);
router.get("/:slug", getProductBySlug);
router.post("/", createProduct);
router.patch("/:id", updateProduct);

export default router;
