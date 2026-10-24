import express from "express";
import { chat, smartLeave } from "../controllers/aiController.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/chat", chat);
router.post("/smart-leave", requireRole("employee"), smartLeave);

export default router;