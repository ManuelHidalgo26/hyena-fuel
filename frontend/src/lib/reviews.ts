export type ReviewRow = {
  id: string;
  product_id: string | null;
  name: string;
  text: string;
  rating: number;
  created_at: string;
};

export type Review = {
  _id: string;
  productId: string | null;
  name: string;
  text: string;
  rating: number;
  createdAt: string;
};

// `product_id` (ADR 0005 §4): reseña global del sitio si es null, o de un producto
// puntual si apunta a uno. La columna ya existe desde 0001_init (ADR 0002 #9).
export const REVIEW_COLUMNS = "id, product_id, name, text, rating, created_at";

export function mapReview(row: ReviewRow): Review {
  return {
    _id: row.id,
    productId: row.product_id,
    name: row.name,
    text: row.text,
    rating: row.rating,
    createdAt: row.created_at,
  };
}
