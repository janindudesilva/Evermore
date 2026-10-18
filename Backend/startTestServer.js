import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";

async function main() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  console.log("In-memory MongoDB started for live demo/e2e testing.");

  const Product = (await import("./models/Product.js")).default;
  const User = (await import("./models/User.js")).default;
  const app = (await import("./server.js")).default;

  // Seed sample products
  await Product.create([
    {
      name: "Field Jacket",
      line: "Outerwear",
      category: "Outerwear",
      type: "jacket",
      tag: "Featured",
      price: 128,
      sizes: ["S", "M", "L", "XL"],
      stock: { S: 10, M: 15, L: 5, XL: 2 },
      description: "A boxy cotton-canvas jacket built for layering.",
      features: ["12oz cotton canvas", "Box-pleat back"],
    },
    {
      name: "Everyday Tee",
      line: "Essentials",
      category: "Essentials",
      type: "tee",
      tag: "New Arrivals",
      price: 32,
      sizes: ["S", "M", "L"],
      stock: { S: 25, M: 30, L: 20 },
      description: "Heavyweight combed cotton tee.",
      features: ["220gsm combed cotton"],
    },
  ]);

  // Seed Admin user
  await User.create({
    name: "Evermore Admin",
    email: "admin@evermore.com",
    password: "AdminPassword2026!",
    role: "admin",
  });

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`EVERMORE test server actively listening on port ${PORT}`);
  });

  process.on("SIGINT", async () => {
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  });
}

main().catch(console.error);
