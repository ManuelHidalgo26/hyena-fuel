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
    /* =========================
        ITEMS
    ========================= */
    items: {
        type: [orderItemSchema],
        required: true,
    },

    /* =========================
        PRECIOS (NUEVOS)
    ========================= */
    subtotal: {
        type: Number,
        required: true,
    },

    discount: {
        type: Number,
        required: true,
        default: 0,
    },

    shippingCost: {
        type: Number,
        required: true,
        default: 0,
    },

    totalFinal: {
        type: Number,
        required: true,
    },

    /* =========================
        LEGACY / COMPATIBILIDAD
    ========================= */
    totalAmount: {
        type: Number,
        required: true,
    },

    /* =========================
        PAGO
    ========================= */
    paymentMethod: {
        type: String,
        enum: ["mercadopago", "transferencia"],
        default: null,
    },

    paymentId: {
        type: String,
        default: null,
    },

    /* =========================
        ESTADO
    ========================= */
    status: {
        type: String,
        enum: ["pending", "paid", "cancelled"],
        default: "pending",
    },

    /* =========================
        CLIENTE
    ========================= */
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
