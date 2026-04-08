# Delpori

> Atualizado em 07/04/2026 (v3).

## Stack

- **Front:** Next.js 16 (App Router) + React 19 + TypeScript + TailwindCSS + shadcn/ui + Recharts
- **Back:** Supabase (Auth, Postgres 17, Storage, Realtime, Edge Functions, pg_cron)
- **Automacao:** n8n (7 workflows) + Evolution API (WhatsApp)
- **IA:** OpenAI GPT-4o-mini (agente conversacional + Whisper audio + Vision imagem)
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
WhatsApp → Evolution API → webhook-evolution (Edge Function v14)
  → WF1 (texto/audio/imagem + buffer Redis 10s)
  → WF2 (config + horario + prompt + cardapio)
  → WF3 (IA GPT-4o-mini + criacao pedidos + notificacoes)
  → WF4 (split paragrafos + envio com delay "composing")
  → WhatsApp cliente
```

Edge Function: validacao, dedup, fromMe (pausa IA), horario, rate limiting (>8 IA/5min → auto-pausa).

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
- **orders** — Status: novo→confirmado→em_preparo→saiu_entrega→entregue→cancelado
- **order_items** — FK orders CASCADE, products SET NULL
- **campaigns** — Campanhas em massa (rascunho/agendada/enviada)
- **campaign_messages** — Msgs individuais de campanha
- **team_members** — Membros com permissoes por aba
- **faqs** — Perguntas frequentes por restaurante
- **daily_specials** — Promoção do dia por dia da semana. UNIQUE(user_id, dia_semana). FK products CASCADE
- **product_options** — Opcoes/complementos de produtos (estrutura pronta, sem uso ativo)
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
| / | KPIs, graficos, top 5 itens, resumo 7 dias |
| /conversas | Mobile: toggle lista/chat com botao voltar. Desktop: 3 colunas. Sheet detalhes < xl |
| /pedidos | Kanban + tabela responsiva. Status via dropdown. Detalhes em Sheet |
| /produtos | Grid responsivo. CRUD + upload imagem. Categorias. Edit/delete visivel no mobile |
| /automacoes | Aba Atendimento (perfil IA, horario, entrega) + Aba Campanhas |
| /configuracoes | Aba Restaurante + Aba WhatsApp (QR) + Aba Usuarios |

### Publico
| Rota | Funcao |
|------|--------|
| /cardapio/[slug] | Cardapio digital. Carrinho React state. Busca + categorias |
| /cardapio/[slug]/checkout | Checkout: dados entrega, zona, pagamento. Cria pedido via Supabase + link WA |
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
- **OpenAI:** GPT-4o-mini + Whisper + Vision

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

## Cuidados

- **Prompt IA (WF2):** OBRIGATÓRIO salvar backup em `memory/backup_wf2_prompt_{data}.txt` ANTES de qualquer alteração. Ler inteiro antes de editar. Nunca remover regras sem entender. Node "Montar Prompt com FAQs e Cardapio" no WF2. Ver `memory/feedback_cuidados_prompt.md` para regras completas.
- **Vercel region:** Se recriar projeto, regiao volta pra iad1 (EUA). vercel.json previne em deploys normais.
- **Remote git:** `origin` = repo correto (`igortulioia-a11y/delpori`).
