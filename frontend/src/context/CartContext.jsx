"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { trackEvent, GA_EVENTS } from "../lib/ga";
import Toast from "../components/ui/Toast";

const CartContext = createContext(null);

/* =========================
    Envíos Córdoba (reglas)
========================= */
const FREE_SHIPPING_THRESHOLD = 120000;
const SHIPPING_COST = 5000;

export function CartProvider({ children }) {
    /* =========================
        State
    ========================= */
    const [cartItems, setCartItems] = useState(() => {
    if (typeof window !== "undefined") {
        const storedCart = localStorage.getItem("cart");
        return storedCart ? JSON.parse(storedCart) : [];
    }
    return [];
    });

    const [isCartOpen, setIsCartOpen] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cartItems));
    }, [cartItems]);

    const openCart = () => setIsCartOpen(true);
    const closeCart = () => setIsCartOpen(false);

    const showToast = (message) => setToast(message);

    /* =========================
        Cart logic
    ========================= */
    const addItem = (product) => {
    showToast("Producto agregado al carrito");

    setCartItems((prev) => {
        const existing = prev.find((item) => item._id === product._id);

        // GA
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
          price: product.price, // precio lista
          transferPrice: product.transferPrice ?? null, // 👈 CLAVE
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
        Helpers generales
    ========================= */
    const getTotalItems = () =>
    cartItems.reduce((acc, item) => acc + item.quantity, 0);

    const getTotalPrice = () =>
    cartItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
        0
    );

    /* =========================
        🔥 PRECIOS SEGÚN MÉTODO
    ========================= */
    const getSubtotalByPaymentMethod = (paymentMethod) => {
    return cartItems.reduce((acc, item) => {
        const priceToUse =
        paymentMethod === "transferencia" &&
        typeof item.transferPrice === "number"
            ? item.transferPrice
            : item.price;

      return acc + priceToUse * item.quantity;
    }, 0);
    };

    const getDiscountByPaymentMethod = (paymentMethod) => {
    if (paymentMethod !== "transferencia") return 0;

    return cartItems.reduce((acc, item) => {
        if (typeof item.transferPrice !== "number") return acc;
      return acc + (item.price - item.transferPrice) * item.quantity;
    }, 0);
    };

    /* =========================
        Envío Córdoba
    ========================= */
    const getShippingCost = (paymentMethod = "mercadopago") => {
    const subtotal = getSubtotalByPaymentMethod(paymentMethod);
    return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    };

    const getMissingForFreeShipping = (paymentMethod = "mercadopago") => {
    const subtotal = getSubtotalByPaymentMethod(paymentMethod);
    return subtotal >= FREE_SHIPPING_THRESHOLD
        ? 0
        : FREE_SHIPPING_THRESHOLD - subtotal;
    };

    /* =========================
        Checkout
    ========================= */
    const checkout = async ({ name, email, phone, paymentMethod }) => {
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
        paymentMethod,
    };

    const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/orders`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Error al crear el pedido");
    }

    return data;
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

        // 🔥 clave para el drawer
        getSubtotalByPaymentMethod,
        getDiscountByPaymentMethod,
        getShippingCost,
        getMissingForFreeShipping,

        checkout,
        }}
    >
        {children}

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
