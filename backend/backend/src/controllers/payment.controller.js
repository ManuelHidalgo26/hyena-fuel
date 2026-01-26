import client from "../services/mercadopago.js";
import { Preference } from "mercadopago";

export const createPaymentPreference = async (req, res) => {
  try {
    const preference = new Preference(client);

    const response = await preference.create({
      body: {
        items: [
          {
            title: "Test HYENA",
            unit_price: 1000,
            quantity: 1,
            currency_id: "ARS",
          },
        ],
      },
    });

    res.json({
      sandbox: response.sandbox_init_point,
      prod: response.init_point,
    });
  } catch (error) {
    console.error("❌ ERROR MP:", error);
    console.error("❌ DATA:", error?.response?.data);
    res.status(500).json({ message: "Error creando pago" });
  }
};

