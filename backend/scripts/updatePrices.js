import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../src/models/product.js";

dotenv.config();

async function updatePrices() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🟢 MongoDB conectado");

    const updates = [
      { regex: /Ena.*Omega/i, transfer: 23999, list: 27999 },
      { regex: /Pancakes/i, transfer: 11999, list: 14999 },
      { regex: /Gold.*Whey/i, transfer: 45999, list: 51999 },
      { regex: /Gold.*Crea/i, transfer: 21999, list: 24999 },
      { regex: /Ena.*Whey/i, transfer: 41999, list: 47999 },
      { regex: /Star.*Whey/i, transfer: 38999, list: 42999 },
      { regex: /Star.*Crea/i, transfer: 23999, list: 27999 },
      { regex: /Gold.*Vitamin/i, transfer: 13999, list: 15999 },
      { regex: /Vitamin.*Star/i, transfer: 16999, list: 19999 },
      { regex: /TNT/i, transfer: 23999, list: 27999 },
      { regex: /Colageno.*Star/i, transfer: 15999, list: 17999 },
    ];

    for (const item of updates) {
      const result = await Product.updateMany(
        { name: item.regex },
        {
          $set: {
            price: item.list,
            transferPrice: item.transfer,
          },
        }
      );

      console.log(
        `✔ ${item.regex} → modificados: ${result.modifiedCount}`
      );
    }

    console.log("✅ Precios actualizados correctamente");
    process.exit();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

updatePrices();
