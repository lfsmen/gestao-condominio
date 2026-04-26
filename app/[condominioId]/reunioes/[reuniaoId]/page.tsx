import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import {
  AuditAction,
  EstadoGrandeDespesa,
  EstadoReuniao,
  RSVP,
  ResultadoDecisao,
  Role,
  TipoDecisao,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { aprovarGrandeDespesa } from "@/lib/grandes-despesas/workflow";
import { sendEmail } from "@/lib/notifications/email";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatDataHora } from "@/lib/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const rsvpLabel: Record<string, string> = {
  VOU: "Vou",
  NAO_VOU: "Não vou",
  TALVEZ: "Talvez",
};

export default async function ReuniaoDetalhe({
  params,
}: {
  params: Promise<{ condominioId: string; reuniaoId: string }>;
}) {
  const session = await requireSession();
  const { condominioId, reuniaoId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();

  const reuniao = await prisma.reuniao.findFirst({
    where: { id: reuniaoId, condominioId },
    include: {
      decisoes: { include: { grandeDespesa: true } },
      presencas: { include: { membership: { include: { user: true } } } },
    },
  });
  if (!reuniao) notFound();

  const memberships = await prisma.membership.findMany({
    where: { condominioId, leftAt: null },
    include: { user: true, fracao: true },
  });

  // RSVP do utilizador actual
  const minhaPresenca = reuniao.presencas.find((p) => p.membershipId === ctx.membershipId);

  async function registarRsvp(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c) throw new Error("Não autorizado");
    const rsvp = String(formData.get("rsvp") ?? "");
    if (!Object.values(RSVP).includes(rsvp as never)) throw new Error("RSVP inválido");
    await prisma.presenca.upsert({
      where: { reuniaoId_membershipId: { reuniaoId, membershipId: c.membershipId } },
      update: { rsvp },
      create: { reuniaoId, membershipId: c.membershipId, rsvp },
    });
    redirect(`/${condominioId}/reunioes/${reuniaoId}`);
  }

  async function adicionarDecisaoGenerica(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");
    const titulo = String(formData.get("titulo") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim() || null;
    if (!titulo) throw new Error("Título obrigatório");
    await prisma.decisao.create({
      data: { reuniaoId, tipo: TipoDecisao.GENERICA, titulo, descricao },
    });
    redirect(`/${condominioId}/reunioes/${reuniaoId}`);
  }

  async function publicarActa(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");

    const actaTexto = String(formData.get("actaTexto") ?? "").trim();
    const semQuorum = formData.get("semQuorum") === "on";
    if (!actaTexto) throw new Error("Acta vazia");

    const decisoes = await prisma.decisao.findMany({ where: { reuniaoId } });
    for (const d of decisoes) {
      const resultado = String(formData.get(`res_${d.id}`) ?? "");
      if (
        resultado === ResultadoDecisao.APROVADO ||
        resultado === ResultadoDecisao.REJEITADO ||
        resultado === ResultadoDecisao.ADIADO
      ) {
        await prisma.decisao.update({ where: { id: d.id }, data: { resultado } });
        if (d.tipo === TipoDecisao.GRANDE_DESPESA && resultado === ResultadoDecisao.APROVADO) {
          const gd = await prisma.grandeDespesa.findFirst({ where: { decisaoId: d.id } });
          if (gd && gd.estado === EstadoGrandeDespesa.EM_VOTACAO) {
            await aprovarGrandeDespesa({ grandeDespesaId: gd.id, membershipId: c.membershipId });
          }
        }
      }
    }

    // Presenças (só relevante se não for sem quórum).
    if (!semQuorum) {
      const presentesIds = formData.getAll("presente").map((v) => String(v));
      for (const m of memberships) {
        const presente = presentesIds.includes(m.id);
        await prisma.presenca.upsert({
          where: { reuniaoId_membershipId: { reuniaoId, membershipId: m.id } },
          update: { presente },
          create: { reuniaoId, membershipId: m.id, presente },
        });
      }
    }

    const novoEstado = semQuorum ? EstadoReuniao.SEM_QUORUM : EstadoReuniao.CONCLUIDA;

    const r = await prisma.reuniao.update({
      where: { id: reuniaoId },
      data: { actaTexto, publicadaEm: new Date(), estado: novoEstado },
    });

    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.ACTA_PUBLICADA,
      entityType: "Reuniao",
      entityId: reuniaoId,
      payload: { estado: novoEstado },
    });

    // Notificar todos os membros.
    const condominio = await prisma.condominio.findUnique({ where: { id: condominioId } });
    const membros = await prisma.membership.findMany({
      where: { condominioId, leftAt: null },
      include: { user: true },
    });
    for (const m of membros) {
      await sendEmail({
        to: m.user.email,
        subject: `Acta publicada: ${r.titulo} — ${condominio?.nome}`,
        html: `<p>Olá ${m.user.nome},</p>
<p>A acta da reunião <strong>${r.titulo}</strong> foi publicada${semQuorum ? " (sem quórum)" : ""}.</p>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL}/${condominioId}/reunioes/${reuniaoId}">Consultar acta →</a></p>`,
        text: `A acta da reunião "${r.titulo}" foi publicada${semQuorum ? " (sem quórum)" : ""}. Aceda à app para ler.`,
      });
    }

    redirect(`/${condominioId}/reunioes/${reuniaoId}`);
  }

  const podeEditar = isAdmin(ctx) && reuniao.estado === EstadoReuniao.AGENDADA;

  const estadoCor: Record<string, "success" | "destructive" | "secondary" | "outline"> = {
    AGENDADA: "outline",
    CONCLUIDA: "success",
    CANCELADA: "destructive",
    SEM_QUORUM: "destructive",
  };

  // Contagem de RSVPs
  const rsvpCounts = reuniao.presencas.reduce(
    (acc, p) => {
      if (p.rsvp) acc[p.rsvp] = (acc[p.rsvp] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/${condominioId}/reunioes`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Reuniões
          </Link>
          <h1 className="text-2xl font-bold mt-1">{reuniao.titulo}</h1>
          <p className="text-muted-foreground">
            {formatDataHora(reuniao.data)}
            {reuniao.local ? ` · ${reuniao.local}` : ""}
          </p>
        </div>
        <Badge variant={estadoCor[reuniao.estado] ?? "outline"}>{reuniao.estado}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ordem do dia</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm font-sans">{reuniao.ordemDoDia}</pre>
        </CardContent>
      </Card>

      {/* RSVP — visível antes da reunião */}
      {reuniao.estado === EstadoReuniao.AGENDADA && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">A sua confirmação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {minhaPresenca?.rsvp && (
              <p className="text-sm text-muted-foreground">
                Confirmação actual:{" "}
                <strong>{rsvpLabel[minhaPresenca.rsvp] ?? minhaPresenca.rsvp}</strong>
              </p>
            )}
            <form action={registarRsvp} className="flex gap-2">
              <select
                name="rsvp"
                defaultValue={minhaPresenca?.rsvp ?? ""}
                className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="" disabled>
                  Escolha...
                </option>
                <option value={RSVP.VOU}>Vou</option>
                <option value={RSVP.NAO_VOU}>Não vou</option>
                <option value={RSVP.TALVEZ}>Talvez</option>
              </select>
              <Button type="submit" size="sm" variant="outline">
                Confirmar
              </Button>
            </form>
            {Object.keys(rsvpCounts).length > 0 && (
              <p className="text-xs text-muted-foreground">
                {Object.entries(rsvpCounts)
                  .map(([r, n]) => `${rsvpLabel[r] ?? r}: ${n}`)
                  .join(" · ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Decisões propostas</CardTitle>
        </CardHeader>
        <CardContent>
          {reuniao.decisoes.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-3">Sem decisões registadas.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {reuniao.decisoes.map((d) => (
                <div
                  key={d.id}
                  className="border-b last:border-0 py-2 flex justify-between items-start gap-3"
                >
                  <div>
                    <p className="font-medium">
                      {d.titulo}{" "}
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {d.tipo}
                      </Badge>
                    </p>
                    {d.descricao && <p className="text-sm text-muted-foreground">{d.descricao}</p>}
                  </div>
                  {d.resultado && (
                    <Badge
                      variant={
                        d.resultado === ResultadoDecisao.APROVADO
                          ? "success"
                          : d.resultado === ResultadoDecisao.REJEITADO
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {d.resultado}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {podeEditar && (
            <form action={adicionarDecisaoGenerica} className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">Adicionar decisão genérica</p>
              <Input name="titulo" placeholder="Título da decisão" required />
              <Input name="descricao" placeholder="Descrição (opcional)" />
              <Button type="submit" size="sm" variant="outline">
                Adicionar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Publicar acta</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={publicarActa} className="space-y-4">
              <div className="space-y-2">
                <Label>Resultado das decisões</Label>
                {reuniao.decisoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Não há decisões a votar.</p>
                ) : (
                  <div className="space-y-2">
                    {reuniao.decisoes.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 border-b last:border-0 py-2"
                      >
                        <span className="text-sm">{d.titulo}</span>
                        <select
                          name={`res_${d.id}`}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          defaultValue=""
                        >
                          <option value="">(não votado)</option>
                          <option value={ResultadoDecisao.APROVADO}>Aprovado</option>
                          <option value={ResultadoDecisao.REJEITADO}>Rejeitado</option>
                          <option value={ResultadoDecisao.ADIADO}>Adiado</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Presenças</Label>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  {memberships.map((m) => (
                    <label key={m.id} className="flex items-center gap-2">
                      <input type="checkbox" name="presente" value={m.id} />
                      {m.user.nome}
                      {m.fracao ? ` (${m.fracao.identificador})` : ""}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actaTexto">Texto da acta</Label>
                <textarea
                  id="actaTexto"
                  name="actaTexto"
                  rows={6}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="semQuorum" />
                Reunião sem quórum (não conta como aprovação de decisões)
              </label>

              <Button type="submit">Publicar acta</Button>
            </form>
          </CardContent>
        </Card>
      ) : reuniao.actaTexto ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Acta{reuniao.estado === EstadoReuniao.SEM_QUORUM ? " (sem quórum)" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm font-sans">{reuniao.actaTexto}</pre>
            {reuniao.publicadaEm && (
              <p className="text-xs text-muted-foreground mt-3">
                Publicada em {formatDataHora(reuniao.publicadaEm)}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
