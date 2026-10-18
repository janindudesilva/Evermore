import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import mongoose from "mongoose";

dotenv.config();

const products = [
  {
    name: "Field Jacket",
    line: "Outerwear",
    category: "Outerwear",
    tag: "Featured",
    type: "jacket",
    color: "#2C3B2D",
    price: 128,
    compareAt: null,
    sizes: ["XS", "S", "M", "L", "XL"],
    stock: { XS: 10, S: 15, M: 20, L: 12, XL: 8 },
    images: [],
    description:
      "A boxy cotton-canvas jacket built for layering, with a brushed interior and four utility pockets.",
    features: ["12oz cotton canvas", "Corozo buttons", "Brushed interior", "Box-pleat back"],
    rating: 4.8,
    reviews: 96,
  },
  {
    name: "Everyday Tee",
    line: "Essentials",
    category: "Essentials",
    tag: "New Arrivals",
    type: "tee",
    color: "#1C1B19",
    price: 32,
    compareAt: 42,
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    stock: { XS: 15, S: 25, M: 30, L: 25, XL: 15, XXL: 10 },
    images: [],
    description:
      "Heavyweight combed cotton, cut with a relaxed drop shoulder. The one you reach for on repeat.",
    features: ["220gsm combed cotton", "Drop shoulder fit", "Pre-shrunk", "Reinforced collar"],
    rating: 4.9,
    reviews: 214,
  },
  {
    name: "Wide Trouser",
    line: "Essentials",
    category: "Essentials",
    tag: null,
    type: "trousers",
    color: "#A9825E",
    price: 96,
    compareAt: null,
    sizes: ["28", "30", "32", "34", "36"],
    stock: { "28": 8, "30": 15, "32": 20, "34": 12, "36": 6 },
    images: [],
    description: "A relaxed, high-rise trouser in a soft twill with a fluid drape through the leg.",
    features: ["Cotton-linen twill", "High rise", "Side seam pockets", "Tapered hem"],
    rating: 4.6,
    reviews: 58,
  },
  {
    name: "Bias Slip Dress",
    line: "New Arrivals",
    category: "New Arrivals",
    tag: "Featured",
    type: "dress",
    color: "#5E2129",
    price: 118,
    compareAt: 150,
    sizes: ["XS", "S", "M", "L"],
    stock: { XS: 6, S: 12, M: 15, L: 8 },
    images: [],
    description: "Cut on the bias for movement, in a washed satin that falls just below the knee.",
    features: ["Washed satin", "Bias cut", "Adjustable straps", "Side slit"],
    rating: 4.7,
    reviews: 41,
  },
  {
    name: "Oxford Shirt",
    line: "Essentials",
    category: "Essentials",
    tag: null,
    type: "shirt",
    color: "#C9BFAE",
    price: 78,
    compareAt: null,
    sizes: ["XS", "S", "M", "L", "XL"],
    stock: { XS: 10, S: 18, M: 22, L: 14, XL: 8 },
    images: [],
    description: "A slightly oversized oxford in brushed cotton, made to be worn open or buttoned up.",
    features: ["Brushed oxford cotton", "Oversized fit", "Single chest pocket", "Curved hem"],
    rating: 4.5,
    reviews: 73,
  },
  {
    name: "Pleated Midi Skirt",
    line: "New Arrivals",
    category: "New Arrivals",
    tag: "New Arrivals",
    type: "skirt",
    color: "#4A4844",
    price: 89,
    compareAt: null,
    sizes: ["XS", "S", "M", "L"],
    stock: { XS: 8, S: 14, M: 16, L: 10 },
    images: [],
    description: "Knife-pleated midi skirt in a fluid crepe that holds its shape and catches movement.",
    features: ["Crepe weave", "Knife pleats", "Elasticated back waist", "Fully lined"],
    rating: 4.8,
    reviews: 29,
  },
];

async function seed() {
  await connectDB();

  const isProduction = process.env.NODE_ENV === "production";
  const orderCount = await Order.countDocuments();
  const productCount = await Product.countDocuments();

  if (isProduction && process.env.ALLOW_SEED_OVERWRITE === "true") {
    console.error(
      "[EVERMORE SEED SAFEGUARD] Destructive seed operations (ALLOW_SEED_OVERWRITE) are strictly prohibited in production."
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  if (orderCount > 0 && process.env.ALLOW_SEED_OVERWRITE === "true") {
    console.error(
      `[EVERMORE SEED SAFEGUARD] Refusing to delete products: ${orderCount} existing order(s) detected in database. Erasing products would corrupt order history.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  if (productCount > 0 && process.env.ALLOW_SEED_OVERWRITE !== "true") {
    console.warn(
      `[EVERMORE SEED SAFEGUARD] Database already contains ${productCount} products. Skipping destructive Product.deleteMany(). Set ALLOW_SEED_OVERWRITE=true to force reseed in non-production environments with zero existing orders.`
    );
  } else if (productCount > 0 && process.env.ALLOW_SEED_OVERWRITE === "true") {
    console.log(
      `[EVERMORE SEED] ALLOW_SEED_OVERWRITE is set and 0 orders present. Clearing ${productCount} existing products...`
    );
    await Product.deleteMany();
    await Product.insertMany(products);
    console.log(`Seeded ${products.length} products successfully.`);
  } else {
    await Product.insertMany(products);
    console.log(`Seeded initial ${products.length} products successfully.`);
  }

  // Administrator provisioning: requires explicit environment variables without hardcoded fallbacks
  const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase().trim() : null;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD ? process.env.ADMIN_INITIAL_PASSWORD.trim() : null;

  if (!adminEmail || !adminPassword) {
    console.warn(
      "[EVERMORE ADMIN PROVISIONING] Admin provisioning skipped: ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD must both be explicitly configured in the environment. Hardcoded fallback administrator passwords are prohibited."
    );
  } else if (adminPassword.length < 8) {
    console.error(
      "[EVERMORE ADMIN PROVISIONING] Admin provisioning rejected: ADMIN_INITIAL_PASSWORD must be at least 8 characters long."
    );
  } else {
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      await User.create({
        name: "Evermore Admin",
        email: adminEmail,
        password: adminPassword,
        role: "admin",
      });
      console.log("[EVERMORE ADMIN PROVISIONING] Administrator user provisioned successfully via explicit environment configuration.");
    } else {
      console.log(`[EVERMORE ADMIN PROVISIONING] Admin account already exists.`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
