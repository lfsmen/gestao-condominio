import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/session";
import { Role } from "@/lib/constants";
import { getMembership } from "@/lib/tenancy";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CondominioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;

  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();

  const isAdmin = ctx.role === Role.ADMINISTRADOR;
  const base = `/${condominioId}`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link href={`${base}/dashboard`} className="font-semibold">
            {ctx.condominioNome}
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{session.nome}</span>
            <Badge variant={isAdmin ? "default" : "secondary"}>
              {isAdmin ? "Admin" : "Morador"}
            </Badge>
            <form action="/api/sign-out" method="post">
              <button type="submit" className="text-sm text-muted-foreground hover:underline">
                Sair
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto max-w-5xl px-4 pb-2 flex flex-wrap gap-1 text-sm">
          <Tab href={`${base}/dashboard`} label="Dashboard" />
          <Tab href={`${base}/orcamento/minhas-contas`} label="Minhas contas" />
          <Tab href={`${base}/orcamento/contas-gerais`} label="Contas gerais" />
          <Tab href={`${base}/reunioes`} label="Reuniões" />
          <Tab href={`${base}/ocorrencias`} label="Ocorrências" />
          {isAdmin && (
            <>
              <span className="mx-2 text-muted-foreground">|</span>
              <Tab href={`${base}/admin/quota-base`} label="Quota base" />
              <Tab href={`${base}/admin/grandes-despesas`} label="Grandes despesas" />
              <Tab href={`${base}/admin/despesas-correntes`} label="Correntes" />
              <Tab href={`${base}/admin/membros`} label="Membros" />
              <Tab href={`${base}/admin/transferir`} label="Transferir" />
              <Tab href={`${base}/admin/audit`} label="Audit" />
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl w-full px-4 py-6 flex-1">{children}</main>
    </div>
  );
}

function Tab({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
      {label}
    </Link>
  );
}

export const dynamic = "force-dynamic";
