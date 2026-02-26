import bcrypt from "bcryptjs";
import { User } from "../models/User.js";

export async function bootstrapAdmin({ email, password }) {
  if (!email || !password) return;

  const exists = await User.findOne({ email: email.toLowerCase() }).lean();
  if (exists) {
    console.log("✅ Admin exists:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    email: email.toLowerCase(),
    passwordHash,
    role: "admin"
  });

  console.log("✅ Admin created:", email);
}