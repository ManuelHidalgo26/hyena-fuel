"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { trackEvent, GA_EVENTS } from "../lib/ga";
import { fbTrack } from "../lib/fbpixel";
import Toast from "../components/ui/Toast";

const CartContext = createContext(null);

/* =========================
    Envíos Córdoba (reglas)
========================= */
const FREE_SHIPPING_THRESHOLD = 160000;
const SHIPPING_COST = 5000;

/**
 * Clave compuesta del ítem de carrito (ADR 0008): `_id + flavor`. Dos sabores
 * del mismo producto son líneas distintas; un producto sin sabores usa `null`.
 */
const getCartLineKey = (id, flavor = null) => `${id}::${flavor ?? ""}`;

/**
 * Ítems del carrito en el shape que esperan los endpoints del server
 * (`POST /api/orders`, `POST /api/discount-codes/validate`): `flavor` se
 * omite cuando el ítem no tiene sabor (el schema Zod lo espera opcional,
 * nunca `null`). Compartido para no duplicar el mapeo en `CartDrawer`.
 */
export function toOrderItemsPayload(cartItems) {
  return cartItems.map((item) => ({
    productId: item._id,
    quantity: item.quantity,
    ...(item.flavor ? { flavor: item.flavor } : {}),
  }));
}

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
    const addItem = (product, flavor = null) => {
    showToast("Producto agregado al carrito");

    setCartItems((prev) => {
        const key = getCartLineKey(product._id, flavor);
        const existing = prev.find((item) => getCartLineKey(item._id, item.flavor) === key);

        // GA4
        trackEvent(GA_EVENTS.ADD_TO_CART, {
        currency: "ARS",
        value: product.price,
        items: [{ item_id: product._id, item_name: product.name, price: product.price, quantity: 1 }],
        });

        // Facebook Pixel
        fbTrack("AddToCart", {
        content_ids: [product._id],
        content_name: product.name,
        content_type: "product",
        value: product.price,
        currency: "ARS",
        });

        if (existing) {
        return prev.map((item) =>
            getCartLineKey(item._id, item.flavor) === key
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        }

        // Imagen del sabor elegido (ADR 0008); sin sabor o sin imagen propia,
        // cae a la principal del producto (mismo fallback que el swap de la PDP).
        const variant = flavor ? product.variants?.find((v) => v.name === flavor) : null;

        return [
        ...prev,
        {
            _id: product._id,
            name: product.name,
          price: product.price, // precio lista
          transferPrice: product.transferPrice ?? null, // 👈 CLAVE
            image: variant?.image ?? product.images?.[0] ?? null,
            flavor: flavor ?? null,
            quantity: 1,
        },
        ];
    });
    };

    const increase = (_id, flavor = null) => {
    const key = getCartLineKey(_id, flavor);
    setCartItems((prev) =>
        prev.map((item) =>
        getCartLineKey(item._id, item.flavor) === key
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
    );
    };

    const decrease = (_id, flavor = null) => {
    const key = getCartLineKey(_id, flavor);
    setCartItems((prev) =>
        prev
        .map((item) =>
            getCartLineKey(item._id, item.flavor) === key
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
    };

    const removeItem = (_id, flavor = null) => {
    const key = getCartLineKey(_id, flavor);
    setCartItems((prev) => prev.filter((item) => getCartLineKey(item._id, item.flavor) !== key));
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
    const checkout = async ({
        name,
        email,
        phone,
        address,
        paymentMethod,
        deliveryMethod = "envio",
        // Código de descuento aplicado en el carrito (ADR 0010, CD5). Se omite del
        // payload si viene vacío — la validación real la hace el server (§5.2).
        discountCode,
        // Nota libre del pedido (ADR 0006). Opcional — se omite del payload si viene vacía.
        note,
    }) => {
    if (cartItems.length === 0) {
        throw new Error("El carrito está vacío");
    }

    const payload = {
        items: toOrderItemsPayload(cartItems),
        customerName: name,
        customerPhone: phone,
        customerAddress: address,
        paymentMethod,
        deliveryMethod,
        // Email es opcional (ADR "contacto"): nunca mandamos "" al backend.
        ...(email && email.trim() !== "" ? { customerEmail: email.trim() } : {}),
        ...(discountCode && discountCode.trim() !== "" ? { discountCode: discountCode.trim() } : {}),
        ...(note && note.trim() !== "" ? { note: note.trim() } : {}),
    };

    const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        // La carrera perdida del cupón (HY002) y otros 409 los distingue el
        // caller por status, no por el string (CartDrawer, ADR 0010 §B.6).
        const error = new Error(data.error || "Error al crear el pedido");
        error.status = response.status;
        throw error;
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
