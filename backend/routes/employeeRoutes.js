
import express from "express";
import {
  createEmployee,
  getEmployees,
} from "../controllers/employeeController.js";
import {
  protect,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, requireRole("admin", "hr"));

router.post("/", createEmployee);
router.get("/", getEmployees);

export default router;
