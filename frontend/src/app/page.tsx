import Hero from "../modules/home/Hero";
import Products from "../modules/home/Products";
import { getProducts } from "../lib/api/products.api";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Products />
    </>
  );
}

