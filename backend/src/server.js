import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dns from "node:dns";
import { connectDB } from "./config/db.js";
import { needsSetup, runFirstSetup } from "./services/auth.service.js";
import { ensureLogins } from "./utils/bootstrap.js";
import setupRoutes from "./routes/setup.routes.js";
import authRoutes from "./routes/auth.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import announcementRoutes from "./routes/announcement.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import usersRoutes from "./routes/users.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "production") {
  process.env.JWT_SECRET = "dev-only-secret-change-me";
  console.warn("JWT_SECRET not set - using an insecure dev secret. Set it in .env.");
}

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "10mb" })); // Larger limit for photo uploads

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/setup", setupRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check: reports MongoDB connection state
app.get("/api/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? "ok" : "degraded",
    database: dbConnected ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

// 404 for unknown API routes
app.use("/api", (req, res) => {
  res
    .status(404)
    .json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Central error handler
app.use((err, req, res, next) => {
  // Duplicate unique value (e.g. email already used)
  if (err.code === 11000) {
    return res
      .status(409)
      .json({ message: "A record with this value already exists" });
  }
  // Malformed JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body is not valid JSON" });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res
    .status(status)
    .json({ message: err.message || "Server error", errors: err.errors });
});

async function start() {
  try {
    await connectDB();
    // Optional env-based first run (ADMIN_EMAIL / ADMIN_PASSWORD)
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && (await needsSetup())) {
      await runFirstSetup({ companyName: process.env.COMPANY_NAME || "My Company", adminName: process.env.ADMIN_NAME || "Admin", email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
      console.log(`First-run admin created: ${process.env.ADMIN_EMAIL}`);
    }
    // Test logins (admin@hcm.local etc). Set AUTO_SEED_LOGINS=false on the judging/production deployment.
    if (process.env.AUTO_SEED_LOGINS !== "false") {
      await ensureLogins();
      console.log("Test logins ready: admin@hcm.local / hr@hcm.local / employee@hcm.local");
    }
    app.listen(PORT, () =>
      console.log(`API running on http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("Startup failed:", err.message);
    process.exit(1);
  }
}

start();
