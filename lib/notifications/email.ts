/**
 * Stub de email — em produção, substituir por integração Resend.
 * Em dev escreve no console + persiste num ficheiro local para inspecção.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const LOG_FILE = path.join(process.cwd(), "tmp", "emails.log");

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  icsContent?: string; // conteúdo .ics para anexo de calendário
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const { Resend } = await import("resend").catch(() => ({ Resend: null as never }));
    if (Resend) {
      const resend = new Resend(apiKey);
      const from = process.env.RESEND_FROM_EMAIL ?? "noreply@example.pt";
      const attachments = params.icsContent
        ? [
            {
              filename: "convocatoria.ics",
              content: Buffer.from(params.icsContent).toString("base64"),
            },
          ]
        : undefined;
      await resend.emails.send({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        attachments,
      });
      return;
    }
  }
  // Dev: log para ficheiro.
  const icsNote = params.icsContent ? "\n[ANEXO: convocatoria.ics incluído]\n" : "";
  const entry = `\n=== ${new Date().toISOString()} ===\nTO: ${params.to}\nSUBJ: ${params.subject}${icsNote}\n\n${params.text ?? params.html}\n`;
  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, entry, "utf8");
  } catch {
    // ignore
  }
  console.log(
    `[email-dev] -> ${params.to} :: ${params.subject}${params.icsContent ? " [+.ics]" : ""}`,
  );
}
