import { Router } from "express";
import {
    getProducts,
    getProductBySlug,
} from "../controllers/product.controller.js";

const router = Router();

// GET /api/products
router.get("/", getProducts);

// GET /api/products/:slug
router.get("/:slug", getProductBySlug);

export default router;
