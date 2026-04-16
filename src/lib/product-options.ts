// Helpers e tipos do sistema de opcoes/adicionais de produto.
// Usado pelo cardapio publico (selecao), CartContext (carrinho)
// e ProductOptionsManager (admin CRUD).

export interface ProductOption {
  id: string;
  user_id: string;
  product_id: string | null;
  grupo: string;
  nome: string;
  preco_adicional: number;
  disponivel: boolean;
  min_escolhas: number;
  max_escolhas: number;
  criado_em: string;
}

// Derivado em memoria: agrupa rows por `grupo`. min/max vem da primeira row do grupo.
export interface ProductOptionGroup {
  grupo: string;
  min_escolhas: number;
  max_escolhas: number;
  options: ProductOption[];
}

// Persistido em CartItem.selectedOptions e futuro order_items.opcoes_selecionadas.
export interface SelectedOption {
  grupo: string;
  nome: string;
  preco_adicional: number;
}

/**
 * Agrupa rows de product_options por `grupo`, mantendo a ordem estavel
 * (o chamador deve ter ordenado por grupo e criado_em na query).
 * Rows com disponivel=false sao filtradas.
 */
export function groupProductOptions(rows: ProductOption[]): ProductOptionGroup[] {
  const map = new Map<string, ProductOptionGroup>();
  for (const row of rows) {
    if (!row.disponivel) continue;
    const g = map.get(row.grupo);
    if (g) {
      g.options.push(row);
    } else {
      map.set(row.grupo, {
        grupo: row.grupo,
        min_escolhas: row.min_escolhas ?? 0,
        max_escolhas: row.max_escolhas ?? 1,
        options: [row],
      });
    }
  }
  return Array.from(map.values());
}

/**
 * Hash deterministico das opcoes selecionadas — usado pra decidir se um novo
 * add no carrinho deve fazer merge (somar qty) ou criar linha nova.
 * Dois CartItems do mesmo produto com opcoes identicas = mesmo hash.
 */
export function hashSelectedOptions(selected: SelectedOption[] | undefined | null): string {
  if (!selected || selected.length === 0) return "";
  return [...selected]
    .map((s) => `${s.grupo}::${s.nome}`)
    .sort()
    .join("|");
}

/**
 * Preco unitario de um CartItem: preco base + soma dos preco_adicional das
 * opcoes selecionadas. Ignora qty — multiplicar depois.
 */
export function unitPriceWithOptions(
  baseProductPrice: number,
  selected: SelectedOption[] | undefined | null
): number {
  const extras = (selected ?? []).reduce(
    (sum, s) => sum + (Number(s.preco_adicional) || 0),
    0
  );
  return Number(baseProductPrice) + extras;
}
