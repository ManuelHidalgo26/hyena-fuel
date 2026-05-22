"use client";

import { useEffect } from "react";
import { trackEvent, GA_EVENTS } from "../../../lib/ga";
import { fbTrack } from "../../../lib/fbpixel";

export default function TrackViewItem({ product }) {
  useEffect(() => {
    trackEvent(GA_EVENTS.VIEW_ITEM, {
      currency: "ARS",
      value: product.price,
      items: [{ item_id: product._id, item_name: product.name, price: product.price }],
    });

    fbTrack("ViewContent", {
      content_ids: [product._id],
      content_name: product.name,
      content_type: "product",
      value: product.price,
      currency: "ARS",
    });
  }, [product]);

  return null;
}
