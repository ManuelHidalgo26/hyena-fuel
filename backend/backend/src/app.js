import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";

dotenv.config();

const app = express();

/* =========================
    Middlewares globales
========================= */
app.use(cors());
app.use(express.json());
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
/* =========================
    Healthcheck
========================= */
app.get("/health", (req, res) => {
    res.status(200).json({
    status: "ok",
    service: "HYENA FUEL API",
    timestamp: new Date().toISOString(),
    });
});

import routes from "./routes.js";

app.use("/api", routes);

export default app;
