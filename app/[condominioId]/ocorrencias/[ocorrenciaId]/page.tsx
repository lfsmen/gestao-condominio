import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import { AuditAction, EstadoOcorrencia } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatDataHora } from "@/lib/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const localLabel: Record<string, string> = {
  FRACAO: "Minha fração",
  ZONAS_COMUNS: "Zonas comuns",
  EXTERIOR: "Exterior",
};

const estadoLabel: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em análise",
  EM_RESOLUCAO: "Em resolução",
  RESOLVIDA: "Resolvida",
  ARQUIVADA: "Arquivada",
  REJEITADA: "Rejeitada",
  INACTIVA: "Inactiva",
};

const urgenciaVariant: Record<string, "destructive" | "secondary" | "outline"> = {
  ALTA: "destructive",
  MEDIA: "secondary",
  BAIXA: "outline",
};

// Estados que o admin pode definir manualmente (não inclui INACTIVA — gerido por cron)
const ESTADOS_ADMIN = [
  EstadoOcorrencia.ABERTA,
  EstadoOcorrencia.EM_ANALISE,
  EstadoOcorrencia.EM_RESOLUCAO,
  EstadoOcorrencia.RESOLVIDA,
  EstadoOcorrencia.ARQUIVADA,
  EstadoOcorrencia.REJEITADA,
];

