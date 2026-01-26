import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
    {
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    subtotal: {
        type: Number,
        required: true,
    },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
    items: {
        type: [orderItemSchema],
        required: true,
    },

    totalAmount: {
        type: Number,
        required: true,
    },

    status: {
        type: String,
        enum: ["pending", "paid", "cancelled"],
        default: "pending",
    },

    paymentId: {
        type: String,
        default: null,
    },

    paymentMethod: {
        type: String,
        default: null,
    },

    customerName: {
        type: String,
        default: null,
    },

    customerEmail: {
        type: String,
        default: null,
    },

    customerPhone: {
    type: String,
    default: null,
    },
    
    },
    {
    timestamps: true,
    }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
