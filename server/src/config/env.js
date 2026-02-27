import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT || 8080),
  MONGO_URI: process.env.MONGO_URI || "",
  APP_URL: process.env.APP_URL || "http://localhost:8080",
  DRAW_AT: process.env.DRAW_AT || "",
  JWT_SECRET: process.env.JWT_SECRET || "",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "",
  TRUST_PROXY:
    process.env.TRUST_PROXY === "1" ||
    process.env.TRUST_PROXY === "true" ||
    process.env.TRUST_PROXY === "yes",
};

if (!ENV.MONGO_URI) {
  console.error("❌ MONGO_URI is missing in .env");
  process.exit(1);
}
if (!ENV.JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing in .env");
  process.exit(1);
}
