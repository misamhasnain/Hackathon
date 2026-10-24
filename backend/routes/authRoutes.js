import express from "express";
import {
  registerAdmin,
  login,
} from "../controllers/authController.js";
import { changePassword } from "../controllers/passwordController.js";
import {
  protect,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register-admin", registerAdmin);
router.post("/login", login);
router.patch("/change-password", protect, changePassword);

router.get("/me", protect, (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      organization: req.user.organization,
    },
  });
});

router.get(
  "/admin-test",
  protect,
  requireRole("admin"),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Admin access verified.",
      user: req.user.name,
    });
  }
);

export default router;