import { Router } from "express";
import {
  getApprovedReviews,
  getPendingReviews,
  submitReview,
  approveReview,
  deleteReview,
} from "../controllers/review.controller.js";

const router = Router();

router.get("/", getApprovedReviews);
router.get("/pending", getPendingReviews);
router.post("/", submitReview);
router.patch("/:id/approve", approveReview);
router.delete("/:id", deleteReview);

export default router;
