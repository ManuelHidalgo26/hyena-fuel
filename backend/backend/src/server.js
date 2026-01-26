import connectDB from "./config/db.js";
import app from "./app.js";

const PORT = process.env.PORT;

if (!PORT) {
    console.error("❌ PORT no definido");
    process.exit(1);
}

app.listen(PORT, () => {
    console.log(`🔥 Backend HYENA FUEL corriendo en puerto ${PORT}`);
});
