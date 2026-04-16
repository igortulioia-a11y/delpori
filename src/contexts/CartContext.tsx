"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  hashSelectedOptions,
  unitPriceWithOptions,
  type SelectedOption,
} from "@/lib/product-options";

export interface Product {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  categoria: string;
  imagem_url: string;
  disponivel: boolean;
}

export interface CartItem {
  cartItemId: string; // uuid local — identifica a linha no carrinho (suporta mesmo produto com opcoes diferentes)
  product: Product;
  quantity: number;
  observation: string;
  selectedOptions: SelectedOption[];
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, selectedOptions?: SelectedOption[]) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateObservation: (cartItemId: string, observation: string) => void;
  clearCart: () => void;
  syncCart: (catalog: Product[]) => void;
  totalItems: number;
  totalPrice: number;
}

const CART_STORAGE_KEY = "delpori-cart";

const CartContext = createContext<CartContextType | null>(null);

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Hidrata do localStorage e migra silenciosamente qualquer item antigo
// (sem cartItemId / sem selectedOptions) pra nova estrutura.
function hydrateFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];
    const raw = JSON.parse(stored);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((it: any) => it && it.product)
      .map((it: any) => ({
        cartItemId: typeof it.cartItemId === "string" ? it.cartItemId : genId(),
        product: it.product,
        quantity: typeof it.quantity === "number" && it.quantity > 0 ? it.quantity : 1,
        observation: typeof it.observation === "string" ? it.observation : "",
        selectedOptions: Array.isArray(it.selectedOptions) ? it.selectedOptions : [],
      }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(hydrateFromStorage);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const addItem = (product: Product, selectedOptions: SelectedOption[] = []) => {
    const targetHash = hashSelectedOptions(selectedOptions);
    setItems(prev => {
      const existing = prev.find(
        i =>
          i.product.id === product.id &&
          hashSelectedOptions(i.selectedOptions) === targetHash
      );
      if (existing) {
        return prev.map(i =>
          i.cartItemId === existing.cartItemId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          cartItemId: genId(),
          product,
          quantity: 1,
          observation: "",
          selectedOptions,
        },
      ];
    });
  };

  const removeItem = (cartItemId: string) => {
    setItems(prev => prev.filter(i => i.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) return removeItem(cartItemId);
    setItems(prev => prev.map(i => i.cartItemId === cartItemId ? { ...i, quantity } : i));
  };

  const updateObservation = (cartItemId: string, observation: string) => {
    setItems(prev => prev.map(i => i.cartItemId === cartItemId ? { ...i, observation } : i));
  };

  const clearCart = () => {
    setItems([]);
    try { localStorage.removeItem(CART_STORAGE_KEY); } catch {}
  };

  // Re-sincroniza itens do carrinho com o catalogo atual do cardapio.
  // Necessario porque o carrinho fica no localStorage: se o admin alterar preco/nome
  // entre o cliente adicionar ao carrinho e finalizar, o item fica com dado antigo.
  // Remove itens que nao estao mais no catalogo (produto excluido ou indisponivel).
  const syncCart = (catalog: Product[]) => {
    if (!catalog || catalog.length === 0) return;
    const byId = new Map(catalog.map(p => [p.id, p]));
    setItems(prev => {
      const next: CartItem[] = [];
      for (const item of prev) {
        const current = byId.get(item.product.id);
        if (!current) continue; // produto saiu do cardapio: remove
        const mudou =
          current.preco !== item.product.preco ||
          current.nome !== item.product.nome ||
          current.descricao !== item.product.descricao ||
          current.imagem_url !== item.product.imagem_url ||
          current.categoria !== item.product.categoria;
        next.push(mudou ? { ...item, product: current } : item);
      }
      return next;
    });
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce(
    (sum, i) => sum + unitPriceWithOptions(i.product.preco, i.selectedOptions) * i.quantity,
    0
  );

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, updateObservation, clearCart, syncCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
