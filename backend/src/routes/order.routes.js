import { Router } from "express";
import { createOrder } from "../controllers/order.controller.js";

const router = Router();

router.post("/", createOrder);

export default router;
