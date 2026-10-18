import mongoose from "mongoose";
import dns from "dns";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore fallback errors
}

export async function connectDB(customUri) {
  try {
    const uri = customUri || process.env.MONGO_URI || "mongodb://localhost:27017/evermore";
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
    throw err;
  }
}
