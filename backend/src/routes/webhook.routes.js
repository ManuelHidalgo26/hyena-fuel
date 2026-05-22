import { Router } from "express";
import { handleMercadoPagoWebhook } from "../controllers/webhook.controller.js";

const router = Router();

router.post("/mercadopago", handleMercadoPagoWebhook);

export default router;
