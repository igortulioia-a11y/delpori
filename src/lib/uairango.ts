/**
 * Cliente da API UaiRango Connect
 * Docs: https://www.uairango.com/connect/documentacao
 *
 * Ambiente: producao por padrao. Para dev, setar header x-env: development
 * Auth: OAuth2 com clientId + clientSecret + token do estabelecimento
 */

const UAIRANGO_BASE_URL = "https://www.uairango.com/connect";

// ─── Types da API UaiRango ──────────────────────────────────────────────────

export interface UaiRangoTokenResponse {
  accessToken: string;
  refreshToken?: string;
  type: string;
  expiresIn: number;
}

export interface UaiRangoMerchant {
  id: string;
  name: string;
  corporateName: string;
}

export interface UaiRangoCatalog {
  catalogId: string;
  context: string;
  status: string;
  groupId?: string;
  modifiedAt?: string;
}

export interface UaiRangoCategory {
  id: string;
  name: string;
  externalCode?: string;
  status: string;
  template?: string;
  items?: UaiRangoItem[];
}

export interface UaiRangoItem {
  id: string;
  name: string;
  description?: string;
  externalCode?: string;
  status: string;
  price?: {
    value: number;
    originalValue?: number;
  };
  image?: {
    path: string;
    url?: string;
  };
  options?: UaiRangoOption[];
}

export interface UaiRangoOption {
  id: string;
  name: string;
  status: string;
  price?: {
    value: number;
  };
}

// ─── Type normalizado pra importacao ────────────────────────────────────────

export interface ImportMenuItem {
  externalId: string;
  nome: string;
  descricao: string | null;
  preco: number;
  categoria: string;
  imagemUrl: string | null;
}

export interface ImportMenuResult {
  success: boolean;
  restaurante: string;
  items: ImportMenuItem[];
  error?: string;
}

// ─── Cliente API ────────────────────────────────────────────────────────────

export class UaiRangoClient {
  private accessToken: string | null = null;

  constructor(
    private clientId: string,
    private clientSecret: string
  ) {}

  /**
   * Autentica com OAuth usando o token do estabelecimento
   */
  async authenticate(merchantToken: string): Promise<void> {
    const res = await fetch(`${UAIRANGO_BASE_URL}/authentication/v1.0/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grantType: "authorization_code",
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        authorizationCode: merchantToken,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Erro ao autenticar no UaiRango: ${res.status} - ${err}`);
    }

    const data: UaiRangoTokenResponse = await res.json();
    this.accessToken = data.accessToken;
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.accessToken) throw new Error("UaiRango: nao autenticado");

    const res = await fetch(`${UAIRANGO_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`UaiRango API ${path}: ${res.status} - ${err}`);
    }

    return res.json();
  }

  /**
   * Lista estabelecimentos vinculados ao token
   */
  async getMerchants(): Promise<UaiRangoMerchant[]> {
    return this.request<UaiRangoMerchant[]>("/merchant/v1.0/merchants");
  }

  /**
   * Lista catalogos de um estabelecimento
   */
  async getCatalogs(merchantId: string): Promise<UaiRangoCatalog[]> {
    return this.request<UaiRangoCatalog[]>(
      `/catalog/v2.0/merchants/${merchantId}/catalogs`
    );
  }

  /**
   * Lista categorias com produtos de um catalogo
   */
  async getCategories(merchantId: string, catalogId: string): Promise<UaiRangoCategory[]> {
    return this.request<UaiRangoCategory[]>(
      `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories?includeItems=true`
    );
  }

  /**
   * Busca cardapio completo: autentica → merchants → catalogs → categories+items
   * Retorna items normalizados prontos pra importar
   */
  async fetchMenu(merchantToken: string): Promise<ImportMenuResult> {
    // 1. Autenticar
    await this.authenticate(merchantToken);

    // 2. Pegar estabelecimentos
    const merchants = await this.getMerchants();
    if (!merchants.length) {
      return { success: false, restaurante: "", items: [], error: "Nenhum estabelecimento encontrado" };
    }

    const merchant = merchants[0];

    // 3. Pegar catalogos
    const catalogs = await this.getCatalogs(merchant.id);
    if (!catalogs.length) {
      return { success: false, restaurante: merchant.name, items: [], error: "Nenhum catalogo encontrado" };
    }

    // 4. Pegar categorias com items de todos os catalogos
    const allItems: ImportMenuItem[] = [];

    for (const catalog of catalogs) {
      const categories = await this.getCategories(merchant.id, catalog.catalogId);

      for (const category of categories) {
        if (!category.items?.length) continue;

        for (const item of category.items) {
          if (item.status !== "AVAILABLE") continue;

          allItems.push({
            externalId: item.id,
            nome: item.name,
            descricao: item.description ?? null,
            preco: item.price?.value ?? 0,
            categoria: category.name,
            imagemUrl: item.image?.url ?? item.image?.path ?? null,
          });
        }
      }
    }

    return {
      success: true,
      restaurante: merchant.name,
      items: allItems,
    };
  }
}
