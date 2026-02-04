"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { trackEvent, GA_EVENTS } from "../lib/ga";
import Toast from "../components/ui/Toast";

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

    // 🔔 Toast feedback
    const [toast, setToast] = useState(null);

    useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cartItems));
    }, [cartItems]);

    const openCart = () => setIsCartOpen(true);
    const closeCart = () => setIsCartOpen(false);

    /* =========================
        Toast helper
    ========================= */
    const showToast = (message) => {
    setToast(message);
    };

    /* =========================
        Cart logic
    ========================= */
    const addItem = (product) => {
    // 🔔 Feedback inmediato
    showToast("Producto agregado al carrito");

    setCartItems((prev) => {
        const existing = prev.find((item) => item._id === product._id);

        // 📊 GA — add_to_cart
        trackEvent(GA_EVENTS.ADD_TO_CART, {
        currency: "ARS",
        value: product.price,
        items: [
            {
            item_id: product._id,
            item_name: product.name,
            price: product.price,
            quantity: 1,
            },
        ],
        });

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
        productId: item._id,
        quantity: item.quantity,
        })),
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
    };

    const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/orders`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        }
    );

    if (!response.ok) {
        throw new Error("Error al crear el pedido");
    }

    return response.json();
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

        {/* 🔔 Toast global */}
        {toast && (
        <Toast
            message={toast}
            onClose={() => setToast(null)}
        />
        )}
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
