import { Router } from "express";
import { subscribe } from "../controllers/newsletter.controller.js";

const router = Router();

router.post("/", subscribe);

export default router;
