import express from "express";
import {
    createOrder,
    getOrders,
    updateOrderStatus,
    deleteCompletedOrders,
} from "../controllers/order.controller.js";

const router = express.Router();

// Crear pedido
router.post("/", createOrder);

// Obtener todos los pedidos
router.get("/", getOrders);

// Actualizar estado
router.patch("/:id/status", updateOrderStatus);

// Limpiar pedidos finalizados (dispatched, paid, cancelled)
router.delete("/completed", deleteCompletedOrders);

export default router;
