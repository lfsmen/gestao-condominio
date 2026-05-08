# Administração de Condomínio

Aplicação web para administração de condomínios em Portugal — quotas mensais,
grandes despesas com derrama, reuniões, ocorrências.

Implementa SPEC v2.1 (ver `SPEC.md`).

## Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **DB:** PostgreSQL (Docker local em dev, Supabase em produção)
- **ORM:** Prisma 5
- **UI:** Tailwind + shadcn-style components
- **Validação:** Zod
- **Tests:** Vitest (unit + integration contra SQLite real)
- **Lint/Format:** Biome

## Setup

### Opção 1: Docker (Recomendado - PostgreSQL local)

```bash
# 1. Configurar variáveis de ambiente
cp .env.example .env

# 2. Construir e iniciar containers
pnpm docker:build
pnpm docker:up

# 3. Ver logs (opcional)
pnpm docker:logs

# Aceder a http://localhost:3000
```

Para parar:
```bash
pnpm docker:down
```

Para aceder à shell do container:
```bash
pnpm docker:shell
```

### Opção 2: Desenvolvimento Nativo (SQLite)

```bash
pnpm install
cp .env.example .env.local
# Editar .env.local — usar SQLite local

pnpm prisma generate
pnpm prisma migrate dev          # cria a base SQLite local
pnpm db:seed                     # opcional: cria condomínio de exemplo

pnpm dev                         # http://localhost:3000
```

Em desenvolvimento o sign-in é simplificado (basta indicar email + nome — não envia magic link).
Em produção a recomendação é trocar `lib/auth/session.ts` por Supabase Auth (magic link).

## Comandos

```bash
pnpm dev                         # dev server
pnpm test                        # unit + integration
pnpm lint                        # biome check
pnpm lint:fix                    # biome auto-fix
pnpm build && pnpm start         # produção local

# Cron mensal (chamada manual em dev):
curl -X POST http://localhost:3000/api/cron/gerar-quotas-mensais \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mes": 4, "ano": 2026}'
```

## Fluxo principal (admin)

1. **Criar condomínio** — `/criar-condominio` (primeiro user vira admin).
2. **Adicionar frações** — `/[id]/admin/membros` (identificador + permilagem).
3. **Convidar moradores** — mesmo ecrã. Email com token enviado (Resend em produção, log local em dev).
4. **Configurar quota base** — `/[id]/admin/quota-base` (modos: valor único / permilagem / manual).
5. **Cron mensal** — gera 1 quota por fração no dia 1 (sem proporcionalidade — v2.1).
6. **Grande despesa**:
   - `/[id]/admin/grandes-despesas/nova` → preview reactivo do impacto por fração.
   - Associar a uma reunião agendada → cria `Decisao(GRANDE_DESPESA)`.
   - Em "Publicar acta" da reunião, marcar a decisão como APROVADO → cria N×M `ImputacaoExtra`.
   - Próximo cron mensal aplica os extras à quota.
7. **Anular grande despesa**:
   - 2-step com motivo obrigatório.
   - Imputações futuras (PENDENTES) → ANULADA, removidas das próximas quotas.
   - Imputações já aplicadas → marcadas para reembolso em
     `/[id]/admin/grandes-despesas/[id]/reembolsos`.
   - Admin trata reembolso fora da app, marca como tratado.
   - Reverter anulação é bloqueado se algum reembolso já foi marcado tratado.

## Vista do morador

`/[id]/orcamento/minhas-contas` — UI adaptativa em função de extras:

- 0 extras: só base.
- 1 extra: linha nomeada laranja, clicável.
- ≥ 2 extras: linha consolidada laranja, abre `<DerramaBreakdownModal/>` com breakdown.

## Estrutura

