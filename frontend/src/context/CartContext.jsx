"use client";

import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
    // 🛒 Carrito persistente
    const [cartItems, setCartItems] = useState(() => {
    if (typeof window !== "undefined") {
        const storedCart = localStorage.getItem("cart");
        return storedCart ? JSON.parse(storedCart) : [];
    }
    return [];
    });

    // 🧲 Drawer abierto / cerrado
    const [isCartOpen, setIsCartOpen] = useState(false);

    // 💾 Persistir carrito
    useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cartItems));
    }, [cartItems]);

    /* =========================
        Drawer controls
    ========================= */
    const openCart = () => setIsCartOpen(true);
    const closeCart = () => setIsCartOpen(false);

    /* =========================
        Cart logic
    ========================= */
    const addItem = (product) => {
    setCartItems((prev) => {
        const existing = prev.find((item) => item._id === product._id);

        if (existing) {
        return prev.map((item) =>
            item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        }

        return [
        ...prev,
        {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || null,
            quantity: 1,
        },
        ];
    });
    };

    const increase = (_id) => {
    setCartItems((prev) =>
        prev.map((item) =>
        item._id === _id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
    );
    };

    const decrease = (_id) => {
    setCartItems((prev) =>
        prev
        .map((item) =>
            item._id === _id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
    };

    const removeItem = (_id) => {
    setCartItems((prev) => prev.filter((item) => item._id !== _id));
    };

    const clearCart = () => setCartItems([]);

    /* =========================
        Helpers
    ========================= */
    const getTotalItems = () =>
    cartItems.reduce((acc, item) => acc + item.quantity, 0);

    const getTotalPrice = () =>
    cartItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
        0
    );
    /* =========================
        Checkout (crear pedido)
    ========================= */
const checkout = async ({ name, email, phone }) => {
    if (cartItems.length === 0) {
    throw new Error("El carrito está vacío");
    }

    const payload = {
    items: cartItems.map((item) => ({
      productId: item._id, // 👈 _id real de MongoDB
        quantity: item.quantity,
    })),
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    };

    const response = await fetch("http://localhost:4000/api/orders", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    });

    if (!response.ok) {
    throw new Error("Error al crear el pedido");
    }

    const order = await response.json();
    return order; // 👈 lo usamos después para Mercado Pago
};

    return (
    <CartContext.Provider
        value={{
        cartItems,
        isCartOpen,
        openCart,
        closeCart,
        addItem,
        increase,
        decrease,
        removeItem,
        clearCart,
        getTotalItems,
        getTotalPrice,
        checkout,
        }}
    >
        {children}
    </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
    throw new Error("useCart debe usarse dentro de CartProvider");
    }
    return context;
}
