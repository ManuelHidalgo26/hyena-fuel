import express from "express";
import {
    createOrder,
    getOrders,
    updateOrderStatus,
} from "../controllers/order.controller.js";

const router = express.Router();

// Crear pedido
router.post("/", createOrder);

// Obtener todos los pedidos
router.get("/", getOrders);

// 🔥 NUEVA RUTA: actualizar estado
router.patch("/:id/status", updateOrderStatus);

export default router;
