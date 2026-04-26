import { recordAudit } from "@/lib/audit";
import {
  AuditAction,
  EstadoGrandeDespesa,
  EstadoImputacao,
  type ModoRateio,
  ResultadoDecisao,
  TipoDecisao,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { calcularImputacaoPorFracao, calcularMesPrestacao, dividirPorPrestacoes } from "./calculo";

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Cria uma `GrandeDespesa` em estado RASCUNHO.
 */
export async function criarGrandeDespesa(params: {
  condominioId: string;
  membershipId: string;
  titulo: string;
  descricao: string;
  valorTotalCents: number;
  numeroMeses: number;
  mesInicial: number;
  anoInicial: number;
  modoRateio: ModoRateio;
}) {
  const gd = await prisma.grandeDespesa.create({
    data: {
      condominioId: params.condominioId,
      titulo: params.titulo,
      descricao: params.descricao,
      valorTotalCents: params.valorTotalCents,
      numeroMeses: params.numeroMeses,
      mesInicial: params.mesInicial,
      anoInicial: params.anoInicial,
      modoRateio: params.modoRateio,
      estado: EstadoGrandeDespesa.RASCUNHO,
    },
  });
  await recordAudit({
    condominioId: params.condominioId,
    membershipId: params.membershipId,
    action: AuditAction.GRANDE_DESPESA_CRIADA,
    entityType: "GrandeDespesa",
    entityId: gd.id,
    payload: { titulo: gd.titulo, valor: gd.valorTotalCents },
  });
  return gd;
}

/**
 * Associa a grande despesa a uma reunião (cria a Decisao do tipo GRANDE_DESPESA).
 * Move estado RASCUNHO → EM_VOTACAO.
 */
export async function associarReuniao(params: {
  grandeDespesaId: string;
  reuniaoId: string;
  membershipId: string;
}) {
  const gd = await prisma.grandeDespesa.findUnique({
    where: { id: params.grandeDespesaId },
  });
  if (!gd) throw new Error("Grande despesa não encontrada");
  if (gd.estado !== EstadoGrandeDespesa.RASCUNHO) {
    throw new Error("Só rascunhos podem ser associados a reunião");
  }
  return prisma.$transaction(async (tx) => {
    const decisao = await tx.decisao.create({
      data: {
        reuniaoId: params.reuniaoId,
        tipo: TipoDecisao.GRANDE_DESPESA,
        titulo: gd.titulo,
        descricao: gd.descricao,
      },
    });
    return tx.grandeDespesa.update({
      where: { id: gd.id },
      data: { estado: EstadoGrandeDespesa.EM_VOTACAO, decisaoId: decisao.id },
    });
  });
}

/**
 * Aprova a grande despesa: cria N×M `ImputacaoExtra` (estado=PENDENTE).
 * Chamada como parte de "publicar acta" quando a Decisao é APROVADO.
 */
export async function aprovarGrandeDespesa(params: {
  grandeDespesaId: string;
  membershipId: string;
}) {
  const gd = await prisma.grandeDespesa.findUnique({
    where: { id: params.grandeDespesaId },
    include: {
      condominio: { include: { fracoes: true } },
      decisao: true,
    },
  });
  if (!gd) throw new Error("Grande despesa não encontrada");
  if (gd.estado !== EstadoGrandeDespesa.EM_VOTACAO) {
    throw new Error("Só grandes despesas EM_VOTACAO podem ser aprovadas");
  }
  if (!gd.decisao || gd.decisao.resultado !== ResultadoDecisao.APROVADO) {
    throw new Error("Decisão associada não foi aprovada");
  }

  const fracoes = gd.condominio.fracoes;
  const distribuicao = calcularImputacaoPorFracao(
    gd.valorTotalCents,
    fracoes,
    gd.modoRateio as ModoRateio,
  );

  await prisma.$transaction(async (tx) => {
    for (const dist of distribuicao) {
      const prestacoes = dividirPorPrestacoes(dist.valorTotalCents, gd.numeroMeses);
      for (let i = 0; i < gd.numeroMeses; i++) {
        const { mes, ano } = calcularMesPrestacao(gd.mesInicial, gd.anoInicial, i);
        await tx.imputacaoExtra.create({
          data: {
            grandeDespesaId: gd.id,
            fracaoId: dist.fracaoId,
            mesAplicacao: mes,
            anoAplicacao: ano,
            valorCents: prestacoes[i],
            prestacaoActual: i + 1,
            prestacoesTotal: gd.numeroMeses,
            estado: EstadoImputacao.PENDENTE,
          },
        });
      }
    }
    await tx.grandeDespesa.update({
      where: { id: gd.id },
      data: { estado: EstadoGrandeDespesa.APROVADA },
    });
  });

  await recordAudit({
    condominioId: gd.condominioId,
    membershipId: params.membershipId,
    action: AuditAction.GRANDE_DESPESA_APROVADA,
    entityType: "GrandeDespesa",
    entityId: gd.id,
    payload: { titulo: gd.titulo, valor: gd.valorTotalCents },
  });

  // Notificar moradores com derrama aprovada.
  const membros = await prisma.membership.findMany({
    where: { condominioId: gd.condominioId, leftAt: null, fracaoId: { not: null } },
    include: { user: true, fracao: true },
  });
  const mesLabel = MESES_PT[gd.mesInicial - 1] ?? String(gd.mesInicial);
  for (const m of membros) {
    const dist = distribuicao.find((d) => d.fracaoId === m.fracaoId);
    if (!dist) continue;
    const valorMes = Math.round(dist.valorTotalCents / gd.numeroMeses);
    await sendEmail({
      to: m.user.email,
      subject: `Derrama aprovada: ${gd.titulo}`,
      html: `<p>Olá ${m.user.nome},</p>
<p>A derrama <strong>${gd.titulo}</strong> foi aprovada em assembleia.</p>
<p>A sua quota mensal sobe <strong>€${(valorMes / 100).toFixed(2)}</strong> durante <strong>${gd.numeroMeses} meses</strong> a partir de ${mesLabel} ${gd.anoInicial}.</p>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL}/${gd.condominioId}/orcamento/minhas-contas">Ver as minhas contas →</a></p>`,
      text: `Derrama aprovada: ${gd.titulo}. A sua quota sobe €${(valorMes / 100).toFixed(2)}/mês durante ${gd.numeroMeses} meses a partir de ${mesLabel} ${gd.anoInicial}.`,
    });
  }

  return prisma.grandeDespesa.findUnique({ where: { id: gd.id } });
}

/**
 * Marca grande despesa como executada com valorFinal.
 * Se diferença > 5%, exige notaExecucao.
 */
export async function executarGrandeDespesa(params: {
  grandeDespesaId: string;
  membershipId: string;
  valorFinalCents: number;
  notaExecucao?: string;
}) {
  const gd = await prisma.grandeDespesa.findUnique({
    where: { id: params.grandeDespesaId },
  });
  if (!gd) throw new Error("Grande despesa não encontrada");
  if (gd.estado !== EstadoGrandeDespesa.APROVADA) {
    throw new Error("Só APROVADAS podem ser executadas");
  }
  const diff = Math.abs(params.valorFinalCents - gd.valorTotalCents);
  const pct = diff / gd.valorTotalCents;
  if (pct > 0.05 && !params.notaExecucao) {
    throw new Error("Diferença > 5% face ao orçamento. Nota explicativa é obrigatória.");
  }

  const updated = await prisma.grandeDespesa.update({
    where: { id: gd.id },
    data: {
      estado: EstadoGrandeDespesa.EXECUTADA,
      executadaEm: new Date(),
      valorFinalCents: params.valorFinalCents,
      notaExecucao: params.notaExecucao,
    },
  });
  await recordAudit({
    condominioId: gd.condominioId,
    membershipId: params.membershipId,
    action: AuditAction.GRANDE_DESPESA_EXECUTADA,
    entityType: "GrandeDespesa",
    entityId: gd.id,
    payload: {
      valorOrcado: gd.valorTotalCents,
      valorFinal: params.valorFinalCents,
      desvio: pct,
    },
  });
  return updated;
}

/**
 * ⭐ v2.1 — Anula grande despesa APROVADA.
 *
 * Comportamento:
 * - Imputações PENDENTES (futuras) → ANULADA + removidas das próximas quotas.
 * - Imputações APLICADAS (passadas) → ANULADA + reembolsadaEm=null.
 *   Estas ficam em "Reembolsos a tratar".
 *
 * Devolve contadores das imputações afectadas.
 */
export async function anularGrandeDespesa(params: {
  grandeDespesaId: string;
  membershipId: string;
  motivo: string;
}): Promise<{
  futurasAnuladas: number;
  aplicadasParaReembolso: number;
}> {
  if (!params.motivo || params.motivo.trim().length < 5) {
    throw new Error("Motivo de anulação é obrigatório (mín. 5 caracteres)");
  }

  const gd = await prisma.grandeDespesa.findUnique({
    where: { id: params.grandeDespesaId },
    include: { imputacoes: true },
  });
  if (!gd) throw new Error("Grande despesa não encontrada");
  if (gd.estado !== EstadoGrandeDespesa.APROVADA && gd.estado !== EstadoGrandeDespesa.EXECUTADA) {
    throw new Error("Só APROVADAS ou EXECUTADAS podem ser anuladas");
  }

  const futuras = gd.imputacoes.filter((i) => i.estado === EstadoImputacao.PENDENTE);
  const aplicadas = gd.imputacoes.filter((i) => i.estado === EstadoImputacao.APLICADA);

  await prisma.$transaction(async (tx) => {
    // Futuras: anuladas em silêncio.
    if (futuras.length > 0) {
      await tx.imputacaoExtra.updateMany({
        where: { id: { in: futuras.map((i) => i.id) } },
        data: { estado: EstadoImputacao.ANULADA, quotaMensalId: null },
      });
    }

    // Aplicadas: anuladas + ficam para reembolso.
    if (aplicadas.length > 0) {
      await tx.imputacaoExtra.updateMany({
        where: { id: { in: aplicadas.map((i) => i.id) } },
        data: { estado: EstadoImputacao.ANULADA },
      });
      // Marcar quotas afectadas com nota de correcção.
      const quotaIds = Array.from(
        new Set(aplicadas.map((i) => i.quotaMensalId).filter((q): q is string => !!q)),
      );
      if (quotaIds.length > 0) {
        await tx.quotaMensal.updateMany({
          where: { id: { in: quotaIds } },
          data: {
            corrigidaEm: new Date(),
            correcaoMotivo: `Derrama "${gd.titulo}" anulada: ${params.motivo}`,
          },
        });
      }
    }

    await tx.grandeDespesa.update({
      where: { id: gd.id },
      data: {
        estado: EstadoGrandeDespesa.ANULADA,
        anuladaEm: new Date(),
        anuladaMotivo: params.motivo,
      },
    });
  });

  await recordAudit({
    condominioId: gd.condominioId,
    membershipId: params.membershipId,
    action: AuditAction.GRANDE_DESPESA_ANULADA,
    entityType: "GrandeDespesa",
    entityId: gd.id,
    payload: {
      motivo: params.motivo,
      futurasAnuladas: futuras.length,
      aplicadasParaReembolso: aplicadas.length,
    },
  });

  // Notificar moradores afectados pela anulação.
  // Agrupa imputações por fracaoId para calcular o que cada um paga/pagou.
  const fracaoIds = Array.from(new Set(gd.imputacoes.map((i) => i.fracaoId)));
  const membrosAfectados = await prisma.membership.findMany({
    where: { condominioId: gd.condominioId, leftAt: null, fracaoId: { in: fracaoIds } },
    include: { user: true },
  });
  for (const m of membrosAfectados) {
    const impsAplicadas = aplicadas.filter((i) => i.fracaoId === m.fracaoId);
    const valorJaPago = impsAplicadas.reduce((s, i) => s + i.valorCents, 0);
    await sendEmail({
      to: m.user.email,
      subject: `Derrama anulada: ${gd.titulo}`,
      html: `<p>Olá ${m.user.nome},</p>
<p>A derrama <strong>${gd.titulo}</strong> foi anulada.</p>
<p>As prestações futuras <strong>deixam de ser cobradas</strong>.</p>
${valorJaPago > 0 ? `<p>O valor já pago (€${(valorJaPago / 100).toFixed(2)}) será reembolsado pelo administrador fora da aplicação.</p>` : ""}
<p>Motivo: ${params.motivo}</p>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL}/${gd.condominioId}/orcamento/minhas-contas">Ver as minhas contas →</a></p>`,
      text: `Derrama anulada: ${gd.titulo}. Motivo: ${params.motivo}.${valorJaPago > 0 ? ` Valor a reembolsar: €${(valorJaPago / 100).toFixed(2)}.` : ""}`,
    });
  }

  return {
    futurasAnuladas: futuras.length,
    aplicadasParaReembolso: aplicadas.length,
  };
}

/**
 * ⭐ v2.1 — Marca um reembolso como tratado (fora da app).
 */
export async function marcarReembolsoTratado(params: {
  imputacaoId: string;
  membershipId: string;
  notas?: string;
}) {
  const imp = await prisma.imputacaoExtra.findUnique({
    where: { id: params.imputacaoId },
    include: { grandeDespesa: true },
  });
  if (!imp) throw new Error("Imputação não encontrada");
  if (imp.estado !== EstadoImputacao.ANULADA) {
    throw new Error("Só imputações ANULADAS podem ser marcadas como reembolsadas");
  }
  if (imp.reembolsadaEm) {
    throw new Error("Reembolso já foi marcado como tratado");
  }

  const updated = await prisma.imputacaoExtra.update({
    where: { id: imp.id },
    data: {
      reembolsadaEm: new Date(),
      reembolsadaNotas: params.notas,
      reembolsadaPor: params.membershipId,
    },
  });

  await recordAudit({
    condominioId: imp.grandeDespesa.condominioId,
    membershipId: params.membershipId,
    action: AuditAction.REEMBOLSO_MARCADO,
    entityType: "ImputacaoExtra",
    entityId: imp.id,
    payload: { notas: params.notas, valor: imp.valorCents },
  });

  return updated;
}

/**
 * v2.1 — Bloqueio de reverter anulação se já houve reembolsos tratados.
 */
export async function reverterAnulacao(params: {
  grandeDespesaId: string;
  membershipId: string;
}) {
  const gd = await prisma.grandeDespesa.findUnique({
    where: { id: params.grandeDespesaId },
    include: {
      imputacoes: true,
    },
  });
  if (!gd) throw new Error("Grande despesa não encontrada");
  if (gd.estado !== EstadoGrandeDespesa.ANULADA) {
    throw new Error("Só ANULADAS podem ser revertidas");
  }
  const tratados = gd.imputacoes.filter((i) => i.reembolsadaEm !== null);
  if (tratados.length > 0) {
    throw new Error(
      `Anulação não pode ser revertida: ${tratados.length} reembolso(s) já tratado(s).`,
    );
  }
  // Restaura: PENDENTES voltam a PENDENTE, APLICADAS voltam a APLICADA.
  await prisma.$transaction(async (tx) => {
    for (const imp of gd.imputacoes) {
      const novoEstado = imp.quotaMensalId ? EstadoImputacao.APLICADA : EstadoImputacao.PENDENTE;
      await tx.imputacaoExtra.update({
        where: { id: imp.id },
        data: { estado: novoEstado },
      });
    }
    await tx.grandeDespesa.update({
      where: { id: gd.id },
      data: {
        estado: EstadoGrandeDespesa.APROVADA,
        anuladaEm: null,
        anuladaMotivo: null,
      },
    });
  });
}
