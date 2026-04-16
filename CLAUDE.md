# Delpori

> Atualizado em 15/04/2026 (v4).

## Stack

- **Front:** Next.js 16 (App Router) + React 19 + TypeScript + TailwindCSS + shadcn/ui + Recharts + react-day-picker v9
- **Back:** Supabase (Auth, Postgres 17, Storage, Realtime, Edge Functions, pg_cron)
- **Automacao:** n8n (7 workflows) + Evolution API (WhatsApp)
- **IA:** OpenAI **gpt-5-mini** (agente conversacional, maxTokens 3000, sem temperature custom) + Whisper (audio) + Vision (imagem)
- **Buffer:** Redis (Upstash) para acumular msgs rapidas no WF1

Projeto Supabase: `cxcsjxoslaxyiawynapv` (sa-east-1)

---

## Deploy

- **Producao:** https://app.delpori.com (fallback: https://delpori.vercel.app)
- **GitHub:** igortulioia-a11y/delpori (publico). Remote local: `delpori`
- **Vercel:** projeto `delpori`, conectado ao GitHub, deploy automatico via push
- **Regiao:** `gru1` (SP) em vercel.json — NUNCA mudar, Supabase esta em sa-east-1
- **Dominio:** delpori.com na Hostinger. CNAME `app` → `cname.vercel-dns.com`

```bash
git push origin main  # deploy automatico
```

---

## Fluxo de Mensagens

```
WhatsApp → Evolution API → webhook-evolution (Edge Function v15+)
  → WF1 (texto/audio/imagem + buffer Redis 10s)
  → WF2 (config + horario + prompt + cardapio + pedido recente do cliente)
  → WF3 (IA gpt-5-mini + recalculo backend + criacao/update pedidos + notificacoes)
  → WF4 (split paragrafos + envio com delay "composing")
  → WhatsApp cliente
```

Edge Function: validacao, dedup, fromMe (pausa IA), horario, rate limiting anti-spam
(>30 msgs IA em 30min → auto-pausa — calibrado 15/04/2026 pra detectar loop com IA
externa sem afetar conversa humana).

---

## Workflows n8n

| ID | Nome | Funcao |
|----|------|--------|
| DIbK0Au70wjVqjsf | WF1 - Recepcao | Gateway msgs, buffer Redis, chama WF2 |
| pyTtnCUOpoA42C6I | WF2 - Pre-IA | Config + horario + prompt + cardapio, chama WF3 |
| NTNFfiEP5v80gz5b | WF3 - IA + Pedidos | Agente IA + orders + notificacoes, chama WF4 |
| jZtheFnaCtCJcMEd | WF4 - Humanizacao | Split paragrafos + envio sequencial |
| gdrGvBBXhKwjU1Fa | WF5 - Error Handler | Captura erros, notifica admin via WA |
| WbZdMZL1vTaTz8Iu | WF8 - Limpeza | Domingo 3h: deleta chat_histories > 30 dias |
| HmcOyDFqxBTXiLwS | WF9 - Follow-up | A cada 5 min: conversas sem resposta |

---

## Edge Functions (7)

| Slug | Funcao |
|------|--------|
| webhook-evolution | Gateway: valida, deduplica, salva msg, cria conversa, encaminha n8n |
| onboarding | Trigger auth.users INSERT: profile + settings + instancia Evolution |
| get-whatsapp-qr | Gera QR code (validacao JWT manual) |
| disconnect-whatsapp | Desconecta WA (validacao JWT manual) |
| check-connection | pg_cron 1min: verifica status WA na Evolution |
| cron-retomada | pg_cron 5min: reenvia msgs pendentes |
| cron-campanhas | pg_cron 5min: processa campanhas agendadas |

---

## Banco de Dados

### Tabelas
- **profiles** — Restaurante (nome, slug, tipo, telefone_cozinha, logo_url). PK = auth.users.id
- **automation_settings** — Config IA (horario, instancia Evolution, status WA, follow-up). UNIQUE(user_id)
- **system_config** — Config global (URLs Evolution, admin WA, dominio cardapio, webhook n8n)
- **products** — Cardapio com categoria, imagem, disponivel, destaque
- **product_categories** — Categorias com ordem
- **delivery_zones** — Bairros[], taxa, tempo_estimado
- **customers** — UNIQUE(user_id, telefone). Stats recalculadas por trigger
- **conversations** — UNIQUE(user_id, cliente_tel). Status, ai_paused, needs_followup
- **messages** — Remetente: cliente/atendente/ia. Dedup parcial por whatsapp_msg_id
- **orders** — Status: novo→em_preparo→saiu_entrega→entregue→cancelado. Obs: o enum Postgres `order_status` ainda tem `confirmado` (legacy — 1 pedido historico de outro user). Front nao usa mais esse status, IA nao move pra ele, prompt WF2 nao menciona mais.
- **order_items** — FK orders CASCADE, products SET NULL. Coluna `opcoes_selecionadas` (JSONB, nullable) — fase 1: pode ficar null. Fase 2: IA via WF3 preenche ao parsear mensagem do cardapio.
- **campaigns** — Campanhas em massa (rascunho/agendada/enviada)
- **campaign_messages** — Msgs individuais de campanha
- **team_members** — Membros com permissoes por aba
- **faqs** — Perguntas frequentes por restaurante
- **daily_specials** — Promoção do dia por dia da semana. UNIQUE(user_id, dia_semana). FK products CASCADE
- **product_options** — Opcoes/complementos de produtos. Grupos (Tamanho, Adicionais) com min/max escolhas e preco_adicional. FK products CASCADE. RLS: tenant (ALL) + leitura publica (SELECT disponivel=true). Admin: CRUD via Sheet side=right em /produtos. Cardapio: Sheet bottom de selecao.
- **n8n_chat_histories** — Memoria do agente IA (sessao delivery:{userId}:{tel})
- **error_logs** — Logs de erro dos workflows

