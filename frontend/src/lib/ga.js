// lib/ga.js

export const GA_EVENTS = {
    ADD_TO_CART: "add_to_cart",
    BEGIN_CHECKOUT: "begin_checkout",
};

export function trackEvent(eventName, params = {}) {
    if (typeof window === "undefined") return;
    if (!window.gtag) return;

    window.gtag("event", eventName, params);
}
