import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import { AuditAction, Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatData } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";

export default async function TransferirAdminPage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();
  if (!isAdmin(ctx)) redirect(`/${condominioId}/dashboard`);

  const condominio = await prisma.condominio.findUnique({ where: { id: condominioId } });
  if (!condominio) notFound();

  // Admins actuais e moradores elegíveis
  const todosActivos = await prisma.membership.findMany({
    where: { condominioId, leftAt: null },
    include: { user: true, fracao: true },
    orderBy: { joinedAt: "asc" },
  });

  const admins = todosActivos.filter((m) => m.role === Role.ADMINISTRADOR);
  const moradores = todosActivos.filter(
    (m) => m.role === Role.MORADOR && m.id !== ctx.membershipId,
  );

  // Transições em curso (outros admins com expiração futura)
  const transicaoEmCurso = admins.find(
    (a) =>
      a.id !== ctx.membershipId &&
      a.adminTransicaoExpiraEm &&
      a.adminTransicaoExpiraEm > new Date(),
  );

  async function iniciarTransferencia(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || !isAdmin(c)) throw new Error("Não autorizado");

    const sucessorId = String(formData.get("sucessorId") ?? "").trim();
    if (!sucessorId) throw new Error("Seleccione um morador");

    const sucessor = await prisma.membership.findFirst({
      where: { id: sucessorId, condominioId, leftAt: null, role: Role.MORADOR },
      include: { user: true },
    });
    if (!sucessor) throw new Error("Morador não encontrado");

    // Promover sucessor a ADMINISTRADOR com transição de 7 dias
    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + 7);

    await prisma.membership.update({
      where: { id: sucessorId },
      data: {
        role: Role.ADMINISTRADOR,
        adminTransicaoExpiraEm: expiraEm,
      },
    });

    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.ADMIN_TRANSFERIDO,
      entityType: "Membership",
      entityId: sucessorId,
      payload: { sucessorEmail: sucessor.user.email, expiraEm },
    });

    // Notificar o sucessor
    const [admin, cond] = await Promise.all([
      prisma.membership.findUnique({ where: { id: c.membershipId }, include: { user: true } }),
      prisma.condominio.findUniqueOrThrow({ where: { id: condominioId } }),
    ]);
    await sendEmail({
      to: sucessor.user.email,
      subject: `Convite para Administrador — ${cond.nome}`,
      html: `<p>Olá ${sucessor.user.nome},</p>
<p>${admin?.user.nome ?? "O administrador actual"} propõe que assuma as funções de <strong>Administrador</strong> em <strong>${cond.nome}</strong>.</p>
<p>Durante os próximos 7 dias (até ${formatData(expiraEm)}), ambos têm acesso de administrador. Após esse período, o administrador anterior passa automaticamente a Morador.</p>
<p>Se não pretender aceitar, não é necessária qualquer acção — as suas permissões voltam ao normal ao fim dos 7 dias caso não exerça funções administrativas.</p>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL}/${condominioId}/dashboard">Aceder à aplicação →</a></p>`,
      text: `Foi-lhe atribuído o papel de Administrador em ${cond.nome}. Período de transição de 7 dias até ${formatData(expiraEm)}.`,
    });

    redirect(`/${condominioId}/admin/transferir`);
  }

  async function renunciar(_formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || !isAdmin(c)) throw new Error("Não autorizado");

    // Verificar que existe outro admin activo
    const outrosAdmins = await prisma.membership.count({
      where: {
        condominioId,
        leftAt: null,
        role: Role.ADMINISTRADOR,
        id: { not: c.membershipId },
      },
    });

    if (outrosAdmins === 0) {
      throw new Error(
        "Não pode renunciar: é o único administrador. Primeiro transfira para outro morador.",
      );
    }

    await prisma.membership.update({
      where: { id: c.membershipId },
      data: { role: Role.MORADOR, adminTransicaoExpiraEm: null },
    });

    await recordAudit({
      condominioId,
      membershipId: c.membershipId,
      action: AuditAction.ADMIN_TRANSFERIDO,
      entityType: "Membership",
      entityId: c.membershipId,
      payload: { acao: "RENUNCIA_IMEDIATA" },
    });

    redirect(`/${condominioId}/dashboard`);
  }

  const isUnicoAdmin = admins.length === 1 && admins[0].id === ctx.membershipId;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transferir administração</h1>
      <p className="text-muted-foreground text-sm">
        O papel de administrador é rotativo. Transfira quando chegar a sua vez.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Administradores actuais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 py-1">
                <div>
                  <span className="font-medium">{a.user.nome}</span>
                  {a.fracao && (
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      · {a.fracao.identificador}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {a.adminTransicaoExpiraEm && a.adminTransicaoExpiraEm > new Date() && (
                    <span className="text-xs text-muted-foreground">
                      transição até {formatData(a.adminTransicaoExpiraEm)}
                    </span>
                  )}
                  <Badge variant="outline">Admin</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!transicaoEmCurso && (
        <Card>
          <CardHeader>
            <CardTitle>Iniciar transferência</CardTitle>
          </CardHeader>
          <CardContent>
            {moradores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Não há moradores disponíveis para receber a administração. Convide primeiro um
                morador.
              </p>
            ) : (
              <form action={iniciarTransferencia} className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="sucessorId" className="text-sm font-medium">
                    Escolher sucessor
                  </label>
                  <select
                    id="sucessorId"
                    name="sucessorId"
                    required
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">— seleccionar morador —</option>
                    {moradores.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.user.nome}
                        {m.fracao ? ` · ${m.fracao.identificador}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  O morador escolhido passa imediatamente a Administrador. Ambos têm acesso durante
                  7 dias. Depois desse período, você passa a Morador — ou pode renunciar
                  imediatamente abaixo.
                </p>
                <Button type="submit">Iniciar transferência</Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {transicaoEmCurso && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm">
              Transferência em curso para <strong>{transicaoEmCurso.user.nome}</strong>. Período de
              sobreposição até{" "}
              {transicaoEmCurso.adminTransicaoExpiraEm
                ? formatData(transicaoEmCurso.adminTransicaoExpiraEm)
                : "—"}
              .
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Renunciar imediatamente</CardTitle>
        </CardHeader>
        <CardContent>
          {isUnicoAdmin ? (
            <p className="text-sm text-muted-foreground">
              É o único administrador. Inicie primeiro uma transferência para outro morador antes de
              renunciar.
            </p>
          ) : (
            <form action={renunciar}>
              <Button type="submit" variant="destructive">
                Renunciar agora (sem período de sobreposição)
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
