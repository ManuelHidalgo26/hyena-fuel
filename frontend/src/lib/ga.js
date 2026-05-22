export const GA_EVENTS = {
  ADD_TO_CART: "add_to_cart",
  BEGIN_CHECKOUT: "begin_checkout",
  VIEW_ITEM: "view_item",
  PURCHASE: "purchase",
  VIEW_CART: "view_cart",
};

export function trackEvent(eventName, params = {}) {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("event", eventName, params);
}
