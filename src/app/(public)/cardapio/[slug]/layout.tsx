import { CartProvider } from "@/contexts/CartContext";

export default function CardapioLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
