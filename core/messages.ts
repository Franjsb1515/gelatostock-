// Deterministic reading of supplier replies. Rules, not a model: they mark what a
// person must read and extract a delivery date when the text states one. The local
// model can add a second, revisable opinion; neither changes orders or stock.
// Corrections made by the person are remembered (learned phrases) and applied first.
export const replyCategories = [
  "out_of_stock",
  "cancellation",
  "closed",
  "payment",
  "change",
  "question",
  "document",
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
  priceTo?: number;
  priceFrom?: number;
  priceHint?: string;
  summary: string;
  learned?: boolean;
  corrected?: boolean;
};
export type LearnedPhrase = { pattern: string; category: ReplyCategory };
export const fold = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Canonical form used to remember and match corrected messages.
export const normalizePhrase = (v: string) =>
  fold(v)
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
const weekdays = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];
const months = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
// Calendar day in local time: a message at 00:30 in Palma is "today" there, not yesterday (UTC).
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const iso = localDate;
const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};
export const labels: Record<ReplyCategory, string> = {
  out_of_stock: "Falta de producto",
  cancellation: "Cancelación",
  closed: "Cierre o vacaciones",
  payment: "Pago o factura pendiente",
  change: "Cambio de condiciones",
  question: "Pregunta o petición del proveedor",
  document: "Documento enviado",
  delivery_date: "Fecha de entrega",
  confirmation: "Confirmación",
  other: "Sin interpretar",
};
// Categories that never require reading unless a delay is involved.
const quiet = new Set<ReplyCategory>(["confirmation", "delivery_date"]);
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
    let year = explicit[3] ? Number(explicit[3]) : base.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day, 12);
    if (d.getMonth() === month - 1 && d.getDate() === day) {
      if (!explicit[3] && d < addDays(base, -30)) d.setFullYear(year + 1);
      return { date: iso(d), hint: explicit[0] };
    }
  }
  const named = t.match(
    /\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/,
  );
  if (named) {
    const day = Number(named[1]);
    const month = months.indexOf(
      named[2] === "setiembre" ? "septiembre" : named[2] || "",
    );
    let d = new Date(base.getFullYear(), month, day, 12);
    if (d < addDays(base, -30))
      d = new Date(base.getFullYear() + 1, month, day, 12);
    if (d.getDate() === day) return { date: iso(d), hint: named[0] };
  }
  if (/\bpasado manana\b/.test(t))
    return { date: iso(addDays(base, 2)), hint: "pasado mañana" };
  if (/\b(manana|mnn|mñn)\b/.test(t))
    return { date: iso(addDays(base, 1)), hint: "mañana" };
  if (/\b(hoy|esta tarde|esta manana|ahora mismo)\b/.test(t))
    return { date: iso(base), hint: "hoy" };
  const inDays = t.match(/\ben (\d{1,2}) dias?\b/);
  if (inDays)
    return { date: iso(addDays(base, Number(inDays[1]))), hint: inDays[0] };
  const dayOfMonth = t.match(/\bel (?:dia )?(\d{1,2})\b(?![/:-])/);
  if (dayOfMonth) {
    const day = Number(dayOfMonth[1]);
    if (day >= 1 && day <= 31) {
      let d = new Date(base.getFullYear(), base.getMonth(), day, 12);
      if (iso(d) < iso(base))
        d = new Date(base.getFullYear(), base.getMonth() + 1, day, 12);
      if (d.getDate() === day) return { date: iso(d), hint: "el " + day };
    }
  }
  for (const [index, name] of weekdays.entries()) {
    if (new RegExp("\\b" + name + "\\b").test(t)) {
      let delta = (index - base.getDay() + 7) % 7;
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
  const hour = t.match(/\b(antes de|sobre|a) las (\d{1,2})(?::\d{2})?\b/);
  if (hour) return { hint: hour[0] };
  if (/\bprimera hora\b/.test(t)) return { hint: "a primera hora" };
  return {};
}
export type PriceReading = { to: number; from?: number; hint: string };
const amountCents = (v: string) =>
  Math.round(Number(v.replace(",", ".")) * 100);
// A price the supplier states in a message. Rules, and deliberately narrow: only when the text
// speaks of a price AND writes either "de X € a Y €" or a single amount in euros. Anything more
// ambiguous returns nothing, because a wrong price would falsify the cost of the recipes.
// It is always a proposal: writing it down needs the person (action setPrice).
export function readPriceChange(text: string): PriceReading | undefined {
  const t = fold(text);
  if (
    !/\b(precio|precios|tarifa|tarifas|sube|suben|subida|subimos|baja|bajan|bajada|cuesta|vale|queda en|pasa|pasan|se queda en|nuevo importe)\b/.test(
      t,
    )
  )
    return undefined;
  const euro = "(?:€|eur\\b|euros?\\b)";
  const num = "(\\d{1,6}(?:[.,]\\d{1,2})?)";
  const pair = t.match(
    new RegExp(
      "\\bde\\s+" + num + "\\s*" + euro + "?\\s+a\\s+" + num + "\\s*" + euro,
    ),
  );
  if (pair) {
    const from = amountCents(pair[1]!);
    const to = amountCents(pair[2]!);
    if (to > 0 && from > 0 && to <= 100_000_000 && from <= 100_000_000)
      return { to, from, hint: pair[0]!.trim().slice(0, 80) };
  }
  const singles = [...t.matchAll(new RegExp(num + "\\s*" + euro, "g"))];
  if (singles.length !== 1) return undefined;
  const to = amountCents(singles[0]![1]!);
  if (to <= 0 || to > 100_000_000) return undefined;
  return { to, hint: singles[0]![0]!.trim().slice(0, 80) };
}
// Learned phrases match when the normalized text is the same or nearly the same.
function matchLearned(
  text: string,
  learned: LearnedPhrase[] | undefined,
): LearnedPhrase | undefined {
  if (!learned?.length) return undefined;
  const norm = normalizePhrase(text);
  if (!norm) return undefined;
  const tokens = new Set(norm.split(" "));
  let best: LearnedPhrase | undefined;
  let bestScore = 0;
  for (const item of learned) {
    if (item.pattern === norm) return item;
    const other = new Set(item.pattern.split(" "));
    if (tokens.size < 2 || other.size < 2) continue;
    let common = 0;
    for (const w of tokens) if (other.has(w)) common++;
    const score = common / (tokens.size + other.size - common);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 0.8 ? best : undefined;
}
export function interpretReply(
  text: string,
  at: string,
  learned?: LearnedPhrase[],
): Interpretation {
  const t = fold(text).trim();
  const when = resolveDate(text, at);
  const remembered = matchLearned(text, learned);
  const injected =
    /(?:ignora|ignore|olvida|disregard)\b[^\n]{0,90}(?:instrucciones|instructions|reglas|rules)|responde (?:solo |unicamente )?(?:confirmation|confirmacion|ok)\b/.test(
      t,
    );
  const delayed =
    /retras|no podremos|no podemos|no vamos a poder|se demora|aplaz|se atrasa|no llegamos hoy/.test(
      t,
    );
  const shortage =
    /(no (lo |la |los |las |nos |me )?(tengo|tenemos|queda|quedan|kedan?|qedan?|hay|dispongo|disponemos)|sin stock|agotad|no dispon|se (nos |me )?(ha )?acab|no (me |nos )?(ha )?(llega|llegado|entra|entrado)\b|no me ha entrado|no ha entrado|ultima unidad|ultimas unidades)/.test(
      t,
    ) &&
    !/no hay (reparto|nadie|problema|prisa|ruta|servicio|nada que|inconveniente)/.test(
      t,
    );
  const missingMatch = t.match(
    /(?:no (?:nos |me )?(?:tengo|tenemos|queda|quedan|kedan?|hay|me queda|nos queda)|sin stock de|agotad[oa]s? (?:el |la |los |las )?|se (?:nos |me )?(?:ha )?acab[oó] (?:el |la |los |las )?)\s*([^.,;!?\n]{2,60}?)(?=\s+(?:hasta|esta semana|este mes|de momento|por ahora|ahora|hoy|lo siento)\b|[.,;!?\n]|$)/,
  );
  const partial =
    /\b(solo|nada mas|unicamente)\s+(?:me |nos |te )?(queda|quedan|tenemos|tengo|hay|te puedo|puedo)\b|en vez de|en lugar de|stock limitado|pocas unidades|ultim[oa]s? (cubeta|caja|unidad|tarrina)/.test(
      t,
    );
  const cancellation = /\bcancel|anul/.test(t);
  const closed =
    /\b(vacaciones|cerrad[oa]s?|cerramos|festivo|no abrimos|no servimos|no repartimos|sin servicio)\b/.test(
      t,
    );
  const payment =
    /\b(pago|pagos|pagar|pagado|pagarlo|transferencia|cobr[oa]r?|vence|vencimiento|recibo|efectivo|domicili|impagad[oa]|pendiente de pago|pendiente la factura|factura pendiente)\b/.test(
      t,
    );
  const promotion = /\b(oferta|promoci|descuento|2x1|3x2|rebaja)\b/.test(t);
  const change =
    partial ||
    /sustitu|reemplaz|cambi[oa]|\bsube\b|subid|aument|precio|tarifa|no es el mismo|diferente|otra marca|pedido minimo|minimo de|menos de \d|te faltan?\b|abonamos|abonaremos|te abono|reclamaci/.test(
      t,
    );
  const question =
    /\?/.test(text) ||
    /\b(prefier|quieres|queres|te viene bien|te va bien|nos confirmas|me confirm(?:es|as|e)s?|nos confirm(?:es|as|e)s?|confirmame|confirmanos|avisame|avisanos|dime|dinos|mandame|enviame|pasame|necesito (?:que|el|la|los|las|tu|vuestro|un|una)|hace falta que|indicame|indicanos|devuelveme|devolvedme|traeme|traedme|recuerda|acuerdate|me puedes|nos puedes|podrias|podeis)\b/.test(
      t,
    );
  const document =
    /\b(factura|albaran|catalogo|presupuesto|nota de abono|justificante|pdf|escaneada|tarifa nueva|lista de precios)\b/.test(
      t,
    ) &&
    /adjunt|te paso|te mando|te envio|aqui va|aqui tienes|aqui te dejo|en el (mismo )?correo|firmad|foto|te dejo|os paso|os mando/.test(
      t,
    );
  const confirmation =
    /^(ok|oka|okey|vale|perfecto|de acuerdo|listo|hecho|dale|genial|recibido|anotado|confirmado|confirmamos|entendido|si|todo correcto|todo bien)\b/.test(
      t,
    ) ||
    /\b(confirmad[oa]|te confirmo|os confirmo|recibido|anotado|de acuerdo|perfecto|sin problema|todo bien|todo correcto|quedamos asi|hemos recibido tu (pedido|transferencia))\b/.test(
      t,
    );
  const delivery =
    !!when.date ||
    !!when.hint ||
    /entrega|entregado|enviado|llega|llegamos|llegara|enviamos|sale hoy|sale manana|reparto|en camino|en el camion|esta listo|pasa a recoger|pasate|recoger|con retraso|retras|llegar tarde|por la tarde|por la manana|primera hora|repartidor|camion|lo dejo|te lo dejo|dejamos en|en la puerta/.test(
      t,
    );
  let category: ReplyCategory = "other";
  if (remembered) category = remembered.category;
  else if (injected) category = "other";
  else if (closed) category = "closed";
  else if (shortage) category = "out_of_stock";
  else if (cancellation) category = "cancellation";
  else if (payment) category = "payment";
  else if (promotion && !question) category = "other";
  else if (question && /\?/.test(text)) category = "question";
  else if (change) category = "change";
  else if (question) category = "question";
  else if (document) category = "document";
  else if (confirmation && !delayed) category = "confirmation";
  else if (delivery) category = "delivery_date";
  const isPromotion = !remembered && promotion && category === "other";
  const needsReading = !isPromotion && (!quiet.has(category) || delayed);
  const missing = missingMatch?.[1]?.trim();
  const dateText = when.date
    ? `Fecha indicada: ${when.date}${when.hint ? " («" + when.hint + "»)" : ""}.`
    : when.hint
      ? `Plazo indicado sin fecha exacta: «${when.hint}».`
      : "";
  const base = {
    out_of_stock: `El proveedor indica falta de producto${missing ? " (" + missing + ")" : ""}. Puede impedir completar la compra: léelo.`,
    cancellation:
      "El proveedor menciona una cancelación o anulación. Léelo y decide.",
    closed:
      "El proveedor avisa de cierre, vacaciones o festivo: afecta a entregas y pedidos.",
    payment:
      "El proveedor habla de un pago o factura pendiente. Requiere tu revisión.",
    change: partial
      ? "El proveedor indica que solo puede entregar una parte. Léelo y decide."
      : "El proveedor propone un cambio de producto, cantidad, precio o un abono. No se acepta sin tu revisión.",
    question:
      "El proveedor hace una pregunta o pide algo. Requiere tu respuesta.",
    document:
      "El proveedor envía o menciona un documento (factura, albarán, catálogo). Revísalo y archívalo.",
    delivery_date: delayed
      ? "El proveedor comunica un retraso en la entrega."
      : "El proveedor informa cuándo llega el pedido.",
    confirmation: "El proveedor confirma. No equivale a mercadería recibida.",
    other: isPromotion
      ? "Promoción informativa; no requiere respuesta ni cambia pedidos."
      : "No se reconoce la intención del mensaje. Léelo.",
  }[category];
  const priced = readPriceChange(text);
  const priceText = priced
    ? ` Precio que dice el mensaje: ${(priced.to / 100).toFixed(2).replace(".", ",")} €${priced.from !== undefined ? ` (antes ${(priced.from / 100).toFixed(2).replace(".", ",")} €)` : ""}. No se apunta sin tu confirmación.`
    : "";
  const summary = remembered
    ? `Aprendido de una corrección tuya: ${labels[category]}. ${dateText}`.trim() +
      priceText
    : (base + " " + dateText).trim() + priceText;
  return {
    category,
    needsReading,
    ...(when.date ? { deliveryDate: when.date } : {}),
    ...(when.hint ? { deliveryHint: when.hint } : {}),
    ...(missing ? { missing: missing.slice(0, 120) } : {}),
    ...(priced
      ? {
          priceTo: priced.to,
          priceHint: priced.hint,
          ...(priced.from !== undefined ? { priceFrom: priced.from } : {}),
        }
      : {}),
    summary: summary.slice(0, 300),
    ...(remembered ? { learned: true } : {}),
  };
}
