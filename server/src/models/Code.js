import mongoose from "mongoose";

const CodeSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      unique: true,
      required: true
    },
    status: {
      type: String,
      enum: ["ACTIVE", "USED"],
      default: "ACTIVE"
    },
    usedAt: Date,
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant"
    }
  },
  { timestamps: true }
);

export const Code = mongoose.model("Code", CodeSchema);