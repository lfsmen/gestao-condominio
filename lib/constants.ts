// Constantes tipadas para os valores que estariam em enums Prisma
// (SQLite não suporta enums; em Postgres podemos migrar para enum nativo).
// SPEC §5 v2.1.

export const Role = {
  ADMINISTRADOR: "ADMINISTRADOR",
  MORADOR: "MORADOR",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ModoQuota = {
  VALOR_UNICO: "VALOR_UNICO",
  PERMILAGEM: "PERMILAGEM",
  MANUAL: "MANUAL",
} as const;
export type ModoQuota = (typeof ModoQuota)[keyof typeof ModoQuota];

export const EstadoQuota = {
  PENDENTE: "PENDENTE",
  PAGA: "PAGA",
  EM_ATRASO: "EM_ATRASO",
  ANULADA: "ANULADA",
} as const;
export type EstadoQuota = (typeof EstadoQuota)[keyof typeof EstadoQuota];

export const ModoRateio = {
  IGUAL: "IGUAL",
  PERMILAGEM: "PERMILAGEM",
} as const;
export type ModoRateio = (typeof ModoRateio)[keyof typeof ModoRateio];

export const EstadoGrandeDespesa = {
  RASCUNHO: "RASCUNHO",
  EM_VOTACAO: "EM_VOTACAO",
  APROVADA: "APROVADA",
  REJEITADA: "REJEITADA",
  EXECUTADA: "EXECUTADA",
  ANULADA: "ANULADA",
} as const;
export type EstadoGrandeDespesa = (typeof EstadoGrandeDespesa)[keyof typeof EstadoGrandeDespesa];

export const EstadoImputacao = {
  PENDENTE: "PENDENTE",
  APLICADA: "APLICADA",
  ANULADA: "ANULADA",
} as const;
export type EstadoImputacao = (typeof EstadoImputacao)[keyof typeof EstadoImputacao];

export const EstadoReuniao = {
  AGENDADA: "AGENDADA",
  CONCLUIDA: "CONCLUIDA",
  CANCELADA: "CANCELADA",
  SEM_QUORUM: "SEM_QUORUM",
} as const;
export type EstadoReuniao = (typeof EstadoReuniao)[keyof typeof EstadoReuniao];

export const TipoDecisao = {
  GENERICA: "GENERICA",
  GRANDE_DESPESA: "GRANDE_DESPESA",
} as const;
export type TipoDecisao = (typeof TipoDecisao)[keyof typeof TipoDecisao];

export const ResultadoDecisao = {
  APROVADO: "APROVADO",
  REJEITADO: "REJEITADO",
  ADIADO: "ADIADO",
} as const;
export type ResultadoDecisao = (typeof ResultadoDecisao)[keyof typeof ResultadoDecisao];

export const EstadoOcorrencia = {
  ABERTA: "ABERTA",
  EM_ANALISE: "EM_ANALISE",
  EM_RESOLUCAO: "EM_RESOLUCAO",
  RESOLVIDA: "RESOLVIDA",
  ARQUIVADA: "ARQUIVADA",
  REJEITADA: "REJEITADA",
  INACTIVA: "INACTIVA",
} as const;
export type EstadoOcorrencia = (typeof EstadoOcorrencia)[keyof typeof EstadoOcorrencia];

export const LocalOcorrencia = {
  FRACAO: "FRACAO",
  ZONAS_COMUNS: "ZONAS_COMUNS",
  EXTERIOR: "EXTERIOR",
} as const;
export type LocalOcorrencia = (typeof LocalOcorrencia)[keyof typeof LocalOcorrencia];

export const UrgenciaOcorrencia = {
  BAIXA: "BAIXA",
  MEDIA: "MEDIA",
  ALTA: "ALTA",
} as const;
export type UrgenciaOcorrencia = (typeof UrgenciaOcorrencia)[keyof typeof UrgenciaOcorrencia];

export const RSVP = {
  VOU: "VOU",
  NAO_VOU: "NAO_VOU",
  TALVEZ: "TALVEZ",
} as const;
export type RSVP = (typeof RSVP)[keyof typeof RSVP];

// Acções de audit log
export const AuditAction = {
  CONDOMINIO_CRIADO: "CONDOMINIO_CRIADO",
  FRACAO_CRIADA: "FRACAO_CRIADA",
  CONVITE_ENVIADO: "CONVITE_ENVIADO",
  CONVITE_ACEITE: "CONVITE_ACEITE",
  QUOTA_BASE_ALTERADA: "QUOTA_BASE_ALTERADA",
  QUOTAS_GERADAS: "QUOTAS_GERADAS",
  QUOTA_PAGA: "QUOTA_PAGA",
  GRANDE_DESPESA_CRIADA: "GRANDE_DESPESA_CRIADA",
  GRANDE_DESPESA_APROVADA: "GRANDE_DESPESA_APROVADA",
  GRANDE_DESPESA_REJEITADA: "GRANDE_DESPESA_REJEITADA",
  GRANDE_DESPESA_EXECUTADA: "GRANDE_DESPESA_EXECUTADA",
  GRANDE_DESPESA_ANULADA: "GRANDE_DESPESA_ANULADA",
  REEMBOLSO_MARCADO: "REEMBOLSO_MARCADO",
  DESPESA_CORRENTE_CRIADA: "DESPESA_CORRENTE_CRIADA",
  DESPESA_CORRENTE_ANULADA: "DESPESA_CORRENTE_ANULADA",
  REUNIAO_CRIADA: "REUNIAO_CRIADA",
  ACTA_PUBLICADA: "ACTA_PUBLICADA",
  ADMIN_TRANSFERIDO: "ADMIN_TRANSFERIDO",
  OCORRENCIA_SUBMETIDA: "OCORRENCIA_SUBMETIDA",
  OCORRENCIA_ESTADO_ALTERADO: "OCORRENCIA_ESTADO_ALTERADO",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
