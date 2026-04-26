import { EstadoImputacao, EstadoQuota, ModoQuota } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface QuotaCriada {
  email: string;
  nome: string;
  condominioNome: string;
  condominioId: string;
  mes: number;
  ano: number;
  valorBaseCents: number;
  fracaoId: string;
}

export interface GerarQuotasResult {
  criadas: number;
  jaExistiam: number;
  porCondominio: Record<string, { criadas: number; jaExistiam: number }>;
  quotasCriadas: QuotaCriada[];
}

/**
 * Cron mensal — gera 1 QuotaMensal por Membership activa em cada condomínio.
 *
 * Comportamento v2.1:
 * - Sem proporcionalidade: valor base é o valor mensal completo.
 * - Idempotente: usa `unique(fracaoId, ano, mes)`.
 * - Liga ImputacaoExtra(estado=PENDENTE) com mes/ano correspondentes à
 *   QuotaMensal recém-criada e marca-as como APLICADA.
 */
export async function gerarQuotasMensais(
  mes: number,
  ano: number,
  condominioId?: string,
): Promise<GerarQuotasResult> {
  const condominios = await prisma.condominio.findMany({
    where: condominioId ? { id: condominioId } : undefined,
    include: {
      memberships: {
        where: { leftAt: null, fracaoId: { not: null } },
        include: { fracao: true, user: true },
      },
      configuracoesQuota: {
        where: {
          vigenteDesde: { lte: new Date(ano, mes - 1, 1) },
          OR: [{ vigenteAte: null }, { vigenteAte: { gte: new Date(ano, mes - 1, 1) } }],
        },
        orderBy: { vigenteDesde: "desc" },
        take: 1,
      },
    },
  });

  let totalCriadas = 0;
  let totalJaExistiam = 0;
  const porCondominio: Record<string, { criadas: number; jaExistiam: number }> = {};
  const quotasCriadas: QuotaCriada[] = [];

  for (const c of condominios) {
    const cfg = c.configuracoesQuota[0];
    if (!cfg) continue;
    porCondominio[c.id] = { criadas: 0, jaExistiam: 0 };

    const valoresPorFracao =
      cfg.modo === ModoQuota.VALOR_UNICO
        ? null
        : (JSON.parse(cfg.valoresPorFracao ?? "{}") as Record<string, number>);

    for (const m of c.memberships) {
      if (!m.fracaoId) continue;
      const valorBaseCents =
        cfg.modo === ModoQuota.VALOR_UNICO
          ? (cfg.valorUnicoCents ?? 0)
          : (valoresPorFracao?.[m.fracaoId] ?? 0);

      try {
        const quota = await prisma.quotaMensal.create({
          data: {
            condominioId: c.id,
            fracaoId: m.fracaoId,
            mes,
            ano,
            valorBaseCents,
            estado: EstadoQuota.PENDENTE,
          },
        });
        totalCriadas += 1;
        porCondominio[c.id].criadas += 1;

        quotasCriadas.push({
          email: m.user.email,
          nome: m.user.nome,
          condominioNome: c.nome,
          condominioId: c.id,
          mes,
          ano,
          valorBaseCents,
          fracaoId: m.fracaoId,
        });

        // Liga imputações pendentes deste mês.
        await prisma.imputacaoExtra.updateMany({
          where: {
            fracaoId: m.fracaoId,
            mesAplicacao: mes,
            anoAplicacao: ano,
            estado: EstadoImputacao.PENDENTE,
            quotaMensalId: null,
          },
          data: {
            quotaMensalId: quota.id,
            estado: EstadoImputacao.APLICADA,
          },
        });
      } catch (err) {
        // P2002 = unique constraint violation -> já existia (idempotência).
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          totalJaExistiam += 1;
          porCondominio[c.id].jaExistiam += 1;
        } else {
          throw err;
        }
      }
    }
  }

  return { criadas: totalCriadas, jaExistiam: totalJaExistiam, porCondominio, quotasCriadas };
}

/**
 * Marca ocorrências sem actualização há > 60 dias como INACTIVA.
 * Devolve a lista de condominioIds afectados para notificação.
 */
export async function marcarOcorrenciasInactivas(now: Date = new Date()): Promise<number> {
  const limite = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.ocorrencia.updateMany({
    where: {
      ultimoUpdate: { lt: limite },
      estado: { in: ["ABERTA", "EM_ANALISE", "EM_RESOLUCAO"] },
    },
    data: { estado: "INACTIVA" },
  });
  return count;
}

/**
 * Calcula o (mes, ano) seguintes ao actual.
 */
export function mesActualUtc(now: Date = new Date()): { mes: number; ano: number } {
  return { mes: now.getUTCMonth() + 1, ano: now.getUTCFullYear() };
}
