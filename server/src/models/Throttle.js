import mongoose from "mongoose";

const ThrottleSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true }, // ip:... или phone:...
    wrongCount: { type: Number, default: 0 },
    blockedUntil: { type: Date, default: null },
    lastWrongAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export const Throttle = mongoose.model("Throttle", ThrottleSchema);