import express from "express";
import {
  requestLeave,
  getLeaves,
  getLeaveBalance,
  reviewLeave,
  cancelLeave,
} from "../controllers/leaveController.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", requireRole("employee"), requestLeave);
router.get("/balance", getLeaveBalance);
router.get("/", getLeaves);
router.patch("/:id/review", requireRole("admin", "hr"), reviewLeave);
router.patch("/:id/cancel", requireRole("employee"), cancelLeave);

export default router;