import Product from "../models/Product.js";

// GET /api/products
export const getProducts = async (req, res) => {
    try {
    const products = await Product.find({ active: true });
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
