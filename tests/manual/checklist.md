# Checklist de Testes Manuais — Convívio v1

Correr antes de cada release. Marcar ✅ quando verificado, ❌ se falhar.

---

## Onboarding e Auth

- [ ] **AC-1** — Criar condomínio com email novo: verifica que existe 1 `Condominio`, 1 `User`, 1 `Membership(role=ADMINISTRADOR)` e que o utilizador aterra no dashboard.
- [ ] **AC-2** — Convidar morador com email novo, aceitar convite: verifica que `Membership(role=MORADOR)` existe com a fração correcta.
- [ ] **AC-3** — Usar convite expirado (> 14 dias): verifica mensagem de erro clara com sugestão de reenvio.

## Multi-tenancy

- [ ] **AC-4** — Com utilizador A do condomínio X, tentar aceder a `/[condominioY]/dashboard`: deve devolver 403/404.

## Quota Base

- [ ] **AC-6** — Admin configura quota VALOR_UNICO €25: verifica `ConfiguracaoQuota` criada com `valorUnicoCents=2500`.
- [ ] **AC-7** — Admin tenta configurar PERMILAGEM com permilagens que não somam 1000: deve bloquear com erro.
- [ ] **AC-8** — Admin cria nova quota com `vigenteDesde` futuro: anterior fica com `vigenteAte` correcto.

## Geração mensal de quotas (cron)

- [ ] **AC-9** — Chamar cron manualmente (`curl -X POST .../api/cron/gerar-quotas-mensais`): verifica 1 `QuotaMensal(PENDENTE)` por cada `Membership` activa com `fracaoId`.
- [ ] **AC-10** — Chamar cron 2× no mesmo mês: sem duplicados (constraint `unique(fracaoId, ano, mes)`).
- [ ] **AC-11** — Membership criada a meio do mês, cron do mês seguinte: `valorBaseCents` = valor mensal completo (sem proporção).

## Minhas Contas

- [ ] **AC-12** — Morador com 0 extras: UI mostra apenas "Base €X" e "Total €X".
- [ ] **AC-13** — Morador com 1 extra: linha nomeada em laranja, clicável para detalhe da grande despesa.
- [ ] **AC-14/15** — Morador com 3 extras: linha consolidada "Extras (3 derramas) €Y"; tap → modal com 3 derramas listadas (título, prestação, data da reunião).
- [ ] **AC-16** — Clicar "Marcar como pago": `QuotaMensal.estado=PAGA`, `pagaEm` preenchido.
- [ ] **AC-17** — Grande despesa anulada após quota gerada: UI mostra aviso "Esta quota foi corrigida em [data] devido a [motivo]".

## Grandes Despesas — workflow

- [ ] **AC-18** — Criar GD €5.600, 8 frações iguais, 4 meses: preview mostra "€175,00/mês durante 4 meses".
- [ ] **AC-19** — Associar GD(RASCUNHO) a reunião agendada: `Decisao(GRANDE_DESPESA)` criada, `estado=EM_VOTACAO`.
- [ ] **AC-20** — Publicar acta com resultado APROVADO: `estado=APROVADA`, N×M `ImputacaoExtra(PENDENTE)` criadas, moradores recebem email.
- [ ] **AC-21** — Cron mensal com `ImputacaoExtra(PENDENTE, mesAplicacao=mês_corrente)`: imputação ligada à `QuotaMensal`, `estado=APLICADA`.

## Grandes Despesas — anulação e reembolsos

- [ ] **AC-22** — GD(APROVADA) com 4 prestações (2 APLICADAS em quotas PAGAS, 2 PENDENTES): anulação 2-step. Verificar: 2 PENDENTES ficam ANULADA sem aparecer em reembolsos; 2 APLICADAS ficam ANULADA com `reembolsadaEm=null`; cada morador recebe email.
- [ ] **AC-23** — Admin marca reembolso como tratado com nota: `reembolsadaEm=now()`, nota gravada, entrada em AuditLog.
- [ ] **AC-24** — Tentar reverter anulação depois de 1 reembolso tratado: operação bloqueada com mensagem clara.
- [ ] **AC-25** — Morador vê detalhe de GD anulada: prestações mostram "Aguarda reembolso" ou "Reembolso tratado em [data] · [nota]".

## Grandes Despesas — execução

- [ ] **AC-26** — Marcar GD como executada com valorFinal > 5% acima do orçamento: requer nota explicativa antes de gravar.

## Reuniões

- [ ] **AC-27** — Admin cria convocatória: todos os membros recebem email com `.ics` anexo (verificar em `tmp/emails.log` em dev).
- [ ] **AC-28** — Morador clica "Vou" no detalhe da reunião: `Presenca(rsvp=VOU)` criada/actualizada.
- [ ] **AC-29** — Admin publica acta: `Reuniao.estado=CONCLUIDA`, todos os membros recebem email com link para a acta.
- [ ] **SEM_QUORUM** — Admin publica acta com checkbox "sem quórum": `Reuniao.estado=SEM_QUORUM`, email enviado com nota "(sem quórum)".

## Ocorrências

- [ ] **AC-30** — Morador submete ocorrência com `local` e `urgencia`: criada com `estado=ABERTA`; admin(s) recebem email de notificação.
- [ ] **AC-31** — Admin muda estado de ocorrência: autor recebe email com novo estado.
- [ ] **AC-32** — Ocorrência sem updates há > 60 dias: após cron, `estado=INACTIVA`.
- [ ] **COMENTÁRIOS** — Morador adiciona comentário a ocorrência aberta: comentário guardado e visível na página de detalhe.
- [ ] **DETAIL** — Clicar numa ocorrência na lista abre página de detalhe com chat e opção de mudar estado (admin).

## Membros e Transferência de Admin

- [ ] **AC-33** — Único admin tenta renunciar sem transferir: botão mostra aviso, operação bloqueada.
- [ ] **AC-34** — Admin inicia transferência para morador: morador fica `role=ADMINISTRADOR`, email enviado; após 7 dias cron rebaixa o anterior para MORADOR.
- [ ] **TRANSFERIR** — Página `/admin/transferir` lista admins actuais e permite escolher sucessor.

## Audit Log

- [ ] **AC-35** — Verificar que as seguintes acções geram entrada em AuditLog: criar/anular despesa corrente, criar/aprovar/anular grande despesa, marcar reembolso, configurar quota base, transferir admin, publicar acta, submeter/mudar estado ocorrência.

## RLS e Segurança

- [ ] **RLS-1** — Tentar ler dados de outro condomínio via Prisma Studio ou SQL directo: acesso bloqueado por RLS (em produção com Supabase).

## Ops

- [ ] **OPS-1** — `pnpm test` exits 0.
- [ ] **OPS-2** — `pnpm biome check .` exits 0.
- [ ] **OPS-3** — `pnpm build` exits 0 sem erros de TypeScript.
- [ ] **OPS-4** — `.env.example` tem todas as variáveis necessárias.

---

**Total: 22 itens principais + 5 extras = 27 itens**

Actualizado em: 2026-04-26
