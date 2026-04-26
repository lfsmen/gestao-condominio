import { recordAudit } from "@/lib/audit";
import { AuditAction, Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { gerarQuotasMensais, marcarOcorrenciasInactivas, mesActualUtc } from "@/lib/quotas/geracao";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

async function runCron(mes: number, ano: number, condominioId?: string) {
  const result = await gerarQuotasMensais(mes, ano, condominioId);

  // Audit por condomínio.
  for (const cid of Object.keys(result.porCondominio)) {
    const c = result.porCondominio[cid];
    if (c.criadas > 0) {
      await recordAudit({
        condominioId: cid,
        action: AuditAction.QUOTAS_GERADAS,
        payload: { mes, ano, criadas: c.criadas, jaExistiam: c.jaExistiam },
      });
    }
  }

  // Enviar email a cada morador com quota criada.
  const mesLabel = MESES_PT[mes - 1] ?? String(mes);
  for (const q of result.quotasCriadas) {
    await sendEmail({
      to: q.email,
      subject: `Quota de ${mesLabel} ${q.ano} disponível — ${q.condominioNome}`,
      html: `<p>Olá ${q.nome},</p>
<p>A quota de <strong>${mesLabel} ${q.ano}</strong> já está disponível em <strong>${q.condominioNome}</strong>.</p>
<p>Valor base: <strong>€${(q.valorBaseCents / 100).toFixed(2)}</strong></p>
<p>Aceda à aplicação para ver o total (pode incluir derramas activas) e marcar como pago após efectuar a transferência.</p>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL}/${q.condominioId}/orcamento/minhas-contas">Ver a minha quota →</a></p>`,
      text: `Quota de ${mesLabel} ${q.ano}: €${(q.valorBaseCents / 100).toFixed(2)} base. Aceda à app para ver o total e marcar como pago.`,
    });
  }

  // Marcar ocorrências inactivas (> 60 dias sem update).
  const inactivas = await marcarOcorrenciasInactivas();

  // Rebaixar admins cujo período de sobreposição expirou.
  const expirados = await prisma.membership.findMany({
    where: {
      role: Role.ADMINISTRADOR,
      adminTransicaoExpiraEm: { lt: new Date(), not: null },
    },
    include: { user: true, condominio: true },
  });
  for (const m of expirados) {
    await prisma.membership.update({
      where: { id: m.id },
      data: { role: Role.MORADOR, adminTransicaoExpiraEm: null },
    });
    await recordAudit({
      condominioId: m.condominioId,
      action: AuditAction.ADMIN_TRANSFERIDO,
      entityType: "Membership",
      entityId: m.id,
      payload: { acao: "REBAIXAMENTO_AUTOMATICO_7_DIAS" },
    });
    await sendEmail({
      to: m.user.email,
      subject: `Administração transitada — ${m.condominio.nome}`,
      html: `<p>Olá ${m.user.nome},</p><p>O período de sobreposição de administração em <strong>${m.condominio.nome}</strong> terminou. Passou de volta a Morador.</p>`,
      text: `O período de sobreposição de administração em ${m.condominio.nome} terminou. Passou de volta a Morador.`,
    });
  }

  return { ...result, inactivas, adminsRebaixados: expirados.length };
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { mes, ano } = body.mes && body.ano ? body : mesActualUtc();
  const condominioId: string | undefined = body.condominioId;

  const result = await runCron(mes, ano, condominioId);
  return NextResponse.json({ ok: true, mes, ano, ...result });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { mes, ano } = mesActualUtc();
  const result = await runCron(mes, ano);
  return NextResponse.json({ ok: true, mes, ano, ...result });
}
