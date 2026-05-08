-- ============================================================
-- Row Level Security (RLS) — Convívio v2.1
-- Aplicar no Supabase SQL Editor
-- ============================================================
-- Estratégia: RLS bloqueia acesso cross-tenant a nível de BD.
-- A aplicação já filtra por condominioId em todas as queries,
-- mas o RLS é a última linha de defesa.
-- O service role (backend / Prisma) bypassa o RLS por definição.
-- ============================================================

-- Activar RLS em todas as tabelas com condominioId
ALTER TABLE "Condominio"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Fracao"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Convite"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConfiguracaoQuota"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuotaMensal"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GrandeDespesa"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImputacaoExtra"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DespesaCorrente"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reuniao"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Decisao"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Presenca"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ocorrencia"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComentarioOcorrencia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"                 ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- NOTA IMPORTANTE:
-- O Prisma (backend Next.js) usa a service_role key que bypassa
-- o RLS automaticamente. As políticas abaixo bloqueiam qualquer
-- acesso directo à BD com a anon key ou credenciais de utilizador.
-- Isto garante que ninguém consegue fazer queries directas
-- cross-tenant via cliente Supabase JS.
-- ============================================================

-- Negar tudo para a role "anon" (acesso não autenticado)
CREATE POLICY "block_anon_condominio"           ON "Condominio"           FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_fracao"               ON "Fracao"               FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_membership"           ON "Membership"           FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_convite"              ON "Convite"              FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_configuracaoquota"    ON "ConfiguracaoQuota"    FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_quotamensal"          ON "QuotaMensal"          FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_grandedespesa"        ON "GrandeDespesa"        FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_imputacaoextra"       ON "ImputacaoExtra"       FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_despesacorrente"      ON "DespesaCorrente"      FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_reuniao"              ON "Reuniao"              FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_decisao"              ON "Decisao"              FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_presenca"             ON "Presenca"             FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_ocorrencia"           ON "Ocorrencia"           FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_comentario"           ON "ComentarioOcorrencia" FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_auditlog"             ON "AuditLog"             FOR ALL TO anon USING (false);
CREATE POLICY "block_anon_user"                 ON "User"                 FOR ALL TO anon USING (false);

-- Negar tudo para a role "authenticated" (acesso via Supabase Auth JS)
-- O acesso legítimo é sempre via service_role (Prisma no backend)
CREATE POLICY "block_authenticated_condominio"           ON "Condominio"           FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_fracao"               ON "Fracao"               FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_membership"           ON "Membership"           FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_convite"              ON "Convite"              FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_configuracaoquota"    ON "ConfiguracaoQuota"    FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_quotamensal"          ON "QuotaMensal"          FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_grandedespesa"        ON "GrandeDespesa"        FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_imputacaoextra"       ON "ImputacaoExtra"       FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_despesacorrente"      ON "DespesaCorrente"      FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_reuniao"              ON "Reuniao"              FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_decisao"              ON "Decisao"              FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_presenca"             ON "Presenca"             FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_ocorrencia"           ON "Ocorrencia"           FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_comentario"           ON "ComentarioOcorrencia" FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_auditlog"             ON "AuditLog"             FOR ALL TO authenticated USING (false);
CREATE POLICY "block_authenticated_user"                 ON "User"                 FOR ALL TO authenticated USING (false);