export default async function OcorrenciaDetalhe({
  params,
}: {
  params: Promise<{ condominioId: string; ocorrenciaId: string }>;
}) {
  const session = await requireSession();
  const { condominioId, ocorrenciaId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();

  const oc = await prisma.ocorrencia.findFirst({
    where: { id: ocorrenciaId, condominioId },
    include: {
      comentarios: {
        orderBy: { createdAt: "asc" },
        include: {
          ocorrencia: false,
        },
      },
    },
  });
  if (!oc) notFound();

  // Carregar dados dos autores dos comentários de uma vez
  const autorIds = [oc.autorMembershipId, ...oc.comentarios.map((c) => c.autorId)];
  const memberships = await prisma.membership.findMany({
    where: { id: { in: autorIds } },
    include: { user: true, fracao: true },
  });
  const memberMap = Object.fromEntries(memberships.map((m) => [m.id, m]));

  const autor = memberMap[oc.autorMembershipId];

  async function adicionarComentario(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c) throw new Error("Não autorizado");
    const texto = String(formData.get("texto") ?? "").trim();
    if (!texto || texto.length < 1) throw new Error("Comentário vazio");

    await prisma.comentarioOcorrencia.create({
      data: {
        ocorrenciaId,
        autorId: c.membershipId,
        texto,
      },
    });
    await prisma.ocorrencia.update({
      where: { id: ocorrenciaId },
      data: { ultimoUpdate: new Date() },
    });
    redirect(`/${condominioId}/ocorrencias/${ocorrenciaId}`);
  }

  async function mudarEstado(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || !isAdmin(c)) throw new Error("Não autorizado");

    const novoEstado = String(formData.get("estado"));
    const motivoRejeicao = String(formData.get("motivoRejeicao") ?? "").trim();

    if (!ESTADOS_ADMIN.includes(novoEstado as never)) throw new Error("Estado inválido");

    const ocActual = await prisma.ocorrencia.findFirst({
      where: { id: ocorrenciaId, condominioId },
    });
    if (!ocActual) throw new Error("Ocorrência não encontrada");

    const updateData: { estado: string; ultimoUpdate: Date; descricao?: string } = {
      estado: novoEstado,
      ultimoUpdate: new Date(),
    };

    // Se REJEITADA, anexar motivo à descrição como nota interna
    if (novoEstado === EstadoOcorrencia.REJEITADA && motivoRejeicao) {
      updateData.descricao = `${ocActual.descricao}\n\n[REJEITADA: ${motivoRejeicao}]`;
    }

    await prisma.ocorrencia.update({ where: { id: ocorrenciaId }, data: updateData });

    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.OCORRENCIA_ESTADO_ALTERADO,
      entityType: "Ocorrencia",
      entityId: ocorrenciaId,
      payload: { estadoAnterior: ocActual.estado, novoEstado },
    });

    // Notificar o autor da ocorrência
    const autorMembership = await prisma.membership.findUnique({
      where: { id: ocActual.autorMembershipId },
      include: { user: true },
    });
    if (autorMembership && autorMembership.userId !== c.userId) {
      const condominio = await prisma.condominio.findUnique({ where: { id: condominioId } });
      await sendEmail({
        to: autorMembership.user.email,
        subject: `Ocorrência actualizada: ${ocActual.titulo}`,
        html: `<p>O estado da sua ocorrência em <strong>${condominio?.nome}</strong> foi actualizado.</p>
<p><strong>Título:</strong> ${ocActual.titulo}<br>
<strong>Novo estado:</strong> ${estadoLabel[novoEstado] ?? novoEstado}</p>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL}/${condominioId}/ocorrencias/${ocorrenciaId}">Ver ocorrência →</a></p>`,
        text: `A sua ocorrência "${ocActual.titulo}" foi actualizada para "${estadoLabel[novoEstado] ?? novoEstado}".`,
      });
    }

    redirect(`/${condominioId}/ocorrencias/${ocorrenciaId}`);
  }

  const estadoCor: Record<string, string> = {
    ABERTA: "outline",
    EM_ANALISE: "secondary",
    EM_RESOLUCAO: "secondary",
    RESOLVIDA: "success",
    ARQUIVADA: "outline",
    REJEITADA: "destructive",
    INACTIVA: "outline",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/${condominioId}/ocorrencias`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Ocorrências
          </Link>
          <h1 className="text-2xl font-bold mt-1">{oc.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {autor
              ? `${autor.user.nome}${autor.fracao ? ` · ${autor.fracao.identificador}` : ""}`
              : "—"}{" "}
            · {formatDataHora(oc.createdAt)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Badge variant={urgenciaVariant[oc.urgencia] ?? "outline"}>{oc.urgencia}</Badge>
          <Badge
            variant={
              (estadoCor[oc.estado] ?? "outline") as
                | "success"
                | "destructive"
                | "secondary"
                | "outline"
            }
          >
            {estadoLabel[oc.estado] ?? oc.estado}
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>📍 {localLabel[oc.local] ?? oc.local}</span>
          </div>
          <p className="whitespace-pre-wrap">{oc.descricao}</p>
        </CardContent>
      </Card>

      {isAdmin(ctx) && oc.estado !== EstadoOcorrencia.ARQUIVADA && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alterar estado</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={mudarEstado} className="space-y-3">
              <select
                name="estado"
                defaultValue={oc.estado}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {ESTADOS_ADMIN.map((e) => (
                  <option key={e} value={e}>
                    {estadoLabel[e] ?? e}
                  </option>
                ))}
              </select>
              <div className="space-y-1">
                <label htmlFor="motivoRejeicao" className="text-sm text-muted-foreground">
                  Motivo (obrigatório se Rejeitada)
                </label>
                <input
                  id="motivoRejeicao"
                  name="motivoRejeicao"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="Motivo de rejeição..."
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                Actualizar estado
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comentários ({oc.comentarios.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {oc.comentarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem comentários ainda.</p>
          ) : (
            <div className="space-y-3">
              {oc.comentarios.map((com) => {
                const comAutor = memberMap[com.autorId];
                return (
                  <div key={com.id} className="border-b last:border-0 pb-3 last:pb-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-sm font-medium">
                        {comAutor?.user.nome ?? "—"}
                        {comAutor?.fracao ? ` · ${comAutor.fracao.identificador}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDataHora(com.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{com.texto}</p>
                  </div>
                );
              })}
            </div>
          )}

          {oc.estado !== EstadoOcorrencia.ARQUIVADA && oc.estado !== EstadoOcorrencia.REJEITADA && (
            <form action={adicionarComentario} className="space-y-2 pt-2 border-t">
              <textarea
                name="texto"
                rows={2}
                required
                placeholder="Adicionar comentário..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button type="submit" size="sm">
                Comentar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
