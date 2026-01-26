import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Product from "../models/Product.js";

dotenv.config();

const products = [
    {
    name: "Whey Protein",
    slug: "whey-protein",
    price: 0,
    stock: 0,
    description:
        "Proteína de suero de alta calidad diseñada para maximizar la recuperación muscular y el crecimiento.",
    images: ["/images/wheyprotein.jpeg"],
    },
    {
    name: "Creatina Monohidratada",
    slug: "creatina-monohidratada",
    price: 0,
    stock: 0,
    description:
        "Aumentá tu fuerza y potencia con creatina pura, ideal para entrenamientos de alta intensidad.",
    images: ["/images/proximamente.png"],
    },
];

const seedProducts = async () => {
    try {
    await connectDB();

    await Product.deleteMany();
    await Product.insertMany(products);

    console.log("🌱 Productos cargados correctamente");
    process.exit();
    } catch (error) {
    console.error("❌ Error cargando productos:", error.message);
    process.exit(1);
    }
};

seedProducts();
