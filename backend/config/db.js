
import mongoose from "mongoose";

import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from .env");
  }

  const connection = await mongoose.connect(
    process.env.MONGODB_URI
  );

  console.log(
    `MongoDB connected: ${connection.connection.host}`
  );
};

export default connectDB;



