import mongoose from "mongoose";

const connectDB = async () => {
    try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("🟢 MongoDB conectado correctamente");
    } catch (error) {
    console.error("🔴 Error conectando MongoDB:", error.message);
    process.exit(1);
    }
};

export default connectDB;
