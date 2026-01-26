import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
    name: {
        type: String,
        required: true,
        trim: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
    description: {
        type: String,
        required: true,
    },
    images: {
        type: [String],
        default: [],
    },
    active: {
        type: Boolean,
        default: true,
    },
    },
    {
    timestamps: true,
    }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
