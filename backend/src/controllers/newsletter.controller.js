import Newsletter from "../models/Newsletter.js";

export const getSubscribers = async (req, res) => {
  try {
    const subscribers = await Newsletter.find().sort({ createdAt: -1 });
    res.json(subscribers);
  } catch (error) {
    console.error("❌ Error obteniendo suscriptores:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

export const subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Email inválido" });
    }

    await Newsletter.create({ email });
    res.status(201).json({ message: "Suscripción exitosa" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Ya estás suscripto" });
    }
    console.error("❌ Error newsletter:", error);
    res.status(500).json({ message: "Error interno" });
  }
};
