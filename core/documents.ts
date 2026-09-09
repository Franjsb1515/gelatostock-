// Deterministic proposals for archived documents: which supplier, what kind of
// document and which order it belongs to. Proposals are shown to the person and
// applied only when confirmed. No model is involved here.
import type { State, Photo } from "./schema";
const fold = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export type DocType = NonNullable<Photo["docType"]>;
export type DocumentSuggestion = {
  supplier?: string;
  order?: string;
  docType?: DocType;
  reason: string;
};
// Document kind from the first lines of the recognized text.
export function guessDocType(text: string | undefined): DocType | undefined {
  if (!text) return undefined;
  const lines = fold(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 15);
  for (const t of lines) {
    if (/^(factura\s+)?proforma\b/.test(t)) return "proforma";
    if (/^(factura\s+rectificativa|nota\s+de\s+(abono|credito))\b/.test(t))
      return "abono";
    if (/^factura(\s+simplificada)?\b/.test(t)) return "factura";
    if (/^(recibo|justificante de pago|comprobante)\b/.test(t))
      return "factura";
    if (/^albaran\b/.test(t)) return "albaran";
    if (/^(lista(do)?\s+de\s+precios|tarifas?)\b/.test(t))
      return "lista_precios";
    if (/^oferta(s)?\b/.test(t)) return "oferta";
    if (/^(pedido|orden de compra)\b/.test(t)) return "otro";
  }
  return undefined;
}
// Total amount in cents if the text carries a clearly labelled total line.
export function documentTotalCents(
  text: string | undefined,
): number | undefined {
  if (!text) return undefined;
  const m = fold(text).match(
    /(?:^|\n)\s*(?:total(?:\s+factura|\s+a\s+pagar)?|importe(?:\s+total|\s+a\s+pagar))\s*:?\s*(?:eur|€)?\s*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+(?:\.\d{2})?)\s*(?:eur|€)?\s*(?:\n|$)/,
  );
  if (!m?.[1]) return undefined;
  let s = m[1];
  if (s.includes(",")) s = s.replaceAll(".", "").replace(",", ".");
  const n = Math.round(Number(s) * 100);
  return Number.isSafeInteger(n) ? n : undefined;
}
export function orderTotalCents(s: State, orderId: string): number {
  const o = s.orders.find((x) => x.id === orderId);
  return o ? o.lines.reduce((n, l) => n + l.packs * l.price, 0) : 0;
}
export function suggestDocument(s: State, doc: Photo): DocumentSuggestion {
  const text = doc.ocrText || "";
  const docType = doc.docType || guessDocType(text);
  const reasons: string[] = [];
  let supplier = doc.supplier;
  let order: string | undefined = doc.order;
  // 1. An explicit order number in the text wins.
  const refs = [...new Set(text.toUpperCase().match(/\bGS-\d+\b/g) || [])];
  if (!order && refs.length === 1) {
    const found = s.orders.find((o) => o.number === refs[0]);
    if (found && (!supplier || found.supplier === supplier)) {
      order = found.id;
      supplier = supplier || found.supplier;
      reasons.push(`El texto menciona ${found.number}.`);
    }
  }
  // 2. Otherwise, a single plausible order of the supplier around the document date.
  if (!order && supplier) {
    const date = new Date(
      (doc.documentDate || doc.at.slice(0, 10)) + "T23:59:59Z",
    ).getTime();
    const candidates = s.orders.filter(
      (o) =>
        o.supplier === supplier &&
        !["cancelled", "pending"].includes(o.status) &&
        new Date(o.at).getTime() <= date &&
        date - new Date(o.at).getTime() <= 60 * 86400000,
    );
    const total = documentTotalCents(text);
    const byAmount = total
      ? candidates.filter((o) => {
          const t = orderTotalCents(s, o.id);
          return t > 0 && Math.abs(t - total) <= Math.max(50, t * 0.05);
        })
      : [];
    if (byAmount.length === 1) {
      order = byAmount[0]!.id;
      reasons.push(
        `El importe del documento coincide con el estimado de ${byAmount[0]!.number}.`,
      );
    } else if (candidates.length === 1) {
      order = candidates[0]!.id;
      reasons.push(
        `Único pedido de este proveedor en los 60 días anteriores (${candidates[0]!.number}).`,
      );
    } else if (candidates.length > 1)
      reasons.push(
        `Hay ${candidates.length} pedidos posibles de este proveedor; elige uno a mano.`,
      );
  }
  if (docType && !doc.docType) reasons.push(`El encabezado indica ${docType}.`);
  if (!supplier)
    reasons.push("Sin proveedor: asígnalo desde la ficha del documento.");
  return {
    ...(supplier && supplier !== doc.supplier ? { supplier } : {}),
    ...(order && order !== doc.order ? { order } : {}),
    ...(docType && docType !== doc.docType ? { docType } : {}),
    reason: reasons.join(" ") || "Sin propuestas nuevas.",
  };
}