```
app/
  (public)         → /sign-in, /accept-invite/[token], /criar-condominio
  [condominioId]/
    layout.tsx     → tenant guard + nav
    dashboard/
    orcamento/{minhas-contas, contas-gerais}
    reunioes/{[id]}
    ocorrencias/
    admin/{quota-base, despesas-correntes, grandes-despesas/{[id], [id]/reembolsos, nova}, membros, audit}
  api/
    cron/gerar-quotas-mensais
    quotas/[id]/pagar
    condominios/[id]/grandes-despesas/[id]/reembolsos
    sign-out
components/
  ui/              → shadcn-style primitives
  domain/          → QuotaCard, DerramaBreakdownModal, ReembolsoTracker, DerramaPreview
lib/
  constants.ts     → enums tipados (substituem enums Prisma por compat. SQLite)
  db/              → Prisma singleton
  auth/            → session, invite (token sha256)
  tenancy/         → getMembership, isAdmin
  quotas/          → geracao (cron), minhas-contas
  grandes-despesas/→ calculo, workflow (criar/aprovar/anular/reembolso), reembolsos
  audit/           → recordAudit, listAudit
  notifications/   → email (Resend em produção, log local em dev)
  utils.ts         → cn, formatEuros, formatData, formatMesAno
prisma/
  schema.prisma
  seed.ts
tests/
  calculo.test.ts  → cálculo de imputação (rateio igual / permilagem) + prestações
  workflow.test.ts → cron, aprovação, anulação, reembolsos, UI adaptativa (AC-9..25)
```

## Notas de implementação

- **Money em cents (Int).** Sem floats em valores monetários.
- **Multi-tenant via `condominioId` em todas as queries.** Helper `getMembership(userId, condominioId)`
  bloqueia cross-tenant. Em produção: adicionar RLS no Supabase nas tabelas com `condominioId`.
- **Enums Prisma → strings.** Em SQLite os enums não são suportados — usamos `String` no schema e
  constantes tipadas em `lib/constants.ts`. Para Postgres é trivial migrar para enums nativos.
- **Sem proporcionalidade na entrada/saída a meio do mês (v2.1).** Quota é sempre o valor mensal
  cheio. Acerto entre comprador/vendedor é fora da app.
- **Reembolsos pós-anulação são tracking apenas (v2.1).** A app não processa pagamentos.

## Docker (Desenvolvimento Local)

A aplicação inclui configuração Docker completa com PostgreSQL local:

- **App container**: Node.js 20 + Next.js + pnpm
- **Database container**: PostgreSQL 15 Alpine
- **Migrations automáticas**: Corre na inicialização do container
- **Seed automático**: Cria condomínio de exemplo na primeira execução

**Comandos úteis:**
```bash
# Ver estado dos containers
docker-compose ps

# Ver logs da base de dados
docker-compose logs -f db

# Reset total (apaga dados)
docker-compose down -v
pnpm docker:up

# Correr migrations manualmente
docker-compose exec app npx prisma migrate deploy

# Executar seed manualmente
docker-compose exec app npx prisma db seed
```

Os dados da base de dados persistem no volume `postgres_data`.

## Deploy (Produção)

1. Criar projecto Supabase, copiar URLs/keys para `.env`.
2. Correr `pnpm prisma migrate deploy` para criar as tabelas.
3. Configurar `vercel.json` (já incluído — cron dia 1 às 05:00 UTC).
4. Deploy a Vercel.
5. Configurar RLS no Supabase para todas as tabelas com `condominioId`.

## Tests

`pnpm test` corre 22 testes:

- Cálculo de rateio (igual / permilagem) — sem perda de cêntimos.
- Geração mensal de quotas — idempotência, sem proporcionalidade.
- Aprovação de grande despesa — N×M imputações.
- Anulação — separação correcta entre PENDENTES / APLICADAS, criação de reembolsos.
- Marcar reembolso como tratado + bloqueio de reverter se há tratados.
- UI adaptativa de minhas contas — 0/1/≥2 extras.

Cobre AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-18..21, AC-22..25.
