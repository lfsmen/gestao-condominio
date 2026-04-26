import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import { AuditAction, LocalOcorrencia, UrgenciaOcorrencia } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { getMembership } from "@/lib/tenancy";
import { formatDataHora } from "@/lib/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const urgenciaCor: Record<string, string> = {
  ALTA: "destructive",
  MEDIA: "secondary",
  BAIXA: "outline",
};

const localLabel: Record<string, string> = {
  FRACAO: "Minha fração",
  ZONAS_COMUNS: "Zonas comuns",
  EXTERIOR: "Exterior",
};

export default async function OcorrenciasPage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();

  const ocorrencias = await prisma.ocorrencia.findMany({
    where: { condominioId },
    orderBy: { ultimoUpdate: "desc" },
    include: { _count: { select: { comentarios: true } } },
  });

  async function criar(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c) throw new Error("Não autorizado");

    const titulo = String(formData.get("titulo") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim();
    const local = String(formData.get("local") ?? LocalOcorrencia.ZONAS_COMUNS);
    const urgencia = String(formData.get("urgencia") ?? UrgenciaOcorrencia.MEDIA);

    if (!titulo || titulo.length < 3 || titulo.length > 100)
      throw new Error("Título inválido (3–100 caracteres)");
    if (!descricao || descricao.length < 10)
      throw new Error("Descrição inválida (mínimo 10 caracteres)");
    if (!Object.values(LocalOcorrencia).includes(local as never)) throw new Error("Local inválido");
    if (!Object.values(UrgenciaOcorrencia).includes(urgencia as never))
      throw new Error("Urgência inválida");

    const oc = await prisma.ocorrencia.create({
      data: {
        condominioId,
        autorMembershipId: c.membershipId,
        titulo,
        descricao,
        local,
        urgencia,
      },
    });

    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.OCORRENCIA_SUBMETIDA,
      entityType: "Ocorrencia",
      entityId: oc.id,
      payload: { titulo, urgencia, local },
    });

    // Notificar admins
    const admins = await prisma.membership.findMany({
      where: { condominioId, leftAt: null, role: "ADMINISTRADOR" },
      include: { user: true },
    });
    const condominio = await prisma.condominio.findUnique({ where: { id: condominioId } });
    for (const admin of admins) {
      if (admin.userId !== c.userId) {
        await sendEmail({
          to: admin.user.email,
          subject: `Nova ocorrência${urgencia === "ALTA" ? " ⚠️ URGENTE" : ""}: ${titulo}`,
          html: `<p>Foi submetida uma nova ocorrência em <strong>${condominio?.nome}</strong>.</p>
<p><strong>Título:</strong> ${titulo}<br>
<strong>Local:</strong> ${localLabel[local] ?? local}<br>
<strong>Urgência:</strong> ${urgencia}<br>
<strong>Descrição:</strong> ${descricao}</p>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL}/${condominioId}/ocorrencias/${oc.id}">Ver ocorrência →</a></p>`,
          text: `Nova ocorrência: ${titulo}\nLocal: ${localLabel[local] ?? local}\nUrgência: ${urgencia}\n\n${descricao}`,
        });
      }
    }

    redirect(`/${condominioId}/ocorrencias/${oc.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ocorrências</h1>

      <Card>
        <CardHeader>
          <CardTitle>Nova ocorrência</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={criar} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" name="titulo" required minLength={3} maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="local">Local</Label>
                <select
                  id="local"
                  name="local"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value={LocalOcorrencia.ZONAS_COMUNS}>Zonas comuns</option>
                  <option value={LocalOcorrencia.FRACAO}>Minha fração</option>
                  <option value={LocalOcorrencia.EXTERIOR}>Exterior</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="urgencia">Urgência</Label>
                <select
                  id="urgencia"
                  name="urgencia"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value={UrgenciaOcorrencia.MEDIA}>Média</option>
                  <option value={UrgenciaOcorrencia.BAIXA}>Baixa</option>
                  <option value={UrgenciaOcorrencia.ALTA}>Alta</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="descricao">Descrição</Label>
              <textarea
                id="descricao"
                name="descricao"
                rows={3}
                required
                minLength={10}
                maxLength={2000}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit">Submeter</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {ocorrencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem ocorrências.</p>
        ) : (
          ocorrencias.map((o) => (
            <Link key={o.id} href={`/${condominioId}/ocorrencias/${o.id}`}>
              <Card className="hover:bg-accent transition-colors">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{o.titulo}</p>
                      <p className="text-sm text-muted-foreground">
                        {localLabel[o.local] ?? o.local} · {formatDataHora(o.ultimoUpdate)}
                        {o._count.comentarios > 0 && ` · ${o._count.comentarios} comentário(s)`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge
                        variant={
                          (urgenciaCor[o.urgencia] ?? "outline") as
                            | "destructive"
                            | "secondary"
                            | "outline"
                        }
                      >
                        {o.urgencia}
                      </Badge>
                      <Badge variant="outline">{o.estado}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
