import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { ENV } from "./config/env.js";
import { connectMongo } from "./config/mongo.js";
import publicRoutes from "./routes/public.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import registerRoutes from "./routes/register.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import {
  apiLimiter,
} from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.routes.js";
import { bootstrapAdmin } from "./services/bootstrapAdmin.js";
import { requireAuth, requireRole } from "./middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// paths
const publicDir = path.join(__dirname, "..", "..", "public");

async function bootstrap() {
  await connectMongo(ENV.MONGO_URI);
  await bootstrapAdmin({
    email: ENV.ADMIN_EMAIL,
    password: ENV.ADMIN_PASSWORD,
  });

  const app = express();

  // middlewares
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "200kb" }));
  app.use(morgan("dev"));

  // API
  app.use("/api/", apiLimiter);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", requireAuth, requireRole(["admin", "manager"]), adminRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/public", registerRoutes);
  app.use("/api/public", ticketRoutes);

  // Static front
  app.use(express.static(publicDir));

  // fallback: index.html
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.listen(ENV.PORT, () => {
    console.log(`✅ Server: ${ENV.APP_URL} (port ${ENV.PORT})`);
  });
}

bootstrap().catch((err) => {
  console.error("❌ Boot error:", err);
  process.exit(1);
});
