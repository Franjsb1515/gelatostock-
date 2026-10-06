import { z } from "zod";
import type { State } from "./schema";
export const identityInput = z.object({
  text: z.string().max(20000).default(""),
  sender: z.string().max(40).default(""),
  channel: z.enum(["document", "whatsapp"]).default("document"),
});
const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const alike = (v: string) => v.replace(/[il1]/g, "l");
const phone = (v: string) => v.replace(/[ ()-]/g, "");
export function identifySupplier(s: State, input: unknown) {
  const { text, sender, channel } = identityInput.parse(input);
  const normalized = " " + fold(text) + " ";
  const candidates: {
    id: string;
    name: string;
    reason: string;
    score: number;
  }[] = [];
  for (const p of s.suppliers) {
    let score = 0,
      reason = "";
    const names = [p.name, ...(p.aliases || "").split(/[;\n]/)]
      .map(fold)
      .filter((v) => v.length >= 5);
    if (names.some((n) => normalized.includes(" " + n + " "))) {
      score = 1;
      reason = "Nombre o alias encontrado en el texto.";
    } else if (
      channel === "document" &&
      names.some((n) => alike(normalized).includes(" " + alike(n) + " "))
    ) {
      // La lectura de una foto confunde la «I», la «l» y el «1» («Gelato ltalia»). Vale menos que
      // el nombre exacto, y la persona lo confirma igual.
      score = 0.5;
      reason =
        "Nombre o alias encontrado en el texto (con una letra que la lectura confunde, como «l» e «I»).";
    }
    const tax = fold(p.taxId || "");
    if (tax.length >= 8 && normalized.includes(" " + tax + " ")) {
      score = 2;
      reason = "NIF/CIF registrado encontrado en el texto.";
    }
    if (
      channel === "whatsapp" &&
      sender &&
      p.whatsapp &&
      phone(sender) === phone(p.whatsapp)
    ) {
      score = 3;
      reason = "Número de remitente coincidente con la ficha local.";
    }
    if (score) candidates.push({ id: p.id, name: p.name, score, reason });
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const tied =
    best && candidates.filter((c) => c.score === best.score).length > 1;
  const matched = best && !tied && (channel !== "whatsapp" || best.score === 3);
  return {
    status: matched ? "matched" : candidates.length ? "review" : "unknown",
    supplier: matched ? best.id : undefined,
    candidates,
    reason: matched
      ? best.reason
      : channel === "whatsapp"
        ? "El remitente no identifica de forma única a un proveedor registrado."
        : candidates.length
          ? "Hay varios proveedores posibles. Elige el emisor del documento."
          : "No se encontró ningún proveedor tuyo en el texto. Elígelo a mano o añade sus datos en Proveedores.",
  };
}
