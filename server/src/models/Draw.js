import mongoose from "mongoose";

const DrawSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    drawAt: { type: Date, required: true },

    // сколько призов в этом розыгрыше
    prizesCount: { type: Number, default: 1 },

    // результаты (по местам)
    winners: [
      {
        place: { type: Number, required: true }, // 1 = главный приз
        participantId: { type: mongoose.Schema.Types.ObjectId, ref: "Participant" },
        ticketDisplay: { type: String, default: "" },
      },
    ],

    totalParticipants: { type: Number, default: 0 },

    // аудит “случайности” (без seed)
    randomNonce: { type: String, default: "" },
    randomHash: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Draw = mongoose.model("Draw", DrawSchema);