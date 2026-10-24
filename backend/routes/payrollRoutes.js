import express from "express";
import {
  generatePayroll,
  getPayroll,
  finalizePayroll,
  markPayrollPaid,
} from "../controllers/payrollController.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/generate", requireRole("admin", "hr"), generatePayroll);
router.get("/", getPayroll);
router.patch("/:id/finalize", requireRole("admin"), finalizePayroll);
router.patch("/:id/pay", requireRole("admin", "hr"), markPayrollPaid);

export default router;