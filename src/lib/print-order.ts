// Geracao de cupom nao-fiscal para impressora termica 80mm.
// Abre um popup com HTML formatado e dispara window.print() automaticamente.

export interface OrderForPrint {
  numero: number;
  customer_name: string;
  customer_phone: string;
  total: number;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  payment_method: string;
  payment_raw: string;
  address: string;
  items: { nome: string; qty: number; preco: number }[];
  created_at: string;
  alterado_em: string | null;
  status?: string;
}

export interface RestauranteForPrint {
  nome: string;
  telefone?: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(n: number): string {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatPhone(tel: string): string {
  // Remove tudo que nao eh digito
  const clean = tel.replace(/\D/g, "");
  // Formato BR: 55 31 9XXXX XXXX ou 55 31 XXXX XXXX
  if (clean.length === 13) {
    // 55 31 9XXXX XXXX
    return `(${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12) {
    // 55 31 XXXX XXXX
    return `(${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return tel;
}

export function buildReceiptHTML(
  order: OrderForPrint,
  restaurante: RestauranteForPrint,
): string {
  const isAlterado =
    !!order.alterado_em &&
    !["entregue", "cancelado"].includes(order.status || "");
  const isCancelado = order.status === "cancelado";
  const isPix = order.payment_raw?.toLowerCase().includes("pix");
  const isDinheiro = order.payment_raw?.toLowerCase().includes("dinheiro");

  const itemsHtml = order.items
    .map(
      (i) => `
      <tr class="item">
        <td class="item-qty">${i.qty}x</td>
        <td class="item-nome">${escapeHtml(i.nome)}</td>
        <td class="item-preco">${formatMoney(i.preco * i.qty)}</td>
      </tr>`,
    )
    .join("");

  const telRestaurante = restaurante.telefone
    ? `<div class="header-sub">Tel ${escapeHtml(formatPhone(restaurante.telefone))}</div>`
    : "";

  const alertBlock = isCancelado
    ? `
      <div class="alert alert-strong">
        ### CANCELADO ###<br/>
        NAO PREPARAR<br/>
        DESCARTAR ITENS
      </div>`
    : isAlterado
      ? `
      <div class="alert">
        *** PEDIDO ALTERADO ***<br/>
        <span class="alert-sub">alterado as ${formatTime(order.alterado_em!)}</span><br/>
        <span class="alert-sub">DESCARTAR VIA ANTERIOR</span>
      </div>`
      : "";

  const pagamentoBlock = (() => {
    if (isPix) {
      return `
        <div class="section">
          <div class="label">PAGAMENTO</div>
          <div class="value">PIX</div>
          <div class="badge">*** conferir comprovante ***</div>
        </div>`;
    }
    if (isDinheiro) {
      return `
        <div class="section">
          <div class="label">PAGAMENTO</div>
          <div class="value">DINHEIRO</div>
          <div class="badge">*** verificar troco ***</div>
        </div>`;
    }
    return `
      <div class="section">
        <div class="label">PAGAMENTO</div>
        <div class="value">${escapeHtml(order.payment_method || "—")}</div>
      </div>`;
  })();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Pedido #${order.numero}</title>
<style>
  @page {
    size: 80mm auto;
    margin: 0;
  }
  * {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
  }
  body {
    font-family: 'Courier New', Consolas, 'Liberation Mono', monospace;
    font-size: 12px;
    line-height: 1.35;
    width: 72mm;
    margin: 0 auto;
    padding: 3mm 2mm 4mm;
  }
  .header {
    text-align: center;
    margin-bottom: 3mm;
  }
  .header-title {
    font-size: 15px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .header-sub {
    font-size: 11px;
    margin-top: 0.5mm;
  }
  .divider {
    border-top: 1px dashed #000;
    margin: 2mm 0;
  }
  .divider-strong {
    border-top: 2px solid #000;
    margin: 2mm 0;
  }
  .pedido-num {
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    margin: 2mm 0;
  }
  .pedido-hora {
    text-align: center;
    font-size: 11px;
  }
  .alert {
    border: 2px dashed #000;
    padding: 2mm;
    text-align: center;
    font-weight: bold;
    font-size: 13px;
    margin: 2mm 0;
  }
  .alert-strong {
    border: 3px solid #000;
    font-size: 14px;
  }
  .alert-sub {
    font-size: 10px;
    font-weight: normal;
  }
  .section {
    margin: 2mm 0;
  }
  .label {
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 1mm;
  }
  .value {
    font-size: 12px;
  }
  .badge {
    display: inline-block;
    margin-top: 1mm;
    font-size: 11px;
    font-weight: bold;
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
  }
  table.items tr.item td {
    padding: 0.5mm 0;
    vertical-align: top;
  }
  .item-qty {
    width: 8mm;
    font-weight: bold;
  }
  .item-nome {
    text-align: left;
  }
  .item-preco {
    text-align: right;
    white-space: nowrap;
    padding-left: 2mm;
  }
  .totals {
    width: 100%;
    margin-top: 1mm;
  }
  .totals tr td {
    padding: 0.3mm 0;
  }
  .totals tr td:last-child {
    text-align: right;
    white-space: nowrap;
  }
  .total-final td {
    font-size: 15px;
    font-weight: bold;
    padding-top: 1mm !important;
    border-top: 1px dashed #000;
  }
  .footer {
    text-align: center;
    font-size: 10px;
    margin-top: 3mm;
  }
  .endereco-line {
    font-size: 12px;
    word-wrap: break-word;
  }
  @media print {
    body {
      width: 72mm;
    }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-title">${escapeHtml(restaurante.nome)}</div>
    ${telRestaurante}
  </div>

  <div class="divider-strong"></div>

  <div class="pedido-num">PEDIDO #${order.numero}</div>
  <div class="pedido-hora">${formatTime(order.created_at)}</div>

  ${alertBlock}

  <div class="divider"></div>

  <div class="section">
    <div class="label">Cliente</div>
    <div class="value">${escapeHtml(order.customer_name)}</div>
    ${order.customer_phone ? `<div class="value">${escapeHtml(formatPhone(order.customer_phone))}</div>` : ""}
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="label">Itens</div>
    <table class="items">
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
  </div>

  <div class="divider"></div>

  <table class="totals">
    <tbody>
      <tr>
        <td>Subtotal</td>
        <td>${formatMoney(order.subtotal || 0)}</td>
      </tr>
      ${
        order.taxa_entrega
          ? `<tr><td>Taxa entrega</td><td>${formatMoney(order.taxa_entrega)}</td></tr>`
          : ""
      }
      ${
        order.desconto
          ? `<tr><td>Desconto</td><td>- ${formatMoney(order.desconto)}</td></tr>`
          : ""
      }
      <tr class="total-final">
        <td>TOTAL</td>
        <td>${formatMoney(order.total)}</td>
      </tr>
    </tbody>
  </table>

  <div class="divider"></div>

  ${pagamentoBlock}

  <div class="divider"></div>

  <div class="section">
    <div class="label">Endereco de Entrega</div>
    <div class="endereco-line">${escapeHtml(order.address || "—")}</div>
  </div>

  <div class="divider-strong"></div>

  <div class="footer">
    Emitido em ${formatDateTime(new Date().toISOString())}<br/>
    Delpori &middot; cupom nao fiscal
  </div>

  <script>
    window.onload = function() {
      window.focus();
      setTimeout(function() {
        window.print();
      }, 100);
      window.onafterprint = function() {
        window.close();
      };
    };
  </script>
</body>
</html>`;
}

export function printOrder(
  order: OrderForPrint,
  restaurante: RestauranteForPrint,
): void {
  const html = buildReceiptHTML(order, restaurante);
  const popup = window.open("", "_blank", "width=400,height=700");
  if (!popup) {
    // Popup bloqueado: fallback — abre numa nova aba
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}
