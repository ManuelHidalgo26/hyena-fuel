import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../src/models/Product.js";

dotenv.config();

const updates = [
  // ENA Whey
  {
    regex: /100% Whey Protein ENA/i,
    transferPrice: 42000,
  },

  // Gold Nutrition Whey
  {
    regex: /100% Whey Protein Gold Nutrition/i,
    transferPrice: 44000,
  },

  // Creatinas
  {
    regex: /Creatina.*Gold Nutrition/i,
    transferPrice: 20000,
  },
  {
    regex: /Creatina.*Star Nutrition/i,
    transferPrice: 23000,
  },

  // Vitaminas
  {
    regex: /Vitaminas.*Gold Nutrition/i,
    transferPrice: 14000,
  },
  {
    regex: /Vitaminas.*Star Nutrition/i,
    transferPrice: 18000,
  },

  // Colágeno
  {
    regex: /Col[aá]geno.*Star Nutrition/i,
    transferPrice: 16000,
  },
  {
    regex: /Col[aá]geno.*ENA Lab/i,
    transferPrice: 19000,
  },

  // Barras ENA
  {
    regex: /Energy Bar/i,
    transferPrice: 2000,
  },

  // Pre entreno
  {
    regex: /Pre Entreno.*Star Nutrition/i,
    transferPrice: 24000,
  },
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🟢 MongoDB conectado");

    for (const u of updates) {
      const res = await Product.updateMany(
        { name: { $regex: u.regex } },
        { $set: { transferPrice: u.transferPrice } }
      );

      console.log(
        `✔ ${u.regex} → modificados: ${res.modifiedCount}`
      );
    }

    console.log("✅ Precios de transferencia actualizados");
    process.exit();
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

run();
