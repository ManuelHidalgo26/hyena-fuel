import { Payment } from "mercadopago";
import client from "../services/mercadopago.js";
import Order from "../models/Order.js";

export const handleMercadoPagoWebhook = async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type !== "payment") {
      return res.status(200).json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return res.status(200).json({ received: true });
    }

    const payment = new Payment(client);
    const paymentInfo = await payment.get({ id: String(paymentId) });

    if (paymentInfo.status === "approved") {
      const orderId = paymentInfo.external_reference;
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          status: "paid",
          paymentId: String(paymentId),
        });
        console.log(`✅ Orden ${orderId} marcada como pagada (MP ID: ${paymentId})`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(200).json({ received: true });
  }
};
