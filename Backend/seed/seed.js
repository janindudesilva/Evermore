import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose from "mongoose";

dotenv.config();

const products = [
  {
    name: "Field Jacket",
    line: "Outerwear",
    category: "Outerwear",
    tag: "Featured",
    type: "jacket",
    color: "#4a5c3e",
    price: 128,
    sizes: ["XS", "S", "M", "L", "XL"],
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
    color: "#14140f",
    price: 32,
    compareAt: 42,
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    description: "Heavyweight combed cotton, cut with a relaxed drop shoulder.",
    features: ["220gsm combed cotton", "Drop shoulder fit", "Pre-shrunk", "Reinforced collar"],
    rating: 4.9,
    reviews: 214,
  },
  {
    name: "Wide Trouser",
    line: "Essentials",
    category: "Essentials",
    type: "trousers",
    color: "#8a8a7e",
    price: 96,
    sizes: ["28", "30", "32", "34", "36"],
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
    color: "#6d2c3a",
    price: 118,
    compareAt: 150,
    sizes: ["XS", "S", "M", "L"],
    description: "Cut on the bias for movement, in a washed satin that falls just below the knee.",
    features: ["Washed satin", "Bias cut", "Adjustable straps", "Side slit"],
    rating: 4.7,
    reviews: 41,
  },
  {
    name: "Oxford Shirt",
    line: "Essentials",
    category: "Essentials",
    type: "shirt",
    color: "#c9c3b3",
    price: 78,
    sizes: ["XS", "S", "M", "L", "XL"],
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
    color: "#3c3f52",
    price: 89,
    sizes: ["XS", "S", "M", "L"],
    description: "Knife-pleated midi skirt in a fluid crepe that holds its shape and catches movement.",
    features: ["Crepe weave", "Knife pleats", "Elasticated back waist", "Fully lined"],
    rating: 4.8,
    reviews: 29,
  },
];

async function seed() {
  await connectDB();

  await Product.deleteMany();
  await Product.insertMany(products);
  console.log(`Seeded ${products.length} products`);

  const adminEmail = "admin@loom.com";
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: "Admin",
      email: adminEmail,
      password: "admin123", // change this immediately after first login
      role: "admin",
    });
    console.log(`Seeded admin user: ${adminEmail} / admin123`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
