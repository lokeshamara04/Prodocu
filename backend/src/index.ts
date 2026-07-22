import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import multer from "multer";
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import analyzeRoutes from "./routes/analyze";
import exportRoutes from "./routes/export";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects", analyzeRoutes);
app.use("/api/projects", exportRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handler — always return JSON, never HTML
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err);
  
  // Multer errors (file too large, etc.)
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" 
      ? `File too large. Max size is ${process.env.MAX_ZIP_SIZE_MB || 50}MB.`
      : err.message });
    return;
  }

  // Prisma errors
  if (typeof err === "object" && err !== null && "code" in err) {
    const prismaErr = err as { code: string; message: string };
    if (prismaErr.code === "P2002") {
      res.status(409).json({ error: "A record with this value already exists." });
      return;
    }
    if (prismaErr.code === "P2021") {
      res.status(500).json({ error: "Database connection failed. Check your DATABASE_URL." });
      return;
    }
    if (prismaErr.code === "P1001") {
      res.status(500).json({ error: "Cannot reach the database server. Is it running?" });
      return;
    }
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
