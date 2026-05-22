import { Router } from "express";
import { subscribe, getSubscribers } from "../controllers/newsletter.controller.js";

const router = Router();

router.get("/", getSubscribers);
router.post("/", subscribe);

export default router;
