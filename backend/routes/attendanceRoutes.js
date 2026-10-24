
import express from "express";
import {
  checkIn,
  checkOut,
  getAttendance,
} from "../controllers/attendanceController.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/check-in", checkIn);
router.post("/check-out", checkOut);

router.get(
  "/",
  requireRole("admin", "hr", "employee"),
  getAttendance
);

export default router;
