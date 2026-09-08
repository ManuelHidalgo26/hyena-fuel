export type ReviewRow = {
  id: string;
  name: string;
  text: string;
  rating: number;
  created_at: string;
};

export type Review = {
  _id: string;
  name: string;
  text: string;
  rating: number;
  createdAt: string;
};

export const REVIEW_COLUMNS = "id, name, text, rating, created_at";

export function mapReview(row: ReviewRow): Review {
  return {
    _id: row.id,
    name: row.name,
    text: row.text,
    rating: row.rating,
    createdAt: row.created_at,
  };
}
