import Order from "../models/Order.js";
import Product from "../models/Product.js";

/* =========================
    CREAR PEDIDO
========================= */
export const createOrder = async (req, res) => {
    try {
    const { items, customerName, customerEmail, customerPhone } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: "El pedido está vacío" });
    }

    let orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
        const product = await Product.findById(item.productId);

        if (!product || !product.active) {
        return res
            .status(404)
            .json({ message: "Producto no válido" });
        }

        if (product.stock < item.quantity) {
        return res
            .status(400)
            .json({ message: `Stock insuficiente para ${product.name}` });
        }

        const subtotal = product.price * item.quantity;
        totalAmount += subtotal;

        orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal,
        });
    }

    const order = await Order.create({
        items: orderItems,
        totalAmount,
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