### Triggers
- `on_auth_user_created` → handle_new_user_onboarding()
- `trg_update_conversation_on_message` → atualiza ultima_mensagem, nao_lidas
- `trg_update_customer_stats` → recalcula stats do customer

### RLS
Padrao: `auth.uid() = user_id`. Excecoes: profiles/products leitura publica, error_logs/chat_histories so service_role.

### Storage
Bucket `product-images` (publico). RLS INSERT exige path `{userId}/...`. Upload logo: `{userId}/logo.ext`.

---

## Frontend — Rotas

### Dashboard (autenticado)
| Rota | Funcao |
|------|--------|
| / | KPIs + graficos + top 5 itens. DateRangePicker profissional com 7 presets (Hoje / Ontem / Ultimos 7 dias / Ultimos 30 dias / Este mes / Mes passado / Personalizado com calendario range). Query ajusta group-by por hora (range <= 1 dia) ou por dia. |
| /conversas | Mobile: toggle lista/chat com botao voltar. Desktop: 3 colunas. Sheet detalhes < xl. Aceita `?tel=` pra auto-selecionar conversa. |
| /pedidos | Kanban (query separada pra status ativos, limit 200) + tabela com filtros server-side (data + status) e paginacao server-side real (count exact). Smart display de data: "Hoje HH:MM" / "Ontem HH:MM" / "DD/MM HH:MM". Botao "Conversa" nos cards abre a conversa do cliente. Observacoes dos itens exibidas no kanban, sheet e cupom termico. Edicao manual preserva observacoes. |
| /produtos | Grid responsivo. CRUD + upload imagem. Categorias. Edit/delete visivel no mobile. Botao "Opcoes" (ListPlus) no card e no Sheet de detalhes → abre Sheet side=right com CRUD de grupos e valores (ProductOptionsManager.tsx extraido como componente). |
| /automacoes | Aba Atendimento (perfil IA, horario, entrega, formas de pagamento) + Aba Campanhas. **Campo "Detalhes para a IA" removido** em 15/04/2026 — nao era mais lido pelo prompt. |
| /configuracoes | Aba Restaurante + Aba WhatsApp (QR) + Aba Usuarios |

### Publico
| Rota | Funcao |
|------|--------|
| /cardapio/[slug] | Cardapio digital. Carrinho React state (CartContext com cartItemId + selectedOptions). Busca + categorias. Produto com opcoes: Sheet bottom de selecao (radio/checkbox, min/max, preco dinamico). Produto sem opcoes: add direto. |
| /cardapio/[slug]/checkout | Checkout: dados entrega, zona, pagamento. Abre wa.me com texto formatado (NAO cria pedido no banco). Opcoes formatadas como `  + Nome (+R$ X,XX)` na mensagem WA. |
| /login | Login + cadastro + recuperacao senha |
| /reset-password | Solicitar reset de senha (envia email) |
| /update-password | Definir nova senha (link do email) |

### API Routes
| Rota | Funcao |
|------|--------|
| /api/send-whatsapp | Envia WhatsApp via Evolution (requer auth) |
| /api/send-campaign-message | Envia msg individual de campanha via Evolution (requer auth) |
| /api/invite-member | CRUD membros da equipe (requer auth) |
| /api/restaurant-phone | Retorna telefone do restaurante por slug (publico) |
| /api/import-menu | Importar cardapio do UaiRango (requer auth) |

---

## Infraestrutura Externa

- **Evolution API:** https://consultoria-evolution-api.vprt3o.easypanel.host
- **n8n:** https://n8n-v2-n8n.vprt3o.easypanel.host — usar skill `n8n-workflow-manager`
- **Redis:** Upstash (buffer mensagens WF1)
- **OpenAI:** gpt-5-mini (chat) + Whisper (audio) + Vision (imagem)

---

## Convencoes de Codigo

### Responsividade
- Breakpoint mobile/desktop: `md` (768px) — consistente em todo o app
- Breakpoint 3 colunas: `xl` (1280px) — conversas painel detalhes
- Sidebar: `hidden md:flex` (desktop fixo) / drawer mobile com overlay
- Padding paginas: `p-4 md:p-6`
- Headers: `flex flex-col sm:flex-row sm:items-center justify-between gap-3`

