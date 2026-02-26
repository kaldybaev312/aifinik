import mongoose from "mongoose";

const ParticipantSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true
    },
    phoneE164: {
      type: String,
      unique: true,
      required: true
    },
    ticketNumber: {
      type: Number,
      unique: true
    },
    codeToken: {
      type: String,
      unique: true
    }
  },
  { timestamps: true }
);

export const Participant = mongoose.model("Participant", ParticipantSchema);