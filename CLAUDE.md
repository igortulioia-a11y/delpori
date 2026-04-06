# DeliveryHub

> Atualizado em 06/04/2026 (v2).

## Stack

- **Front:** Next.js 16 (App Router) + React 19 + TypeScript + TailwindCSS + shadcn/ui + Recharts
- **Back:** Supabase (Auth, Postgres 17, Storage, Realtime, Edge Functions, pg_cron)
- **Automacao:** n8n (7 workflows) + Evolution API (WhatsApp)
- **IA:** OpenAI GPT-4o-mini (agente conversacional + Whisper audio + Vision imagem)
- **Buffer:** Redis (Upstash) para acumular msgs rapidas no WF1

Projeto Supabase: `cxcsjxoslaxyiawynapv` (sa-east-1)
Deploy: https://delivery-hub-seven.vercel.app

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

Edge Function: validacao, dedup, fromMe (pausa IA), horario, rate limiting anti-spam (>8 IA/5min → auto-pausa).

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
| webhook-evolution | Gateway central: valida, deduplica, salva msg, cria conversa, encaminha p/ n8n |
| onboarding | Trigger auth.users INSERT: cria profile + settings + instancia Evolution |
| get-whatsapp-qr | Gera QR code (validacao JWT manual) |
| disconnect-whatsapp | Desconecta WA (validacao JWT manual) |
| check-connection | pg_cron 1min: verifica status WA na Evolution |
| cron-retomada | pg_cron 5min: reenvia msgs pendentes ao abrir |
| cron-campanhas | pg_cron 5min: processa campanhas agendadas |

---

## Banco de Dados

### Tabelas
- **profiles** — Restaurante (nome, slug, tipo, telefone_cozinha, descricao). PK = auth.users.id
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
- **n8n_chat_histories** — Memoria do agente IA (sessao delivery:{userId}:{tel})
- **error_logs** — Logs de erro dos workflows

### Triggers
- `on_auth_user_created` → handle_new_user_onboarding()
- `trg_update_conversation_on_message` → atualiza ultima_mensagem, nao_lidas
- `trg_update_customer_stats` → recalcula stats do customer

### RLS
Padrao: `auth.uid() = user_id`. Excecoes: profiles/products leitura publica, error_logs/chat_histories so service_role.

---

## Frontend — Rotas

### Dashboard (autenticado)
| Rota | Funcao |
|------|--------|
| / | KPIs, graficos, top 5 itens, resumo 7 dias |
| /conversas | 3 colunas: lista + chat + detalhes (Sheet drawer em < xl). Toggle IA/Humano |
| /pedidos | Kanban + tabela. Troca status. Detalhes em drawer |
| /produtos | Grid cards. CRUD + upload imagem. Categorias. Toggle disponivel |
| /automacoes | Aba Atendimento (perfil IA, horario, entrega) + Aba Campanhas |
| /configuracoes | Aba Restaurante + Aba WhatsApp (QR) + Aba Usuarios |

### Publico
| Rota | Funcao |
|------|--------|
| /cardapio/[slug] | Cardapio digital. Carrinho React state. Busca + categorias |
| /cardapio/[slug]/checkout | Checkout: dados entrega, zona, pagamento. POST /api/checkout |
| /login | Login + cadastro + recuperacao senha |

### API Routes
| Rota | Funcao |
|------|--------|
| /api/send-whatsapp | Envia WhatsApp via Evolution (requer auth) |
| /api/checkout | Checkout publico. Cria order + notifica cliente e cozinha |
| /api/invite-member | CRUD membros da equipe (requer auth) |

---

## Deploy e Infraestrutura

- **Vercel:** `vercel.json` com `regions: ["gru1"]` (SP). NUNCA mudar — Supabase esta em sa-east-1
- **Evolution API:** https://consultoria-evolution-api.vprt3o.easypanel.host
- **n8n:** https://n8n-v2-n8n.vprt3o.easypanel.host — usar skill `n8n-workflow-manager` para editar workflows
- **Redis:** Upstash (buffer mensagens WF1)
- **OpenAI:** GPT-4o-mini + Whisper + Vision

---

## Problemas Conhecidos e Cuidados

- **Front trava apos tempo**: Sessao Supabase expira (~1h), navegador cacheia pagina velha. Correcao aplicada: Cache-Control no-store no middleware + subscricoes estabilizadas. Se voltar a acontecer, investigar refresh de token no AuthContext.
- **Prompt da IA (WF2)**: O prompt completo do agente IA esta no node "Montar Prompt com FAQs e Cardapio" do WF2. Cuidado ao editar — sempre ler o prompt inteiro antes de mudar.
- **Vercel region**: Se o projeto for recriado no Vercel, a regiao volta pra iad1 (EUA). O `vercel.json` com `regions: ["gru1"]` previne isso em deploys normais.