### Dark Mode
- Cores de status/badges: sempre incluir variantes `dark:`
- Padrao: `bg-{cor}-100 dark:bg-{cor}-900/50 text-{cor}-700 dark:text-{cor}-300`
- Borders: `border-{cor}-200 dark:border-{cor}-800`
- Status de pedidos/campanhas: definidos em `src/lib/status-colors.ts`

### Componentes
- Paginas dashboard: tudo inline (sem componentes separados por pagina)
- Sheet (shadcn): usado para detalhes mobile em conversas e pedidos
- Dialog (shadcn): usado para CRUD (produtos, categorias, campanhas)

---

## Regras de negocio atuais (calibradas 15/04/2026)

### Pagamento
- **Sempre no ato da entrega**, via maquininha que o entregador leva (aceita PIX, credito, debito) ou dinheiro.
- **Nunca** pagamento antecipado (nem PIX antes, nem transferencia, nem link de pagamento).
- IA nunca envia chave PIX nem QR code pelo chat.
- As formas de pagamento aceitas sao as ativadas no painel `/automacoes` (CSV em `automation_settings.formas_pagamento`). O prompt WF2 gera regras dinamicas conforme o que esta ativo.
- A coluna `automation_settings.detalhes_pagamento` continua no banco mas **nao e mais lida nem escrita** pelo front nem pelo prompt (removida em 15/04/2026).

### Alteracao de pedido pela IA
- IA tem contexto do "Pedido Recente do Cliente" (ultimas 24h) injetado no prompt via `Supabase — Buscar Pedido Recente` no WF2.
- Regras de decisao baseadas no `STATUS LITERAL NO BANCO`:
  - `novo` + <30min → IA altera sozinha, gera novo `##PEDIDO_CONFIRMADO##`. WF3 detecta pedido recente e faz UPDATE em vez de INSERT.
  - `novo` + >=30min, `em_preparo`, `saiu_entrega` → chamar humano.
  - `entregue` → tratar reclamacao ou pedido novo. `cancelado` → oferecer novo pedido.

### Nome do cliente no pedido
- IA pergunta "em qual nome fica o pedido?" antes de confirmar.
- JSON `##PEDIDO_CONFIRMADO##` tem campo `nome_cliente`.
- `Extrair Pedido do Output` (WF3) expoe `pedidoNomeClienteSafe` como campo top-level.
- `Salvar Customer` e `Salvar/Atualizar Conversa` usam `CASE` pra priorizar `pedidoNomeClienteSafe` sobre `pushName_safe`. **Nao abrir esses 2 nodes na UI do n8n** — abrir e fechar pode reverter o patch (bug conhecido).

### Calculo de totais
- Prompt WF2 tem regra curta orientando a IA a recalcular do zero em alteracoes (nao usar total antigo como base).
- **Backend recalcula sempre** no `Extrair Pedido do Output` do WF3 como rede de seguranca: `subtotal = sum(item.preco_unit * quantidade)`, `total = subtotal + taxa_entrega`. Se o JSON da IA divergir, sobrescreve antes de salvar. Flags `calculoCorrigido`, `diferencaSubtotal`, `diferencaTotal` disponiveis no output.

### Upsell
- Ao sugerir complemento, IA **PARA** a mensagem apos a pergunta e aguarda resposta do cliente. NAO junta upsell com coleta de endereco/pagamento/nome na mesma mensagem.

---

## Cuidados

- **Prompt IA (WF2):** OBRIGATÓRIO salvar backup em `memory/backup_wf2_prompt_{data}.txt` ANTES de qualquer alteração. Ler inteiro antes de editar. Nunca remover regras sem entender. Node "Montar Prompt com FAQs e Cardapio" no WF2. Ver `memory/feedback_cuidados_prompt.md` para regras completas. Sempre rodar `node --check` no jsCode wrapped em `async function test(){...}` pra validar sintaxe antes do PUT — **nunca usar triple backticks (```)** dentro do template literal do systemPrompt, eles quebram o template.
- **memory/ esta no .gitignore** — backups locais, nao commitar. Historico fica no disco do Igor. Nao expor no repo publico (contem logica comercial do prompt).
- **Nodes postgres/langchain no n8n (WF3):** abrir um node `lmChatOpenAi` ou `postgres` no editor visual pode re-serializar parameters com defaults e reverter patches aplicados via API. Evitar abrir `OpenAI gpt-5-mini`, `Supabase — Salvar Customer` e `Supabase — Salvar/Atualizar Conversa` pela UI. Se precisar mexer, pedir pro Claude fazer via API.
- **Vercel region:** Se recriar projeto, regiao volta pra iad1 (EUA). vercel.json previne em deploys normais.
- **Remote git:** `origin` = repo correto (`igortulioia-a11y/delpori`). `memory/` ignorado.
- **Dev server:** usar `preview_start` (shadcn MCP) com `launch.json` — NUNCA rodar `next dev` via Bash.
