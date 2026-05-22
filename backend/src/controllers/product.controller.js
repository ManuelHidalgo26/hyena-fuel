import Product from "../models/Product.js";

// GET /api/products — tienda pública (solo activos)
export const getProducts = async (req, res) => {
    try {
        const products = await Product.find({ active: true });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener productos" });
    }
};

// GET /api/products/admin — panel admin (todos, incluyendo inactivos)
export const getAllProductsAdmin = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener productos" });
    }
};

// GET /api/products/:slug
export const getProductBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const product = await Product.findOne({ slug, active: true });
        if (!product) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener el producto" });
    }
};

// POST /api/products — crear producto
export const createProduct = async (req, res) => {
    try {
        const { name, slug, price, transferPrice, stock, description, images } = req.body;

        if (!name || !slug || price === undefined || stock === undefined || !description) {
            return res.status(400).json({ message: "Faltan campos obligatorios" });
        }

        const existing = await Product.findOne({ slug });
        if (existing) {
            return res.status(409).json({ message: "Ya existe un producto con ese slug" });
        }

        const product = await Product.create({
            name,
            slug: slug.toLowerCase().trim(),
            price: Number(price),
            transferPrice: transferPrice ? Number(transferPrice) : null,
            stock: Number(stock),
            description,
            images: Array.isArray(images) ? images : (images ? [images] : []),
            active: true,
        });

        res.status(201).json(product);
    } catch (error) {
        console.error("❌ Error creando producto:", error);
        res.status(500).json({ message: "Error creando producto" });
    }
};

// PATCH /api/products/:id — actualizar producto
export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        if (updates.price !== undefined)         updates.price         = Number(updates.price);
        if (updates.transferPrice !== undefined)  updates.transferPrice = updates.transferPrice ? Number(updates.transferPrice) : null;
        if (updates.stock !== undefined)          updates.stock         = Number(updates.stock);
        if (updates.images !== undefined && !Array.isArray(updates.images)) {
            updates.images = updates.images ? [updates.images] : [];
        }

        const product = await Product.findByIdAndUpdate(id, updates, { new: true });
        if (!product) return res.status(404).json({ message: "Producto no encontrado" });

        res.json(product);
    } catch (error) {
        console.error("❌ Error actualizando producto:", error);
        res.status(500).json({ message: "Error actualizando producto" });
    }
};
