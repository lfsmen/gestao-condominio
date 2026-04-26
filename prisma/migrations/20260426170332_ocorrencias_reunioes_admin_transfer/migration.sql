-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "adminTransicaoExpiraEm" DATETIME;

-- CreateTable
CREATE TABLE "ComentarioOcorrencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ocorrenciaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComentarioOcorrencia_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "Ocorrencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ocorrencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "condominioId" TEXT NOT NULL,
    "autorMembershipId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "local" TEXT NOT NULL DEFAULT 'ZONAS_COMUNS',
    "urgencia" TEXT NOT NULL DEFAULT 'MEDIA',
    "estado" TEXT NOT NULL DEFAULT 'ABERTA',
    "fotosUrls" TEXT,
    "ultimoUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ocorrencia_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Ocorrencia" ("autorMembershipId", "condominioId", "createdAt", "descricao", "estado", "fotosUrls", "id", "titulo", "ultimoUpdate") SELECT "autorMembershipId", "condominioId", "createdAt", "descricao", "estado", "fotosUrls", "id", "titulo", "ultimoUpdate" FROM "Ocorrencia";
DROP TABLE "Ocorrencia";
ALTER TABLE "new_Ocorrencia" RENAME TO "Ocorrencia";
CREATE INDEX "Ocorrencia_condominioId_estado_idx" ON "Ocorrencia"("condominioId", "estado");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ComentarioOcorrencia_ocorrenciaId_createdAt_idx" ON "ComentarioOcorrencia"("ocorrenciaId", "createdAt");
