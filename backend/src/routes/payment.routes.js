import { Router } from "express";
import { createPaymentPreference } from "../controllers/payment.controller.js";

const router = Router();

router.post("/create", createPaymentPreference);

export default router;
