import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB connect (routes se PEHLE)
let isConnected = false;
app.use(async (req, res, next) => {
  try {
    if (!isConnected) {
      await connectDB();
      isConnected = true;
    }
    next();
  } catch (error) {
    console.error("DB connection failed:", error.message);
    res.status(500).json({ success: false, message: "Database connection failed", reason: error.message });
  }
});

// Home
app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "SMIT Hackathon API is running!" });
});

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, status: "OK" });
});

app.use("/api/organizations", organizationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/ai", aiRoutes);

// Local development only
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

export default app;