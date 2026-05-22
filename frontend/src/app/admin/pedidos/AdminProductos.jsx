"use client";

import { useState, useEffect } from "react";
import NextImage from "next/image";
import styles from "./pedidos.module.css";

const API = "https://hyena-fuel-api.onrender.com";

function slugify(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

const EMPTY_FORM = { name: "", slug: "", price: "", transferPrice: "", stock: "", description: "", images: "" };

export default function AdminProductos() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [showAdd, setShowAdd] = useState(false);
    const [newProduct, setNewProduct] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [stockInputs, setStockInputs] = useState({}); // { [id]: string }
    const [msg, setMsg] = useState(null);

    useEffect(() => {
        fetch(`${API}/api/products/admin`)
            .then((r) => r.json())
            .then((data) => {
                setProducts(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const flash = (text) => { setMsg(text); setTimeout(() => setMsg(null), 3000); };

    /* ---- STOCK RÁPIDO ---- */
    const handleStockSave = async (product) => {
        const raw = stockInputs[product._id];
        const val = Number(raw ?? product.stock);
        if (isNaN(val) || val < 0) return;
        setSaving(true);
        const res = await fetch(`${API}/api/products/${product._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stock: val }),
        });
        if (res.ok) {
            const updated = await res.json();
            setProducts((prev) => prev.map((p) => p._id === product._id ? updated : p));
            setStockInputs((prev) => { const n = { ...prev }; delete n[product._id]; return n; });
            flash("✓ Stock actualizado");
        }
        setSaving(false);
    };

    /* ---- TOGGLE ACTIVO ---- */
    const toggleActive = async (product) => {
        const res = await fetch(`${API}/api/products/${product._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: !product.active }),
        });
        if (res.ok) {
            const updated = await res.json();
            setProducts((prev) => prev.map((p) => p._id === product._id ? updated : p));
        }
    };

    /* ---- GUARDAR EDICIÓN ---- */
    const saveEdit = async () => {
        setSaving(true);
        const payload = { ...editData };
        if (payload.price !== undefined)        payload.price        = Number(payload.price);
        if (payload.transferPrice !== undefined) payload.transferPrice = payload.transferPrice ? Number(payload.transferPrice) : null;
        if (payload.stock !== undefined)         payload.stock        = Number(payload.stock);

        const res = await fetch(`${API}/api/products/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            const updated = await res.json();
            setProducts((prev) => prev.map((p) => p._id === editingId ? updated : p));
            setEditingId(null);
            flash("✓ Producto actualizado");
        }
        setSaving(false);
    };

    /* ---- AGREGAR PRODUCTO ---- */
    const handleAdd = async () => {
        if (!newProduct.name || !newProduct.price || !newProduct.stock || !newProduct.description) {
            flash("⚠ Completá nombre, precio, stock y descripción");
            return;
        }
        setSaving(true);
        const payload = {
            ...newProduct,
            slug: newProduct.slug || slugify(newProduct.name),
            price: Number(newProduct.price),
            transferPrice: newProduct.transferPrice ? Number(newProduct.transferPrice) : null,
            stock: Number(newProduct.stock),
            images: newProduct.images ? [newProduct.images] : [],
        };
        const res = await fetch(`${API}/api/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            const created = await res.json();
            setProducts((prev) => [created, ...prev]);
            setNewProduct(EMPTY_FORM);
            setShowAdd(false);
            flash("✓ Producto agregado");
        } else {
            const err = await res.json();
            flash(`✗ ${err.message}`);
        }
        setSaving(false);
    };

    if (loading) return <p className={styles.loading}>Cargando productos...</p>;

    return (
        <div>
            {msg && <div className={styles.flashMsg}>{msg}</div>}

            {/* BOTÓN AGREGAR */}
            <div className={styles.addProductHeader}>
                <button
                    className={showAdd ? styles.deleteBtn : styles.approveBtn}
                    onClick={() => setShowAdd(!showAdd)}
                >
                    {showAdd ? "✕ Cancelar" : "+ Agregar producto"}
                </button>
            </div>

            {/* FORMULARIO NUEVO PRODUCTO */}
            {showAdd && (
                <div className={styles.productForm}>
                    <h3 className={styles.productFormTitle}>Nuevo producto</h3>
                    <div className={styles.productFormGrid}>
                        <label className={styles.fieldLabel}>
                            Nombre *
                            <input
                                className={styles.fieldInput}
                                value={newProduct.name}
                                onChange={(e) => setNewProduct((p) => ({
                                    ...p,
                                    name: e.target.value,
                                    slug: p.slug || slugify(e.target.value),
                                }))}
                                placeholder="Ej: Whey Protein Gold"
                            />
                        </label>
                        <label className={styles.fieldLabel}>
                            Slug (URL) *
                            <input
                                className={styles.fieldInput}
                                value={newProduct.slug}
                                onChange={(e) => setNewProduct((p) => ({ ...p, slug: e.target.value }))}
                                placeholder="whey-protein-gold"
                            />
                        </label>
                        <label className={styles.fieldLabel}>
                            Precio lista ($) *
                            <input
                                className={styles.fieldInput}
                                type="number"
                                value={newProduct.price}
                                onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
                                placeholder="15000"
                            />
                        </label>
                        <label className={styles.fieldLabel}>
                            Precio transferencia ($)
                            <input
                                className={styles.fieldInput}
                                type="number"
                                value={newProduct.transferPrice}
                                onChange={(e) => setNewProduct((p) => ({ ...p, transferPrice: e.target.value }))}
                                placeholder="13500"
                            />
                        </label>
                        <label className={styles.fieldLabel}>
                            Stock inicial *
                            <input
                                className={styles.fieldInput}
                                type="number"
                                value={newProduct.stock}
                                onChange={(e) => setNewProduct((p) => ({ ...p, stock: e.target.value }))}
                                placeholder="20"
                            />
                        </label>
                        <label className={styles.fieldLabel}>
                            Imagen (ruta o URL)
                            <input
                                className={styles.fieldInput}
                                value={newProduct.images}
                                onChange={(e) => setNewProduct((p) => ({ ...p, images: e.target.value }))}
                                placeholder="/images/mi-producto.jpg"
                            />
                        </label>
                    </div>
                    <label className={styles.fieldLabel}>
                        Descripción *
                        <textarea
                            className={styles.fieldTextarea}
                            value={newProduct.description}
                            onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                            rows={3}
                            placeholder="Descripción del producto..."
                        />
                    </label>
                    <button
                        className={styles.approveBtn}
                        onClick={handleAdd}
                        disabled={saving}
                        style={{ marginTop: "1rem" }}
                    >
                        {saving ? "Guardando..." : "✓ Crear producto"}
                    </button>
                </div>
            )}

            {/* LISTA DE PRODUCTOS */}
            <div className={styles.productList}>
                {products.map((product) => {
                    const isEditing = editingId === product._id;
                    const stockVal = stockInputs[product._id] ?? String(product.stock);
                    const stockChanged = stockInputs[product._id] !== undefined &&
                        stockInputs[product._id] !== String(product.stock);

                    return (
                        <div
                            key={product._id}
                            className={`${styles.productCard} ${!product.active ? styles.productInactive : ""}`}
                        >
                            {/* CABECERA */}
                            <div className={styles.productCardHeader}>
                                <div className={styles.productCardInfo}>
                                    {product.images?.[0] && (
                                        <NextImage
                                            src={product.images[0]}
                                            alt={product.name}
                                            width={48}
                                            height={48}
                                            className={styles.productThumb}
                                        />
                                    )}
                                    <div>
                                        <p className={styles.productName}>
                                            {product.name}
                                            {!product.active && <span className={styles.inactiveBadge}>inactivo</span>}
                                        </p>
                                        <p className={styles.productPrices}>
                                            ${product.price?.toLocaleString("es-AR")}
                                            {product.transferPrice &&
                                                ` / $${product.transferPrice?.toLocaleString("es-AR")} transf.`}
                                        </p>
                                    </div>
                                </div>

                                {/* STOCK RÁPIDO */}
                                <div className={styles.stockControl}>
                                    <span className={styles.stockLabel}>Stock</span>
                                    <input
                                        type="number"
                                        min="0"
                                        className={styles.stockInput}
                                        value={stockVal}
                                        onChange={(e) =>
                                            setStockInputs((prev) => ({ ...prev, [product._id]: e.target.value }))
                                        }
                                    />
                                    {stockChanged && (
                                        <button
                                            className={styles.stockSaveBtn}
                                            onClick={() => handleStockSave(product)}
                                            disabled={saving}
                                        >
                                            Guardar
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ACCIONES */}
                            <div className={styles.productCardActions}>
                                <button
                                    className={styles.editBtn}
                                    onClick={() => {
                                        if (isEditing) { setEditingId(null); return; }
                                        setEditingId(product._id);
                                        setEditData({
                                            name: product.name,
                                            price: product.price,
                                            transferPrice: product.transferPrice ?? "",
                                            stock: product.stock,
                                            description: product.description,
                                            images: product.images?.[0] ?? "",
                                        });
                                    }}
                                >
                                    {isEditing ? "✕ Cerrar" : "✏ Editar"}
                                </button>
                                <button
                                    className={product.active ? styles.deleteBtn : styles.approveBtn}
                                    onClick={() => toggleActive(product)}
                                >
                                    {product.active ? "⊘ Ocultar" : "● Activar"}
                                </button>
                            </div>

                            {/* FORMULARIO EDICIÓN */}
                            {isEditing && (
                                <div className={styles.editForm}>
                                    <div className={styles.productFormGrid}>
                                        <label className={styles.fieldLabel}>
                                            Nombre
                                            <input
                                                className={styles.fieldInput}
                                                value={editData.name ?? ""}
                                                onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                                            />
                                        </label>
                                        <label className={styles.fieldLabel}>
                                            Precio lista ($)
                                            <input
                                                className={styles.fieldInput}
                                                type="number"
                                                value={editData.price ?? ""}
                                                onChange={(e) => setEditData((d) => ({ ...d, price: e.target.value }))}
                                            />
                                        </label>
                                        <label className={styles.fieldLabel}>
                                            Precio transferencia ($)
                                            <input
                                                className={styles.fieldInput}
                                                type="number"
                                                value={editData.transferPrice ?? ""}
                                                onChange={(e) => setEditData((d) => ({ ...d, transferPrice: e.target.value }))}
                                            />
                                        </label>
                                        <label className={styles.fieldLabel}>
                                            Stock
                                            <input
                                                className={styles.fieldInput}
                                                type="number"
                                                value={editData.stock ?? ""}
                                                onChange={(e) => setEditData((d) => ({ ...d, stock: e.target.value }))}
                                            />
                                        </label>
                                        <label className={styles.fieldLabel}>
                                            Imagen (ruta o URL)
                                            <input
                                                className={styles.fieldInput}
                                                value={editData.images ?? ""}
                                                onChange={(e) => setEditData((d) => ({ ...d, images: e.target.value }))}
                                            />
                                        </label>
                                    </div>
                                    <label className={styles.fieldLabel}>
                                        Descripción
                                        <textarea
                                            className={styles.fieldTextarea}
                                            value={editData.description ?? ""}
                                            onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
                                            rows={3}
                                        />
                                    </label>
                                    <button
                                        className={styles.approveBtn}
                                        onClick={saveEdit}
                                        disabled={saving}
                                        style={{ marginTop: "0.8rem" }}
                                    >
                                        {saving ? "Guardando..." : "✓ Guardar cambios"}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
