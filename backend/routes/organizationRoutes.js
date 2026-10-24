
import express from "express";
import {
  createOrganization,
  getOrganization,
} from "../controllers/organizationController.js";

const router = express.Router();

router.post("/", createOrganization);
router.get("/", getOrganization);

export default router;
