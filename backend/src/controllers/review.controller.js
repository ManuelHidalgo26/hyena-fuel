import Review from "../models/Review.js";

export const getApprovedReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ approved: true }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Error obteniendo reseñas" });
  }
};

export const getPendingReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ approved: false }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Error obteniendo reseñas" });
  }
};

export const submitReview = async (req, res) => {
  try {
    const { name, text, rating } = req.body;

    if (!name?.trim() || !text?.trim()) {
      return res.status(400).json({ message: "Nombre y comentario son requeridos" });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Puntuación inválida" });
    }

    await Review.create({ name: name.trim(), text: text.trim(), rating });
    res.status(201).json({ message: "Reseña enviada, será publicada pronto" });
  } catch (error) {
    res.status(500).json({ message: "Error enviando reseña" });
  }
};

export const approveReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { approved: true },
      { new: true }
    );
    if (!review) return res.status(404).json({ message: "Reseña no encontrada" });
    res.json(review);
  } catch (error) {
    res.status(500).json({ message: "Error aprobando reseña" });
  }
};

export const deleteReview = async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: "Reseña eliminada" });
  } catch (error) {
    res.status(500).json({ message: "Error eliminando reseña" });
  }
};
