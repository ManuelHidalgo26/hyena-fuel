import client from "../services/mercadopago.js";
import { Preference } from "mercadopago";

export const createPaymentPreference = async (req, res) => {
  try {
    const { items, orderId, customerEmail } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Items requeridos" });
    }

    const preference = new Preference(client);

    const mpItems = items.map((item) => ({
      title: String(item.name),
      unit_price: Number(item.price),
      quantity: Number(item.quantity),
      currency_id: "ARS",
    }));

    const body = {
      items: mpItems,
      external_reference: orderId ? String(orderId) : undefined,
      back_urls: {
        success: `${process.env.FRONTEND_URL || "https://hyenafuel.com"}/gracias`,
        failure: `${process.env.FRONTEND_URL || "https://hyenafuel.com"}/`,
        pending: `${process.env.FRONTEND_URL || "https://hyenafuel.com"}/`,
      },
      auto_return: "approved",
    };

    if (customerEmail) {
      body.payer = { email: customerEmail };
    }

    if (process.env.BACKEND_URL) {
      body.notification_url = `${process.env.BACKEND_URL}/api/payments/webhook`;
    }

    const response = await preference.create({ body });

    res.json({
      preferenceId: response.id,
      checkoutUrl: response.init_point,
      sandboxUrl: response.sandbox_init_point,
    });
  } catch (error) {
    console.error("❌ ERROR MP:", error);
    console.error("❌ DATA:", error?.response?.data);
    res.status(500).json({ message: "Error creando pago" });
  }
};

