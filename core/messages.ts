// Deterministic reading of supplier replies. Rules, not a model: they mark what a
// person must read and extract a delivery date when the text states one. The local
// model can add a second, revisable opinion; neither changes orders or stock.
export const replyCategories = [
  "out_of_stock",
  "cancellation",
  "change",
  "question",
  "delivery_date",
  "confirmation",
  "other",
] as const;
export type ReplyCategory = (typeof replyCategories)[number];
export type Interpretation = {
  category: ReplyCategory;
  needsReading: boolean;
  deliveryDate?: string;
  deliveryHint?: string;
  missing?: string;
  summary: string;
};
const fold = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const weekdays = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};
export const labels: Record<ReplyCategory, string> = {
  out_of_stock: "Falta de producto",
  cancellation: "Cancelación",
  change: "Cambio de condiciones",
  question: "Pregunta del proveedor",
  delivery_date: "Fecha de entrega",
  confirmation: "Confirmación",
  other: "Sin interpretar",
};
export function resolveDate(
  text: string,
  at: string,
): { date?: string; hint?: string } {
  const t = fold(text);
  const base = new Date(at);
  if (Number.isNaN(base.getTime())) return {};
  const explicit = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (explicit) {
    const day = Number(explicit[1]),
      month = Number(explicit[2]);
    let year = explicit[3] ? Number(explicit[3]) : base.getUTCFullYear();
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
      if (!explicit[3] && d < addDays(base, -30)) d.setUTCFullYear(year + 1);
      return { date: iso(d), hint: explicit[0] };
    }
  }
  if (/\bpasado manana\b/.test(t))
    return { date: iso(addDays(base, 2)), hint: "pasado mañana" };
  if (/\bmanana\b/.test(t))
    return { date: iso(addDays(base, 1)), hint: "mañana" };
  if (/\bhoy\b/.test(t)) return { date: iso(base), hint: "hoy" };
  const inDays = t.match(/\ben (\d{1,2}) dias?\b/);
  if (inDays)
    return { date: iso(addDays(base, Number(inDays[1]))), hint: inDays[0] };
  const dayOfMonth = t.match(/\bel (?:dia )?(\d{1,2})\b(?![/:-])/);
  if (dayOfMonth) {
    const day = Number(dayOfMonth[1]);
    if (day >= 1 && day <= 31) {
      let d = new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), day),
      );
      if (d.getUTCDate() !== day) d = addDays(d, 0);
      if (d < base)
        d = new Date(
          Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, day),
        );
      if (d.getUTCDate() === day) return { date: iso(d), hint: "el " + day };
    }
  }
  for (const [index, name] of weekdays.entries()) {
    if (new RegExp("\\b" + name + "\\b").test(t)) {
      let delta = (index - base.getUTCDay() + 7) % 7;
      if (delta === 0) delta = 7;
      return {
        date: iso(addDays(base, delta)),
        hint:
          name === "miercoles"
            ? "miércoles"
            : name === "sabado"
              ? "sábado"
              : name,
      };
    }
  }
  if (/semana que viene|proxima semana|la semana proxima/.test(t))
    return { hint: "la semana que viene" };
  return {};
}
export function interpretReply(text: string, at: string): Interpretation {
  const t = fold(text).trim();
  const when = resolveDate(text, at);
  const injected =
    /(?:ignora|ignore|olvida|disregard)\b[^\n]{0,90}(?:instrucciones|instructions|reglas|rules)|responde (?:solo |únicamente |unicamente )?(?:confirmation|confirmacion|ok)\b/.test(
      t,
    );
  const delayed =
    /retras|no podremos|no podemos|no vamos a poder|se demora|aplaz|se atrasa/.test(
      t,
    );
  const shortage =
    /(no (lo |la |los |las )?(tengo|tenemos|queda|quedan|hay|me queda|nos queda)|sin stock|agotad|no dispon|se (nos |me )?(ha )?acab|no (me |nos )?(ha )?(llega|llegado|entra|entrado)\b|no me ha entrado|no ha entrado)/.test(
      t,
    );
  const missingMatch = t.match(
    /(?:no (?:tengo|tenemos|queda|quedan|hay|me queda|nos queda)|sin stock de|agotad[oa]s? (?:el |la |los |las )?|se (?:nos |me )?(?:ha )?acab[oó] (?:el |la |los |las )?)\s*([^.,;!?\n]{2,60}?)(?=\s+(?:hasta|esta semana|este mes|de momento|por ahora|ahora|hoy)\b|[.,;!?\n]|$)/,
  );
  const partial =
    /\b(solo|nada mas|unicamente)\s+(?:me |nos |te )?(queda|quedan|tenemos|tengo|hay|te puedo|puedo)\b|en vez de|en lugar de/.test(
      t,
    );
  const cancellation = /\bcancel|anul/.test(t);
  const change =
    partial ||
    /sustitu|reemplaz|cambi[oa]|\bsube\b|subid|aument|precio|no es el mismo|diferente|otra marca|pedido minimo|minimo de|menos de \d|te faltan?\b/.test(
      t,
    );
  const question =
    /\?/.test(text) ||
    /\b(prefier|quieres|queres|te viene bien|te va bien|nos confirmas|me confirm(?:es|as|e)s?|nos confirm(?:es|as|e)s?|confirmame|confirmanos|avisame|avisanos|dime|dinos|mandame|enviame|pasame|necesito que|hace falta que|indicame|indicanos)\b/.test(
      t,
    );
  const confirmation =
    /^(ok|oka|okey|vale|perfecto|de acuerdo|listo|hecho|dale|genial|recibido|anotado|confirmado|confirmamos|entendido|si|todo correcto|todo bien)\b/.test(
      t,
    ) ||
    /\b(confirmad[oa]|te confirmo|os confirmo|recibido|anotado|de acuerdo|perfecto|sin problema|todo bien|todo correcto|quedamos asi|hemos recibido tu pedido)\b/.test(
      t,
    );
  const delivery =
    !!when.date ||
    !!when.hint ||
    /entrega|entregado|enviado|llega|llegamos|llegara|enviamos|sale hoy|sale manana|reparto|en camino|esta listo|pasa a recoger|con retraso|retras|llegar tarde|por la tarde|por la manana|primera hora|repartidor|camion/.test(
      t,
    );
  let category: ReplyCategory = "other";
  if (injected) category = "other";
  else if (shortage) category = "out_of_stock";
  else if (cancellation) category = "cancellation";
  else if (question && /\?/.test(text)) category = "question";
  else if (change) category = "change";
  else if (question) category = "question";
  else if (confirmation && !delayed) category = "confirmation";
  else if (delivery) category = "delivery_date";
  const needsReading =
    !["confirmation", "delivery_date"].includes(category) || delayed;
  const missing = missingMatch?.[1]?.trim();
  const dateText = when.date
    ? `Fecha indicada: ${when.date}${when.hint ? " («" + when.hint + "»)" : ""}.`
    : when.hint
      ? `Plazo indicado sin fecha exacta: «${when.hint}».`
      : "";
  const summary = {
    out_of_stock: `El proveedor indica falta de producto${missing ? " (" + missing + ")" : ""}. Puede impedir completar la compra: léelo.`,
    cancellation:
      "El proveedor menciona una cancelación o anulación. Léelo y decide.",
    change: partial
      ? "El proveedor indica que solo puede entregar una parte. Léelo y decide."
      : "El proveedor propone un cambio de producto, cantidad o precio. No se acepta sin tu revisión.",
    question:
      "El proveedor hace una pregunta o pide confirmación. Requiere tu respuesta.",
    delivery_date: delayed
      ? "El proveedor comunica un retraso en la entrega."
      : "El proveedor informa cuándo llega el pedido.",
    confirmation: "El proveedor confirma. No equivale a mercadería recibida.",
    other: "No se reconoce la intención del mensaje. Léelo.",
  }[category];
  return {
    category,
    needsReading,
    ...(when.date ? { deliveryDate: when.date } : {}),
    ...(when.hint ? { deliveryHint: when.hint } : {}),
    ...(missing ? { missing: missing.slice(0, 120) } : {}),
    summary: (summary + " " + dateText).trim().slice(0, 300),
  };
}
