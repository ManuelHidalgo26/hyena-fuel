console.log("🔥 CONTROLLER NUEVO CARGADO");

import Order from "../models/Order.js";
import Product from "../models/Product.js";


/* =========================
    CREAR PEDIDO
========================= */
export const createOrder = async (req, res) => {
        try {
            console.log("🟢 CREATE ORDER HIT");
    console.log("📥 BODY RECIBIDO:", req.body);

    const {
        items,
        customerName,
        customerEmail,
        customerPhone,
        paymentMethod,
    } = req.body;


    if (!items || items.length === 0) {
        return res.status(400).json({ message: "El pedido está vacío" });
    }

    if (!paymentMethod || !["mercadopago", "transferencia"].includes(paymentMethod)) {
        return res.status(400).json({ message: "Método de pago inválido" });
    }

    let orderItems = [];
    let subtotal = 0;

    /* =========================
        VALIDAR ITEMS
    ========================= */
    for (const item of items) {
        const product = await Product.findById(item.productId);

        if (!product || !product.active) {
        return res.status(404).json({ message: "Producto no válido" });
        }

        if (product.stock < item.quantity) {
        return res.status(400).json({
            message: `Stock insuficiente para ${product.name}`,
        });
        }

        const itemSubtotal = product.price * item.quantity;
        subtotal += itemSubtotal;

        orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        });
    }

    /* =========================
        DESCUENTO POR TRANSFERENCIA
    ========================= */
    let discount = 0;
    if (paymentMethod === "transferencia") {
        discount = Math.round(subtotal * 0.1); // 10% OFF
    }

    /* =========================
        ENVÍO (CÓRDOBA)
    ========================= */
    let shippingCost = 0;
    if (subtotal < 120000) {
        shippingCost = 5000;
    }

    /* =========================
        TOTAL FINAL
    ========================= */
    const totalFinal = subtotal - discount + shippingCost;

    const order = await Order.create({
        items: orderItems,

        subtotal,
        discount,
        shippingCost,
        totalFinal,

        // compatibilidad legacy
        totalAmount: totalFinal,

        paymentMethod,

        customerName,
        customerEmail,
        customerPhone,

        status: "pending",
    });

    res.status(201).json(order);
    } catch (error) {
    console.error("❌ Error creando pedido:", error);
    res.status(500).json({ message: "Error interno del servidor" });
    }
};

/* =========================
    LISTAR PEDIDOS
========================= */
export const getOrders = async (req, res) => {
    try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
    } catch (error) {
    console.error("❌ Error obteniendo pedidos:", error);
    res.status(500).json({ message: "Error obteniendo pedidos" });
    }
};

/* =========================
    ACTUALIZAR ESTADO PEDIDO
========================= */
export const updateOrderStatus = async (req, res) => {
    try {
    const { status } = req.body;

    const allowedStatuses = ["pending", "confirmed", "dispatched"];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Estado inválido" });
    }

    const order = await Order.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
    );

    if (!order) {
        return res.status(404).json({ message: "Pedido no encontrado" });
    }

    res.json(order);
    } catch (error) {
    console.error("❌ Error actualizando estado:", error);
    res.status(500).json({ message: "Error actualizando pedido" });
    }
};
