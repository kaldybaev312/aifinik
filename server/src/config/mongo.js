import mongoose from "mongoose";

export async function connectMongo(MONGO_URI) {
  mongoose.set("strictQuery", true);

  await mongoose.connect(MONGO_URI, {
    autoIndex: true
  });

  console.log("✅ MongoDB connected");
}