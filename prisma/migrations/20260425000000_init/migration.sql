-- CreateTable
CREATE TABLE "Condominio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "morada" TEXT NOT NULL,
    "nif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Condominio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fracao" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "permilagem" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fracaoId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MORADOR',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convite" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fracaoId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MORADOR',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoQuota" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "valorUnicoCents" INTEGER,
    "valoresPorFracao" TEXT,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "vigenteAte" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracaoQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaMensal" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "fracaoId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "valorBaseCents" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDENTE',
    "pagaEm" TIMESTAMP(3),
    "comprovativoUrl" TEXT,
    "correcaoMotivo" TEXT,
    "corrigidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrandeDespesa" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorTotalCents" INTEGER NOT NULL,
    "numeroMeses" INTEGER NOT NULL,
    "mesInicial" INTEGER NOT NULL,
    "anoInicial" INTEGER NOT NULL,
    "modoRateio" TEXT NOT NULL DEFAULT 'IGUAL',
    "estado" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "decisaoId" TEXT,
    "executadaEm" TIMESTAMP(3),
    "valorFinalCents" INTEGER,
    "notaExecucao" TEXT,
    "anuladaEm" TIMESTAMP(3),
    "anuladaMotivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrandeDespesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImputacaoExtra" (
    "id" TEXT NOT NULL,
    "grandeDespesaId" TEXT NOT NULL,
    "fracaoId" TEXT NOT NULL,
    "quotaMensalId" TEXT,
    "mesAplicacao" INTEGER NOT NULL,
    "anoAplicacao" INTEGER NOT NULL,
    "valorCents" INTEGER NOT NULL,
    "prestacaoActual" INTEGER NOT NULL,
    "prestacoesTotal" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDENTE',
    "reembolsadaEm" TIMESTAMP(3),
    "reembolsadaNotas" TEXT,
    "reembolsadaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImputacaoExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DespesaCorrente" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorCents" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "categoria" TEXT,
    "comprovativoUrl" TEXT,
    "anuladaEm" TIMESTAMP(3),
    "anuladaMotivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DespesaCorrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reuniao" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "local" TEXT,
    "ordemDoDia" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'AGENDADA',
    "actaTexto" TEXT,
    "publicadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reuniao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decisao" (
    "id" TEXT NOT NULL,
    "reuniaoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'GENERICA',
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "resultado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decisao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presenca" (
    "id" TEXT NOT NULL,
    "reuniaoId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT false,
    "rsvp" TEXT,

    CONSTRAINT "Presenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "autorMembershipId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABERTA',
    "fotosUrls" TEXT,
    "ultimoUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "membershipId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fracao_condominioId_idx" ON "Fracao"("condominioId");

-- CreateIndex
CREATE UNIQUE INDEX "Fracao_condominioId_identificador_key" ON "Fracao"("condominioId", "identificador");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_condominioId_idx" ON "Membership"("condominioId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_condominioId_userId_key" ON "Membership"("condominioId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Convite_tokenHash_key" ON "Convite"("tokenHash");

-- CreateIndex
CREATE INDEX "Convite_condominioId_idx" ON "Convite"("condominioId");

-- CreateIndex
CREATE INDEX "Convite_email_idx" ON "Convite"("email");

-- CreateIndex
CREATE INDEX "ConfiguracaoQuota_condominioId_vigenteDesde_idx" ON "ConfiguracaoQuota"("condominioId", "vigenteDesde");

-- CreateIndex
CREATE INDEX "QuotaMensal_condominioId_ano_mes_idx" ON "QuotaMensal"("condominioId", "ano", "mes");

-- CreateIndex
CREATE INDEX "QuotaMensal_condominioId_estado_idx" ON "QuotaMensal"("condominioId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaMensal_fracaoId_ano_mes_key" ON "QuotaMensal"("fracaoId", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "GrandeDespesa_decisaoId_key" ON "GrandeDespesa"("decisaoId");

-- CreateIndex
CREATE INDEX "GrandeDespesa_condominioId_estado_idx" ON "GrandeDespesa"("condominioId", "estado");

-- CreateIndex
CREATE INDEX "ImputacaoExtra_fracaoId_anoAplicacao_mesAplicacao_idx" ON "ImputacaoExtra"("fracaoId", "anoAplicacao", "mesAplicacao");

-- CreateIndex
CREATE INDEX "ImputacaoExtra_grandeDespesaId_idx" ON "ImputacaoExtra"("grandeDespesaId");

-- CreateIndex
CREATE INDEX "ImputacaoExtra_grandeDespesaId_estado_reembolsadaEm_idx" ON "ImputacaoExtra"("grandeDespesaId", "estado", "reembolsadaEm");

-- CreateIndex
CREATE INDEX "DespesaCorrente_condominioId_data_idx" ON "DespesaCorrente"("condominioId", "data");

-- CreateIndex
CREATE INDEX "Reuniao_condominioId_data_idx" ON "Reuniao"("condominioId", "data");

-- CreateIndex
CREATE INDEX "Decisao_reuniaoId_idx" ON "Decisao"("reuniaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Presenca_reuniaoId_membershipId_key" ON "Presenca"("reuniaoId", "membershipId");

-- CreateIndex
CREATE INDEX "Ocorrencia_condominioId_estado_idx" ON "Ocorrencia"("condominioId", "estado");

-- CreateIndex
CREATE INDEX "AuditLog_condominioId_createdAt_idx" ON "AuditLog"("condominioId", "createdAt");

-- AddForeignKey
ALTER TABLE "Fracao" ADD CONSTRAINT "Fracao_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_fracaoId_fkey" FOREIGN KEY ("fracaoId") REFERENCES "Fracao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfiguracaoQuota" ADD CONSTRAINT "ConfiguracaoQuota_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaMensal" ADD CONSTRAINT "QuotaMensal_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaMensal" ADD CONSTRAINT "QuotaMensal_fracaoId_fkey" FOREIGN KEY ("fracaoId") REFERENCES "Fracao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrandeDespesa" ADD CONSTRAINT "GrandeDespesa_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrandeDespesa" ADD CONSTRAINT "GrandeDespesa_decisaoId_fkey" FOREIGN KEY ("decisaoId") REFERENCES "Decisao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImputacaoExtra" ADD CONSTRAINT "ImputacaoExtra_grandeDespesaId_fkey" FOREIGN KEY ("grandeDespesaId") REFERENCES "GrandeDespesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImputacaoExtra" ADD CONSTRAINT "ImputacaoExtra_fracaoId_fkey" FOREIGN KEY ("fracaoId") REFERENCES "Fracao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImputacaoExtra" ADD CONSTRAINT "ImputacaoExtra_quotaMensalId_fkey" FOREIGN KEY ("quotaMensalId") REFERENCES "QuotaMensal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImputacaoExtra" ADD CONSTRAINT "ImputacaoExtra_reembolsadaPor_fkey" FOREIGN KEY ("reembolsadaPor") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaCorrente" ADD CONSTRAINT "DespesaCorrente_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reuniao" ADD CONSTRAINT "Reuniao_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decisao" ADD CONSTRAINT "Decisao_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "Reuniao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "Reuniao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
