import { randomUUID } from "node:crypto";
import {
  interpretReply,
  labels as replyLabels,
  normalizePhrase,
  localDate,
} from "./messages";
import {
  stateSchema,
  parseAction,
  type State,
  type Product,
  type Movement,
  type Message,
} from "./schema";
export { seed } from "./seed";
export { suggestDocument, guessDocType, documentTotalCents } from "./documents";
import { suggestDocument } from "./documents";
export {
  interpretReply,
  resolveDate,
  replyCategories,
  labels as replyLabels,
  normalizePhrase,
} from "./messages";
export { localDate, readPriceChange } from "./messages";
export { recipeBalance, balanceRanges, balanceLabels } from "./balance";
export { weeklyReport, weekStart, weekBounds } from "./report";
export {
  priceAlerts,
  countStatus,
  zoneLabels,
  supplierCatalog,
  supplierCatalogs,
  priceSourceLabels,
} from "./inventory";
export {
  orderReminders,
  defaultOrderTemplate,
  renderOrderTemplate,
  defaultNudgeTemplate,
  renderNudgeTemplate,
  nudgeMessage,
  daysSinceDispatch,
} from "./orders";
import { defaultOrderTemplate, renderOrderTemplate } from "./orders";
import { zoneLabels } from "./inventory";
import {
  wasteReasonText,
  wasteReasonLabels,
  stockWasteText,
  giftText,
  closeMovements,
  closeLineOf,
  closeDetailOf,
  sellableIds,
  undoneMovements,
} from "./sales";
export {
  salesHistory,
  wasteGoals,
  giftLabel,
  wasteReasons,
  wasteReasonLabels,
  stockWasteText,
  wasteLabelOf,
  closeMovements,
} from "./sales";
import { productionCost, recipeCost, saleValueOn } from "./value";
export {
  recipeCost,
  productionCost,
  saleValueOn,
  costPerKgOn,
  valueReport,
} from "./value";
import {
  computeDay,
  dayCloseId,
  isDayClosed,
  notOpenedOn,
  stockAtDayEnd,
  movementDay,
  productionDays,
} from "./day";
export { computeDay, daySummary, isDayClosed } from "./day";
import { businessDay } from "./plan";
import { addDays, fold, isOff } from "./util";
export {
  parseCompositionTable,
  compositionKeys,
  compositionLabels,
  compositionIndex,
} from "./comptable";
export { productionPlan, todayBrief, businessDay } from "./plan";
import {
  cartAdvice,
  priceKey,
  isHouse,
  linkedKeys,
  priceRowSource,
  supplierInitials,
} from "./pricelist";
export {
  cartAdvice,
  parsePriceList,
  priceReadingSummary,
  priceGroups,
  priceKey,
} from "./pricelist";
const eur = (cents: number): string =>
  (cents / 100).toFixed(2).replace(".", ",") + " €";
export const round = (n: number) => Math.round(n * 1000) / 1000;
export function ensure(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const now = () => new Date().toISOString();
// Supplier that owns what the shop makes itself. Min and target 0: purchases never suggest it.
export const ownSupplierId = "elaboracion-propia";
// A confirmed day is frozen: nothing that belongs to it changes until it is reopened with a reason.
function ensureDayOpen(s: State, date: string): void {
  ensure(
    !isDayClosed(s, date),
    `El día ${date} está cerrado. Reábrelo con «Reabrir el día», indicando el motivo, para cambiarlo.`,
  );
}
function item<T extends { id: string }>(list: T[], id: string): T {
  const result = list.find((x) => x.id === id);
  ensure(result, "Registro inexistente.");
  return result;
}
export function pending(s: State, id: string): number {
  return round(
    s.orders
      .filter((o) => !["received", "cancelled"].includes(o.status))
      .reduce(
        (sum, o) =>
          sum +
          o.lines
            .filter((l) => l.product === id)
            .reduce((n, l) => n + l.packs * l.pack - l.received, 0),
        0,
      ),
  );
}
export function needed(s: State, p: Product): number {
  return Math.max(
    0,
    // Redondeo antes de subir al paquete: 2,1 / 0,7 da 3,0000000000000004 en coma flotante.
    Math.ceil(round(round(p.target - p.stock - pending(s, p.id)) / p.pack)),
  );
}
// Exact text a real send carries. Deterministic so the person authorizes what is sent.
export function orderMessage(
  s: State,
  orderId: string,
  template = defaultOrderTemplate,
): string {
  const o = item(s.orders, orderId);
  const lines = o.lines.map((l) => {
    const p = item(s.products, l.product);
    return `- ${l.packs} × ${p.name} (${round(l.pack)} ${p.unit} por presentación, ${round(l.packs * l.pack)} ${p.unit})`;
  });
  return renderOrderTemplate(template, {
    numero: o.number,
    negocio: s.business,
    lineas: lines.join("\n"),
    proveedor: item(s.suppliers, o.supplier).name,
  });
}
export function classify(
  text: string,
  at = now(),
  learned: State["learned"] = [],
): Pick<Message, "kind" | "priority" | "reason" | "interpretation"> {
  const base = classifyLegacy(text.toLowerCase());
  const read = interpretReply(text, at, learned);
  const promo = base.kind === "promotion" && !read.learned;
  const interpretation = promo
    ? {
        category: "other" as const,
        needsReading: false,
        summary:
          "Promoción informativa; no requiere respuesta ni cambia pedidos.",
      }
    : read;
  const byCategory: Partial<
    Record<typeof interpretation.category, Pick<Message, "kind" | "priority">>
  > = {
    out_of_stock: { kind: "change", priority: "important" },
    cancellation: { kind: "change", priority: "important" },
    closed: { kind: "change", priority: "important" },
    payment: { kind: "unknown", priority: "important" },
    document: { kind: "unknown", priority: "normal" },
    change: { kind: "change", priority: "important" },
    question: { kind: "unknown", priority: "important" },
    delivery_date: { kind: "delivery", priority: "important" },
    confirmation: { kind: "confirmation", priority: "normal" },
  };
  const mapped = promo ? base : byCategory[interpretation.category] || base;
  return {
    kind: mapped.kind,
    priority: mapped.priority,
    reason: promo
      ? base.reason
      : replyLabels[interpretation.category] + ". " + interpretation.summary,
    interpretation,
  };
}
function classifyLegacy(
  t: string,
): Pick<Message, "kind" | "priority" | "reason"> {
  if (
    /cancel|agotad|no (queda|tenemos)|sin stock|sube|subida|sustit|solo (queda|tenemos)|sólo (queda|tenemos)/.test(
      t,
    )
  )
    return {
      kind: "change",
      priority: "important",
      reason:
        "Posible cambio de disponibilidad o condiciones. Revisa el mensaje.",
    };
  if (/mañana|entrega|viernes|jueves|retras/.test(t))
    return {
      kind: "delivery",
      priority: "important",
      reason: "Información de entrega que puede afectar a la planificación.",
    };
  if (/oferta|promoci|descuento/.test(t))
    return {
      kind: "promotion",
      priority: "low",
      reason: "Promoción informativa; no modifica pedidos.",
    };
  if (/confirmad|recibido/.test(t))
    return {
      kind: "confirmation",
      priority: "normal",
      reason: "Posible confirmación. No equivale a mercadería recibida.",
    };
  return {
    kind: "unknown",
    priority: "review",
    reason: "Mensaje sin clasificación clara. Revisa su relevancia.",
  };
}
export function assessRelevance(
  s: State,
  supplier: string,
  text: string,
): Pick<Message, "relevance" | "relevanceReason"> {
  const refs = [...new Set(text.toUpperCase().match(/\bGS-\d+\b/g) || [])];
  if (refs.length) {
    const matches = s.orders.filter(
      (o) => o.supplier === supplier && refs.includes(o.number),
    );
    if (refs.length === 1 && matches.length === 1)
      return {
        relevance: "relevant",
        relevanceReason: `Menciona ${matches[0]!.number}, un pedido de este proveedor. Comprueba el contenido antes de vincularlo.`,
      };
    return {
      relevance: "review",
      relevanceReason:
        "La referencia es desconocida, ambigua o pertenece a otro proveedor. No se vinculó ningún pedido.",
    };
  }
  if (classify(text).kind === "promotion")
    return {
      relevance: "informational",
      relevanceReason:
        "Parece una promoción sin referencia a un pedido. Se conserva para consulta.",
    };
  const active = s.orders.filter(
    (o) =>
      o.supplier === supplier && !["received", "cancelled"].includes(o.status),
  );
  return {
    relevance: "review",
    relevanceReason: active.length
      ? `Este proveedor tiene ${active.length} pedido(s) abierto(s), pero el mensaje no identifica cuál. Revisa la relación.`
      : "No hay una referencia comprobable a un pedido. Revisa si afecta a tu negocio.",
  };
}
export function validate(input: unknown): State {
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success)
    throw Error(
      "Datos incompatibles: " +
        parsed.error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .slice(0, 3)
          .join("; "),
    );
  const s = parsed.data;
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  for (const list of [
    s.products,
    s.suppliers,
    s.orders,
    s.messages,
    s.photos,
    s.movements,
  ])
    ensure(unique(list.map((x) => x.id)), "Identificadores repetidos.");
  ensure(
    unique(s.cart.map((l) => l.product)),
    "Líneas repetidas en el carrito.",
  );
  const suppliers = new Set(s.suppliers.map((x) => x.id)),
    products = new Map(s.products.map((x) => [x.id, x]));
  for (const p of s.products) {
    ensure(suppliers.has(p.supplier), "Proveedor inexistente.");
    ensure(p.target >= p.min, "El objetivo no puede ser inferior al mínimo.");
    if (p.unit === "ud")
      ensure(
        [p.stock, p.pack, p.min, p.target].every(Number.isInteger),
        "Las unidades deben ser enteras.",
      );
  }
  for (const l of s.cart)
    ensure(products.has(l.product), "Producto de carrito inexistente.");
  for (const o of s.orders) {
    ensure(
      suppliers.has(o.supplier) && unique(o.lines.map((l) => l.product)),
      "Pedido inválido.",
    );
    for (const l of o.lines) {
      const p = products.get(l.product);
      ensure(p && l.received <= round(l.packs * l.pack), "Recepción inválida.");
      if (p.unit === "ud")
        ensure(
          Number.isInteger(l.pack) && Number.isInteger(l.received),
          "Las unidades deben ser enteras.",
        );
    }
    const total = o.lines.every((l) => round(l.packs * l.pack) === l.received);
    const some = o.lines.some((l) => l.received > 0);
    ensure(
      o.status === "received"
        ? total
        : o.status === "partial"
          ? some && !total
          : !some,
      "Estado de recepción inconsistente.",
    );
  }
  for (const m of s.messages)
    ensure(
      suppliers.has(m.supplier) &&
        (!m.order ||
          s.orders.some((o) => o.id === m.order && o.supplier === m.supplier)),
      "Asociación de mensaje inválida.",
    );
  ensure(
    unique(s.recipes.map((r) => r.id)) &&
      unique(s.productions.map((p) => p.id)) &&
      unique(s.learned.map((l) => l.id)),
    "Identificadores repetidos.",
  );
  for (const r of s.recipes) {
    ensure(
      (!r.product || products.has(r.product)) &&
        unique(r.ingredients.map((i) => i.product)) &&
        r.ingredients.every((i) => products.has(i.product)),
      "Receta con productos inexistentes o repetidos.",
    );
    ensure(
      !r.product || !r.ingredients.some((i) => i.product === r.product),
      "El gelato que sale de una receta no puede ser ingrediente de esa misma receta.",
    );
  }
  for (const p of s.productions)
    ensure(
      s.recipes.some((r) => r.id === p.recipe) &&
        unique(p.lines.map((l) => l.product)) &&
        p.lines.every((l) => products.has(l.product)) &&
        (!p.output || products.has(p.output.product)),
      "Producción con datos inexistentes.",
    );
  for (const photo of s.photos) {
    ensure(
      !photo.supplier || suppliers.has(photo.supplier),
      "Proveedor de foto inexistente.",
    );
    if (photo.order) {
      const o = s.orders.find((x) => x.id === photo.order);
      ensure(
        !!o && (!photo.supplier || o.supplier === photo.supplier),
        "Documento vinculado a un pedido inexistente o de otro proveedor.",
      );
    }
  }
  const reversed = new Set<string>();
  for (const m of s.movements) {
    ensure(
      products.has(m.product) && round(m.after - m.before) === round(m.delta),
      "Movimiento inconsistente.",
    );
    if (m.order)
      ensure(
        s.orders.some(
          (o) =>
            o.id === m.order && o.lines.some((l) => l.product === m.product),
        ),
        "Pedido del movimiento inexistente.",
      );
    if (m.production)
      ensure(
        s.productions.some(
          // An annulled production keeps its original movements (compensated, never erased).
          (p) =>
            p.id === m.production && (p.status === "applied" || p.voidedAt),
        ),
        "Producción del movimiento inexistente.",
      );
    if (m.reverses) {
      const original = s.movements.find((x) => x.id === m.reverses);
      ensure(
        original &&
          !original.reverses &&
          original.kind !== "receipt" &&
          original.product === m.product &&
          round(original.delta + m.delta) === 0 &&
          !reversed.has(original.id),
        "Corrección de movimiento inválida.",
      );
      reversed.add(original.id);
    }
  }
  return s;
}
// Keep a proposal only while it still adds something the person has not decided.
function refreshSuggestion(s: State, photo: State["photos"][number]): void {
  const sug = suggestDocument(s, photo);
  photo.suggestion = sug.supplier || sug.order || sug.docType ? sug : undefined;
}
// What a linked supplier reply changes on its order: the delivery date it states and the
// confirmation flag. Never quantities, never stock; those wait for the person.
function applyReplyToOrder(
  o: State["orders"][number],
  i: Message["interpretation"] | undefined,
): void {
  if (!i) return;
  if (i.deliveryDate) o.expected = i.deliveryDate;
  if (i.category === "confirmation" || i.category === "delivery_date")
    o.confirmedAt = o.confirmedAt ?? now();
}
function move(
  s: State,
  product: string,
  delta: number,
  kind: Movement["kind"],
  reason: string,
  extra: Partial<Pick<Movement, "order" | "reverses" | "production">> = {},
): void {
  const p = item(s.products, product),
    after = round(p.stock + delta);
  ensure(
    (after >= 0 || (kind === "production" && delta < 0)) &&
      Math.abs(after) <= 1_000_000,
    "El movimiento dejaría un stock negativo o fuera de rango.",
  );
  if (p.unit === "ud")
    ensure(Number.isInteger(after), "Las unidades deben ser enteras.");
  s.movements.unshift({
    id: randomUUID(),
    product,
    kind,
    delta: round(delta),
    before: p.stock,
    after,
    reason,
    at: now(),
    ...extra,
  });
  p.stock = after;
}
/** Propuesta de producción de una receta: el consumo por receta escalado a esos kilos. */
function proposeProduction(
  s: State,
  r: State["recipes"][number],
  quantity: number,
  date: string,
): State["productions"][number] {
  const factor = quantity / r.yield;
  const lines = r.ingredients.map((i) => {
    const p = item(s.products, i.product);
    const raw = i.quantity * factor;
    return {
      product: i.product,
      quantity: p.unit === "ud" ? Math.ceil(raw - 1e-9) : round(raw),
    };
  });
  const p = {
    id: randomUUID(),
    recipe: r.id,
    name: r.name,
    quantity,
    date,
    at: now(),
    status: "proposed" as const,
    lines,
    ...(r.product ? { output: { product: r.product, quantity } } : {}),
    note: "",
  };
  s.productions.unshift(p);
  return s.productions[0]!;
}
/**
 * Aprueba una propuesta: descuenta lo consumido y suma lo hecho. Devuelve el texto del consumo y
 * los ingredientes que quedan en negativo (se avisan; se corrigen con un conteo).
 */
function approveProduction(
  s: State,
  p: State["productions"][number],
  r: State["recipes"][number],
  lines: { product: string; quantity: number }[],
  output: number | undefined,
  note: string,
): { consumed: string[]; negative: string[] } {
  ensure(p.status === "proposed", "Esta producción ya se resolvió.");
  ensureDayOpen(s, p.date);
  ensure(
    new Set(lines.map((l) => l.product)).size === lines.length &&
      lines.every((l) => r.ingredients.some((i) => i.product === l.product)),
    "Solo se pueden ajustar ingredientes de la receta.",
  );
  p.lines = lines.map((l) => ({ product: l.product, quantity: l.quantity }));
  if (p.output && output !== undefined) p.output.quantity = output;
  p.note = note;
  p.status = "applied";
  // Snapshot with today's purchase prices and the approved consumption; later price changes
  // never rewrite it.
  const cost = productionCost(s, r, p);
  if (cost) p.cost = cost;
  else delete p.cost;
  const consumed: string[] = [];
  const negative: string[] = [];
  for (const l of p.lines) {
    if (!l.quantity) continue;
    const prod = item(s.products, l.product);
    move(
      s,
      l.product,
      -l.quantity,
      "production",
      `Producción de ${p.quantity} kg de ${p.name} (${p.date}), aprobada`,
      { production: p.id },
    );
    consumed.push(`${prod.name} ${l.quantity} ${prod.unit}`);
    if (prod.stock < 0)
      negative.push(`${prod.name} ${prod.stock} ${prod.unit}`);
  }
  if (p.output && p.output.quantity)
    move(
      s,
      p.output.product,
      p.output.quantity,
      "output",
      `Gelato hecho: ${p.name} (${p.date})`,
      { production: p.id },
    );
  return { consumed, negative };
}
/** De dónde sale una composición tomada de la tabla: archivo, página y fila. */
/** Recuerda a qué producto corresponde un nombre de la lista o de la tabla (uno por nombre). */
const remember = (
  s: State,
  kind: "list" | "table",
  name: string,
  product: string,
) => {
  const key = priceKey(name);
  s.nameProducts = [
    ...s.nameProducts.filter((n) => !(n.kind === kind && n.key === key)),
    { kind, key, product, at: now() },
  ];
};
const tableSource = (e: { source: string; page: number; name: string }) =>
  `${e.source} · página ${e.page} · «${e.name}»`.slice(0, 300);
const negativeNote = (negative: string[]) =>
  negative.length
    ? ` Atención: la app no tenía suficiente y queda en negativo: ${negative.join(", ")}. Revísalo con un conteo en Inventario.`
    : "";
/** Alta del gelato (o sorbetto) de elaboración propia: un producto en kg que empieza en 0. */
function ownGelato(s: State, name: string, family: string): string {
  if (!s.suppliers.some((x) => x.id === ownSupplierId))
    s.suppliers.push({
      id: ownSupplierId,
      name: "Elaboración propia",
      initials: "EP",
      category: "Obrador",
      delivery: "Se produce en el obrador; no se pide a nadie.",
      color: "sage",
    });
  const id = randomUUID();
  s.products.push({
    id,
    name,
    detail:
      family === "sorbete"
        ? "Sorbetto de elaboración propia"
        : "Gelato de elaboración propia",
    zone: "vitrina",
    category: "Gelatería",
    unit: "kg",
    stock: 0,
    min: 0,
    target: 0,
    pack: 1,
    price: 0,
    supplier: ownSupplierId,
    alternates: [],
    icon: "ice",
  });
  return id;
}

export function apply(state: State, input: unknown): State {
  const a = parseAction(input);
  if (a.operationId && state.processed.includes(a.operationId)) return state;
  if (a.revision !== undefined)
    ensure(
      a.revision === state.revision,
      "Los datos cambiaron. Revisa la operación.",
    );
  const s = structuredClone(state);
  let note = "";
  switch (a.type) {
    case "count": {
      const p = item(s.products, a.product);
      move(s, p.id, round(a.value - p.stock), "count", a.reason);
      note = `Conteo de ${p.name}: ${p.stock} ${p.unit}. Motivo: ${a.reason}`;
      break;
    }
    case "countSheet": {
      // One count per line; an unchanged quantity still leaves a zero-delta count movement,
      // which is what tells the zone reminder that the product was checked.
      ensure(
        new Set(a.lines.map((l) => l.product)).size === a.lines.length,
        "Productos repetidos en la hoja.",
      );
      const label = zoneLabels[a.zone] ?? a.zone;
      let changed = 0;
      for (const l of a.lines) {
        const p = item(s.products, l.product);
        const delta = round(l.value - p.stock);
        if (delta !== 0) changed++;
        move(s, p.id, delta, "count", `Conteo de ${label}`);
      }
      note = `Conteo de ${label}: ${a.lines.length} productos revisados, ${changed} con diferencia.`;
      break;
    }
    case "movement": {
      const p = item(s.products, a.product);
      ensure(
        !a.wasteReason || a.kind === "waste",
        "El motivo de merma solo vale para una merma.",
      );
      ensure(
        !!a.reason || !!a.wasteReason,
        "Escribe el motivo del movimiento.",
      );
      // La merma de un gelato (el producto de una receta) se puede apuntar a cualquier hora,
      // pero es una merma del cierre de ese día de negocio: se guarda como línea de cierre
      // («Merma del día AAAA-MM-DD · Motivo · detalle») para que el resumen del día, el
      // historial, los informes, la Semana y el objetivo de merma la lean igual.
      const gelato = a.kind === "waste" && sellableIds(s).has(p.id);
      let day: string | undefined;
      if (gelato) {
        ensure(!!a.wasteReason, "Elige el motivo de la merma del gelato.");
        day = a.date ?? businessDay(new Date());
        ensureDayOpen(s, day);
      }
      // Una merma de ingrediente con motivo se guarda con el texto de core/sales.ts, con los
      // mismos motivos que el cierre del día, para poder leer las dos por el mismo motivo.
      const detail = a.reason.trim();
      const reason =
        gelato && a.wasteReason
          ? wasteReasonText(day!, a.wasteReason) +
            (detail ? ` · ${detail}` : "")
          : a.wasteReason
            ? stockWasteText(a.wasteReason, a.reason)
            : a.reason;
      move(s, p.id, a.kind === "entry" ? a.value : -a.value, a.kind, reason);
      // En la actividad ya pone «Merma»: el motivo va sin repetir esa palabra.
      const shown = a.wasteReason
        ? wasteReasonLabels[a.wasteReason] + (detail ? ` · ${detail}` : "")
        : a.reason;
      note = `${a.kind === "entry" ? "Entrada" : a.kind === "waste" ? "Merma" : "Salida"}: ${p.name}, ${a.value} ${p.unit}. ${shown}${gelato ? ` Cuenta como merma del cierre del día ${day}.` : ""}`;
      break;
    }
    case "reverse": {
      const m = item(s.movements, a.id);
      ensure(
        !m.reverses &&
          m.kind !== "receipt" &&
          !s.movements.some((x) => x.reverses === m.id),
        "Este movimiento no se puede revertir por esta vía.",
      );
      // Las líneas del cierre del día y el gelato hecho en una producción tienen su propio camino
      // («Deshacer» del cierre y «Anular producción»), que respeta el día cerrado y deja cuadrados
      // el valor, el coste y la Semana. Revertirlos aquí esquivaba las dos cosas. El consumo de un
      // ingrediente sí se puede compensar (corrige un error de cálculo sin tocar lo producido).
      ensure(
        !closeLineOf(m),
        "Es una línea del cierre del día: corrígela o deshazla desde el cierre de ese día, en Producción.",
      );
      ensure(
        m.kind !== "output",
        "Es el gelato hecho en una producción: anula la producción en Producción.",
      );
      move(s, m.product, -m.delta, "reversal", a.reason, { reverses: m.id });
      note =
        "Movimiento compensado; se conserva el registro original. " + a.reason;
      break;
    }
    case "product": {
      const { type, revision, operationId, ...fields } = a;
      s.products.push({ id: randomUUID(), ...fields, icon: "box" });
      note = `Producto creado: ${a.name}.`;
      break;
    }
    case "editProduct": {
      const p = item(s.products, a.product);
      if (a.price !== p.price)
        s.prices.push({
          id: randomUUID(),
          product: p.id,
          supplier: a.supplier,
          at: now(),
          from: p.price,
          to: a.price,
          source: "edit",
        });
      if (a.zone) p.zone = a.zone;
      Object.assign(p, {
        name: a.name,
        detail: a.detail,
        min: a.min,
        target: a.target,
        pack: a.pack,
        price: a.price,
        supplier: a.supplier,
      });
      // The usual supplier never stays duplicated in the list of other suppliers.
      p.alternates = p.alternates.filter((x) => x.supplier !== a.supplier);
      if (a.composition !== undefined) {
        const next = Object.values(a.composition).some((v) => v !== undefined)
          ? a.composition
          : undefined;
        // Cambiada a mano, la composición deja de ser «la de la tabla».
        if (JSON.stringify(next ?? {}) !== JSON.stringify(p.composition ?? {}))
          delete p.compositionSource;
        p.composition = next;
      }
      note = `Ficha actualizada: ${p.name}. La unidad de medida y el stock no se modificaron.`;
      break;
    }
    case "supplier": {
      const { type, revision, operationId, id, ...fields } = a;
      if (id) Object.assign(item(s.suppliers, id), fields);
      else s.suppliers.push({ id: randomUUID(), ...fields });
      note = `Proveedor guardado: ${a.name}.`;
      break;
    }
    case "cart": {
      const p = item(s.products, a.product);
      // Without an explicit supplier the line keeps the one already chosen; naming the usual
      // supplier is how the person goes back to it.
      const current = s.cart.find((l) => l.product === a.product)?.supplier;
      const asked = a.supplier === undefined ? current : a.supplier;
      const chosen = asked && asked !== p.supplier ? asked : undefined;
      if (chosen)
        ensure(
          p.alternates.some((x) => x.supplier === chosen),
          "Ese proveedor no está apuntado para este producto.",
        );
      s.cart = s.cart.filter((l) => l.product !== a.product);
      if (a.packs)
        s.cart.push({ product: a.product, packs: a.packs, supplier: chosen });
      note = chosen
        ? `Carrito actualizado: ${p.name} se compra a ${item(s.suppliers, chosen).name}.`
        : "Carrito actualizado.";
      break;
    }
    case "setAlternate": {
      const p = item(s.products, a.product);
      const sup = item(s.suppliers, a.supplier);
      ensure(
        a.supplier !== p.supplier,
        `${sup.name} ya es el proveedor habitual de ${p.name}.`,
      );
      const line = { supplier: a.supplier, pack: a.pack, price: a.price };
      const at = p.alternates.findIndex((x) => x.supplier === a.supplier);
      if (at >= 0) p.alternates[at] = line;
      else {
        ensure(
          p.alternates.length < 5,
          "Ya hay cinco proveedores apuntados para este producto.",
        );
        p.alternates.push(line);
      }
      note = `${sup.name} queda apuntado como otro proveedor de ${p.name}.`;
      break;
    }
    case "removeAlternate": {
      const p = item(s.products, a.product);
      const before = p.alternates.length;
      p.alternates = p.alternates.filter((x) => x.supplier !== a.supplier);
      ensure(p.alternates.length < before, "Ese proveedor no estaba apuntado.");
      // A cart line pointing at it goes back to the usual supplier; nothing is bought by surprise.
      for (const l of s.cart)
        if (l.product === p.id && l.supplier === a.supplier)
          l.supplier = undefined;
      note = `${item(s.suppliers, a.supplier).name} ya no figura como otro proveedor de ${p.name}.`;
      break;
    }
    case "setPrice": {
      const p = item(s.products, a.product);
      const sup = item(s.suppliers, p.supplier);
      const from =
        a.source === "message"
          ? (() => {
              const m = item(s.messages, a.ref);
              ensure(
                m.supplier === p.supplier,
                `Ese mensaje es de otro proveedor, no de ${sup.name}.`,
              );
              return `el mensaje de ${sup.name} del ${m.at.slice(0, 10)}`;
            })()
          : (() => {
              const d = item(s.photos, a.ref);
              ensure(
                !d.supplier || d.supplier === p.supplier,
                `Ese documento es de otro proveedor, no de ${sup.name}.`,
              );
              return `el documento «${d.name}»`;
            })();
      ensure(
        a.price !== p.price,
        `${p.name} ya está a ${eur(a.price)} en su ficha.`,
      );
      s.prices.push({
        id: randomUUID(),
        product: p.id,
        supplier: p.supplier,
        at: now(),
        from: p.price,
        to: a.price,
        source: a.source,
        ref: a.ref,
      });
      note = `Precio de ${p.name}: ${eur(p.price)} → ${eur(a.price)} el paquete, según ${from}. El stock no cambia.`;
      p.price = a.price;
      break;
    }
    case "cartCheapest": {
      const moved: string[] = [];
      let saving = 0;
      for (const advice of cartAdvice(s)) {
        if (a.product && advice.product !== a.product) continue;
        const c = advice.cheaper;
        if (!c) continue;
        const p = item(s.products, advice.product);
        const line = s.cart.find((l) => l.product === p.id);
        if (!line) continue;
        line.packs = c.packs;
        if (c.supplier === p.supplier) delete line.supplier;
        else line.supplier = c.supplier;
        saving += c.saving;
        moved.push(`${p.name} → ${item(s.suppliers, c.supplier).name}`);
      }
      ensure(
        moved.length,
        "Con los precios apuntados no hay ninguna línea que salga más barata con otro proveedor.",
      );
      note = `Carrito: ${moved.join(", ")}. La compra baja ${eur(saving)}. El proveedor habitual de cada producto no cambia.`;
      break;
    }
    case "suggest": {
      for (const p of s.products.filter((p) => p.stock < p.min)) {
        const packs = needed(s, p);
        if (packs && !s.cart.some((l) => l.product === p.id))
          s.cart.push({ product: p.id, packs });
      }
      // La propuesta va con el proveedor habitual; si con lo apuntado sale más barato con otro,
      // se dice y la persona decide en el carrito.
      const cheaper = cartAdvice(s).filter((x) => x.cheaper).length;
      note =
        "Reposición propuesta descontando pedidos pendientes." +
        (cheaper
          ? ` ${cheaper === 1 ? "Una línea sale" : cheaper + " líneas salen"} más barata${cheaper === 1 ? "" : "s"} con otro proveedor que ya tienes apuntado: míralo en el carrito.`
          : "");
      break;
    }
    case "authorize": {
      ensure(
        a.revision === s.revision,
        "El carrito cambió. Revísalo antes de autorizar.",
      );
      ensure(s.cart.length, "El carrito está vacío.");
      // Each line is bought from the supplier chosen in the cart; by default, the usual one.
      const buyFrom = (l: { product: string; supplier?: string }) =>
        l.supplier ?? item(s.products, l.product).supplier;
      const supplyOf = (l: { product: string; supplier?: string }) => {
        const p = item(s.products, l.product);
        const alt = l.supplier
          ? p.alternates.find((x) => x.supplier === l.supplier)
          : undefined;
        return { pack: alt?.pack ?? p.pack, price: alt?.price ?? p.price };
      };
      for (const supplier of new Set(s.cart.map(buyFrom))) {
        const number =
          Math.max(0, ...s.orders.map((o) => Number(o.number.slice(3)))) + 1;
        s.orders.unshift({
          id: randomUUID(),
          number: `GS-${String(number).padStart(3, "0")}`,
          supplier,
          status: "pending",
          at: now(),
          simulated: true,
          nudges: [],
          lines: s.cart
            .filter((l) => buyFrom(l) === supplier)
            .map((l) => ({
              product: l.product,
              packs: l.packs,
              ...supplyOf(l),
              received: 0,
            })),
        });
      }
      s.cart = [];
      note =
        "Pedidos creados, uno por proveedor. Todavía no se ha enviado nada: se envían desde Compras.";
      break;
    }
    case "send": {
      const o = item(s.orders, a.order);
      ensure(o.status === "pending", "Este pedido ya se procesó.");
      o.status = "sent";
      if (a.dispatch) {
        o.dispatch = a.dispatch;
        note = `Pedido ${o.number} ENVIADO por WhatsApp a ${a.dispatch.to}. El proveedor aún no ha confirmado; el stock no cambia hasta la recepción.`;
      } else
        note = `Envío SIMULADO de ${o.number}. Ningún mensaje real enviado.`;
      break;
    }
    case "setExpected": {
      const o = item(s.orders, a.order);
      ensure(
        !["received", "cancelled"].includes(o.status),
        "El pedido ya está cerrado.",
      );
      o.expected = a.date;
      note = `Entrega prevista de ${o.number}: ${a.date}.`;
      break;
    }
    case "confirmOrder": {
      const o = item(s.orders, a.order);
      ensure(
        ["sent", "partial"].includes(o.status),
        "Solo se confirma un pedido enviado.",
      );
      o.confirmedAt = now();
      note = `Pedido ${o.number} confirmado por el proveedor.`;
      break;
    }
    // A reminder the person wrote and sent: it leaves a trace and nothing else changes.
    case "nudge": {
      const o = item(s.orders, a.order);
      ensure(
        ["sent", "partial"].includes(o.status),
        "Solo se reclama un pedido enviado y todavía en curso.",
      );
      ensure(o.dispatch, "Ese pedido no se envió por WhatsApp.");
      ensure(
        !o.confirmedAt,
        `El proveedor ya confirmó ${o.number}: no hace falta reclamar.`,
      );
      const day = localDate(new Date(a.dispatch.at));
      ensure(
        !o.nudges.some((n) => localDate(new Date(n.at)) === day),
        `Ya reclamaste ${o.number} hoy. Espera a mañana.`,
      );
      o.nudges.push(a.dispatch);
      note = `Recordatorio de ${o.number} enviado por WhatsApp a ${a.dispatch.to}. El pedido no cambia: sigue a la espera de respuesta.`;
      break;
    }
    case "removeLine": {
      const o = item(s.orders, a.order);
      ensure(
        !["received", "cancelled"].includes(o.status),
        "El pedido ya está cerrado.",
      );
      const line = o.lines.find((l) => l.product === a.product);
      ensure(line, "Ese producto no está en el pedido.");
      ensure(line.received === 0, "Ya se recibió parte de ese producto.");
      ensure(
        o.lines.length > 1,
        "Es el único producto del pedido: cancela el pedido en su lugar.",
      );
      o.lines = o.lines.filter((l) => l.product !== a.product);
      note = `${item(s.products, a.product).name} retirado de ${o.number}: el proveedor no lo sirve. Nada cambia en el stock.`;
      break;
    }
    case "cancel": {
      const o = item(s.orders, a.order);
      ensure(
        o.status === "pending",
        "Solo se pueden cancelar pedidos que no se han enviado.",
      );
      o.status = "cancelled";
      note = `Pedido ${o.number} cancelado antes del envío. Stock sin cambios.`;
      break;
    }
    case "receive": {
      const o = item(s.orders, a.order);
      ensure(
        ["sent", "partial"].includes(o.status),
        "Primero envía el pedido (por WhatsApp o con «Simular envío»).",
      );
      ensure(
        new Set(a.lines.map((l) => l.product)).size === a.lines.length,
        "Líneas repetidas.",
      );
      let total = 0;
      for (const l of a.lines) {
        const ol = o.lines.find((x) => x.product === l.product);
        ensure(
          ol && l.value <= round(ol.packs * ol.pack - ol.received),
          "La recepción supera la cantidad pendiente.",
        );
        if (l.value) {
          move(s, l.product, l.value, "receipt", `Recepción de ${o.number}`, {
            order: o.id,
          });
          ol.received = round(ol.received + l.value);
        }
        total += l.value;
      }
      ensure(total > 0, "Indica al menos una cantidad recibida.");
      o.status = o.lines.every((l) => l.received === round(l.pack * l.packs))
        ? "received"
        : "partial";
      note = `Recepción ${o.status === "received" ? "completa" : "parcial"} de ${o.number}.`;
      break;
    }
    case "message": {
      item(s.suppliers, a.supplier);
      if (a.eventId) {
        const existing = s.messages.find((m) => m.id === a.eventId);
        if (existing) {
          ensure(
            existing.supplier === a.supplier && existing.text === a.text,
            "El identificador del evento ya existe con otro contenido.",
          );
          return s;
        }
      }
      const message: Message = {
        id: a.eventId || randomUUID(),
        supplier: a.supplier,
        text: a.text,
        ...classify(a.text, now(), s.learned),
        ...assessRelevance(s, a.supplier, a.text),
        at: now(),
        read: false,
        reviewed: false,
        simulated: a.channel !== "whatsapp",
        channel: a.channel,
        ...(a.sender ? { sender: a.sender } : {}),
      };
      // A reply from the number an order was sent to belongs to that order, when
      // exactly one such order is still open. Several candidates: no guessing.
      if (!message.order && a.sender) {
        const candidates = s.orders.filter(
          (o) =>
            o.supplier === a.supplier &&
            o.dispatch?.to === a.sender &&
            ["sent", "partial"].includes(o.status),
        );
        if (candidates.length === 1) {
          const o = candidates[0]!;
          message.order = o.id;
          message.relevance = "relevant";
          message.relevanceReason = `Respuesta al pedido ${o.number}, enviado por WhatsApp a este número. Verifica el contenido.`;
          applyReplyToOrder(o, message.interpretation);
        }
      }
      s.messages.unshift(message);
      note =
        a.channel === "whatsapp"
          ? `Mensaje de WhatsApp recibido de ${item(s.suppliers, a.supplier).name}${message.order ? " para el pedido " + item(s.orders, message.order).number : ""}.`
          : `Mensaje de demostración recibido de ${item(s.suppliers, a.supplier).name}.`;
      break;
    }
    case "read": {
      item(s.messages, a.id).read = true;
      break;
    }
    case "review": {
      const m = item(s.messages, a.id);
      m.read = true;
      m.reviewed = true;
      note = "Mensaje revisado sin aceptar condiciones comerciales.";
      break;
    }
    case "priority": {
      const m = item(s.messages, a.id);
      m.priority = a.priority;
      m.reason = "Prioridad corregida manualmente.";
      note = "Prioridad del mensaje actualizada.";
      break;
    }
    case "relevance": {
      const m = item(s.messages, a.id);
      const previous = m.relevance;
      m.relevance = a.relevance;
      m.relevanceReason = a.reason;
      note = `Relevancia del mensaje ${m.id}: ${previous} → ${a.relevance}. Motivo: ${a.reason}`;
      break;
    }
    case "correctReading": {
      const m = item(s.messages, a.id);
      const previous = m.interpretation?.category || "other";
      const quietCategory = ["confirmation", "delivery_date"].includes(
        a.category,
      );
      m.interpretation = {
        ...(m.interpretation || { summary: "" }),
        category: a.category,
        needsReading: !quietCategory,
        summary: `Corregido por la persona: ${replyLabels[a.category]}.`,
        corrected: true,
        learned: false,
      };
      if (quietCategory && m.priority === "review") m.priority = "normal";
      const pattern = normalizePhrase(m.text);
      if (a.remember && pattern.length >= 3) {
        s.learned = s.learned.filter((l) => l.pattern !== pattern);
        s.learned.unshift({
          id: randomUUID(),
          pattern,
          category: a.category,
          example: m.text.slice(0, 300),
          at: now(),
        });
        s.learned = s.learned.slice(0, 5000);
      }
      note = `Lectura corregida por la persona: ${replyLabels[previous]} → ${replyLabels[a.category]}${a.remember ? ". Se recordará para mensajes iguales o casi iguales." : "."}`;
      break;
    }
    case "decide": {
      const m = item(s.messages, a.id);
      m.decision = a.decision;
      m.decidedAt = now();
      m.read = true;
      m.reviewed = true;
      note = `Decisión sobre un mensaje de ${item(s.suppliers, m.supplier).name}: ${a.decision}`;
      break;
    }
    case "forgetLearned": {
      const l = item(s.learned, a.id);
      s.learned = s.learned.filter((x) => x.id !== l.id);
      note = `Frase olvidada: «${l.example.slice(0, 80)}».`;
      break;
    }
    case "aiNote": {
      const m = item(s.messages, a.id);
      m.aiReading = {
        category: a.category,
        status: a.status,
        model: a.model,
        at: now(),
      };
      note = `Lectura de IA anotada en un mensaje de ${item(s.suppliers, m.supplier).name}: ${replyLabels[a.category]} (${a.status === "agreement" ? "lecturas coincidentes" : a.status === "disagreement" ? "lecturas discrepantes" : "sin lectura válida"}). Solo es una propuesta.`;
      break;
    }
    case "recipe": {
      const {
        type,
        revision,
        operationId,
        id,
        createProduct,
        noProduct,
        ...fields
      } = a;
      let created = "";
      if (createProduct && !fields.product) {
        // The gelato made in house is a product of its own: sales, waste and value hang from it.
        const same = s.products.find(
          (p) =>
            p.unit === "kg" &&
            !fields.ingredients.some((i) => i.product === p.id) &&
            p.name.trim().toLowerCase() === fields.name.trim().toLowerCase(),
        );
        if (same) fields.product = same.id;
        else {
          fields.product = ownGelato(s, fields.name, fields.family);
          created = ` «${fields.name}» queda dado de alta como gelato en stock (en kg, empieza en 0) para sus ventas, mermas y valor.`;
        }
      }
      ensure(
        new Set(fields.ingredients.map((i) => i.product)).size ===
          fields.ingredients.length,
        "Ingredientes repetidos.",
      );
      for (const i of fields.ingredients) {
        const p = item(s.products, i.product);
        if (p.unit === "ud")
          ensure(
            Number.isInteger(i.quantity),
            `${p.name} se mide en unidades enteras.`,
          );
      }
      if (fields.product) {
        const p = item(s.products, fields.product);
        ensure(
          p.unit === "kg",
          "El gelato que sale de la receta debe medirse en kg.",
        );
      }
      if (id) {
        const r = item(s.recipes, id);
        Object.assign(r, fields);
        // Sin esto, «Ninguno» guardaba la receta y seguía unida al gelato de antes.
        if (noProduct) delete r.product;
        // Un paso de la preparación no puede nombrar un ingrediente que ya no está.
        if (r.process) {
          const kept = r.process
            .map((x) =>
              !x.product || r.ingredients.some((i) => i.product === x.product)
                ? x
                : { text: x.text },
            )
            .filter((x) => x.product || x.text);
          if (kept.length) r.process = kept;
          else delete r.process;
        }
      } else s.recipes.push({ id: randomUUID(), ...fields, saleValues: [] });
      note =
        `Receta guardada: ${fields.name} (rinde ${fields.yield} kg).` + created;
      break;
    }
    case "purge": {
      // Activity notes older than the date are dropped, keeping the newest entries.
      // Stock movements are never purged: they are the audit trail.
      const total = s.activity.length;
      const kept = s.activity.filter((x, i) => i < a.keep || x.at >= a.before);
      const removed = total - kept.length;
      s.activity = kept;
      note = `Limpieza: eliminadas ${removed} entradas de actividad anteriores al ${a.before.slice(0, 10)}. Los movimientos de stock se conservan.`;
      break;
    }
    case "business": {
      s.business = a.name;
      s.place = a.place;
      note = `Nombre del negocio actualizado: ${a.name}${a.place ? " · " + a.place : ""}.`;
      break;
    }
    case "setSaleValue": {
      const r = item(s.recipes, a.recipe);
      ensure(
        r.product,
        "Este gelato todavía no está dado de alta para vender: pulsa «Activar ventas y valor de este gelato» en su ficha del Recetario.",
      );
      const owner = s.recipes.find(
        (x) => x.product === r.product && x.saleValues.length,
      );
      ensure(
        !owner || owner.id === r.id,
        `El valor de venta de este gelato ya se lleva en la receta «${owner?.name}».`,
      );
      // La fecha la elige la persona: hacia atrás si lo escribió tarde, o hacia delante si ya
      // sabe desde qué día sube. Un valor con fecha futura no cambia ningún día hasta llegar
      // (saleValueOn coge la entrada con el `from` mayor que no pase del día mirado).
      const before = saleValueOn(s, r.product, a.from);
      r.saleValues = [
        ...r.saleValues.filter((v) => v.from !== a.from),
        { from: a.from, cents: a.cents, at: now() },
      ].sort((x, y) => x.from.localeCompare(y.from));
      // Un día ya cerrado conserva el resumen que se confirmó; el propio día avisa del cambio.
      const closedAfter = s.days.filter(
        (d) => d.status === "closed" && d.date >= a.from,
      ).length;
      note =
        `Valor de venta de ${r.name}: ${eur(a.cents)} por kilo desde el ${a.from}${before !== null && before !== a.cents ? ` (antes ${eur(before)})` : ""}. Los días anteriores conservan el valor que tenían.` +
        (closedAfter
          ? ` ${closedAfter} día${closedAfter === 1 ? "" : "s"} ya cerrado${closedAfter === 1 ? "" : "s"} desde esa fecha: su resumen confirmado no cambia y avisará de que algo cambió.`
          : "");
      break;
    }
    case "setGoal": {
      const p = item(s.products, a.product);
      ensure(
        s.recipes.some((r) => r.product === p.id),
        "El objetivo de producción es para los gelatos de tus recetas.",
      );
      const before = p.target;
      p.target = a.target;
      // The purchase minimum can never sit above the goal (validate enforces it).
      if (p.min > p.target) p.min = p.target;
      note = `Objetivo de ${p.name}: tener ${a.target} kg${before ? ` (antes ${before} kg)` : ""}. «Qué producir hoy» propone lo que falte hasta ahí.`;
      break;
    }
    case "setWasteGoal": {
      const p = item(s.products, a.product);
      // El objetivo lo escribe la persona; sin número, se quita. No cambia stock ni nada más.
      if (!a.value) {
        ensure(p.wasteGoal, "Este producto no tiene objetivo de merma.");
        delete p.wasteGoal;
        note = `Objetivo de merma de ${p.name} quitado.`;
        break;
      }
      ensure(
        a.mode !== "pct" || a.value <= 100,
        "El porcentaje de merma va entre 0 y 100.",
      );
      p.wasteGoal = { mode: a.mode, value: a.value, at: now() };
      note =
        `Objetivo de merma de ${p.name}: no más de ` +
        (a.mode === "pct"
          ? `${a.value} % de lo que salga`
          : `${a.value} ${p.unit}`) +
        " en 7 días. Solo avisa; no cambia stock ni pedidos.";
      break;
    }
    case "setManualCost": {
      const r = item(s.recipes, a.recipe);
      if (a.cents === undefined) {
        ensure(r.manualCost, "Esta receta no tiene coste escrito a mano.");
        delete r.manualCost;
        const c = recipeCost(s, r);
        note = `Coste a mano de ${r.name} quitado. Coste calculado: ${c.calculated === null ? "no disponible (faltan precios de compra)" : eur(c.calculated) + " por kilo"}.`;
      } else {
        r.manualCost = { cents: a.cents, at: now() };
        note = `Coste de ${r.name} escrito a mano: ${eur(a.cents)} por kilo. Las producciones ya aprobadas conservan el coste que tenían.`;
      }
      break;
    }
    case "deleteRecipe": {
      const r = item(s.recipes, a.id);
      ensure(
        !s.productions.some(
          (p) => p.recipe === r.id && p.status !== "discarded",
        ),
        "La receta tiene producciones registradas; se conserva por trazabilidad.",
      );
      s.recipes = s.recipes.filter((x) => x.id !== r.id);
      s.productions = s.productions.filter((p) => p.recipe !== r.id);
      note = `Receta eliminada: ${r.name}.`;
      break;
    }
    case "produce": {
      const r = item(s.recipes, a.recipe);
      proposeProduction(s, r, a.quantity, a.date);
      note = `Producción propuesta: ${a.quantity} kg de ${r.name} (${a.date}). Consumo estimado por receta; nada cambia hasta aprobarlo.`;
      break;
    }
    case "applyProduction": {
      const p = item(s.productions, a.id);
      const r = item(s.recipes, p.recipe);
      const { consumed, negative } = approveProduction(
        s,
        p,
        r,
        a.lines,
        a.output,
        a.note,
      );
      const short = s.products.filter(
        (x) =>
          p.lines.some((l) => l.product === x.id) &&
          x.stock >= 0 &&
          x.stock < x.min,
      );
      note =
        `Producción aprobada: ${p.quantity} kg de ${p.name} (${p.date}). Consumo: ${consumed.join(", ") || "sin consumo"}.` +
        (short.length
          ? ` Por debajo del mínimo tras producir: ${short.map((x) => x.name).join(", ")}. Revisa la reposición.`
          : "") +
        negativeNote(negative);
      break;
    }
    case "produceNow": {
      const r = item(s.recipes, a.recipe);
      const made: string[] = [];
      const negative: string[] = [];
      // Bases hechas ahora: se produce primero la base que pide la tanda y se gasta en el momento.
      const baseNow = new Set(
        a.bases.filter((b) => b.mode === "now").map((b) => b.product),
      );
      const p = proposeProduction(s, r, a.quantity, a.date);
      const lines = a.lines ?? p.lines;
      for (const id of baseNow) {
        const base = s.recipes.find((x) => x.product === id);
        ensure(
          base && base.family === "base",
          `${item(s.products, id).name} no es una base con receta.`,
        );
        const need = lines.find((l) => l.product === id)?.quantity ?? 0;
        ensure(
          r.ingredients.some((i) => i.product === id),
          `${base.name} no es un ingrediente de ${r.name}.`,
        );
        if (!need) continue;
        const bp = proposeProduction(s, base, need, a.date);
        const done = approveProduction(
          s,
          bp,
          base,
          bp.lines,
          undefined,
          `Hecha para ${r.name}`,
        );
        negative.push(...done.negative);
        made.push(`${base.name} ${need} kg`);
      }
      // proposeProduction añadió la base delante: la del sabor sigue siendo p.
      const done = approveProduction(s, p, r, lines, undefined, a.note);
      negative.push(...done.negative);
      note =
        `Hecho: ${a.quantity} kg de ${r.name} (${a.date}). Consumo: ${done.consumed.join(", ") || "sin consumo"}.` +
        (made.length ? ` Base hecha ahora: ${made.join(", ")}.` : "") +
        negativeNote([...new Set(negative)]);
      break;
    }
    case "setProcess": {
      const r = item(s.recipes, a.recipe);
      const used = a.steps.flatMap((x) => (x.product ? [x.product] : []));
      ensure(
        new Set(used).size === used.length,
        "Un ingrediente solo puede ir en un paso.",
      );
      ensure(
        used.every((id) => r.ingredients.some((i) => i.product === id)),
        "Un paso nombra un ingrediente que no está en la receta.",
      );
      if (a.steps.length) r.process = a.steps;
      else delete r.process;
      note = a.steps.length
        ? `Orden de preparación de ${r.name}: ${a.steps.length} ${a.steps.length === 1 ? "paso" : "pasos"}.`
        : `${r.name} ya no tiene orden de preparación propio.`;
      break;
    }
    case "importIngredientTable": {
      let added = 0,
        updated = 0;
      for (const row of a.rows) {
        const old = s.ingredientTable.find(
          (x) => fold(x.name) === fold(row.name),
        );
        const entry = {
          name: row.name,
          composition: row.composition,
          source: a.source,
          page: row.page,
          issues: row.issues,
          at: now(),
        };
        if (old) {
          Object.assign(old, entry);
          updated++;
        } else {
          s.ingredientTable.push({ id: randomUUID(), ...entry });
          added++;
        }
      }
      note = `Tabla de ingredientes «${a.source}»: ${added} ${added === 1 ? "fila nueva" : "filas nuevas"}${updated ? ` y ${updated} actualizadas` : ""}. No cambia el inventario ni el stock.`;
      break;
    }
    case "addTableProducts": {
      item(s.suppliers, a.supplier);
      const made: string[] = [];
      const had: string[] = [];
      for (const id of [...new Set(a.entries)]) {
        const e = item(s.ingredientTable, id);
        if (s.products.some((p) => fold(p.name) === fold(e.name))) {
          had.push(e.name);
          continue;
        }
        const pid = randomUUID();
        remember(s, "table", e.name, pid);
        s.products.push({
          id: pid,
          name: e.name,
          composition: e.composition,
          compositionSource: tableSource(e),
          zone: a.zone,
          detail: "",
          category: a.category,
          unit: a.unit,
          stock: 0,
          min: 0,
          target: 0,
          pack: 1,
          price: 0,
          supplier: a.supplier,
          alternates: [],
          icon: "box",
        });
        made.push(e.name);
      }
      ensure(
        made.length,
        "Esos ingredientes ya están en el inventario con el mismo nombre.",
      );
      note =
        `Añadidos al inventario desde la tabla de ingredientes: ${made.length} (${made.slice(0, 5).join(", ")}${made.length > 5 ? "…" : ""}), con stock 0 y sin precio.` +
        (had.length
          ? ` Ya estaban y no se tocan: ${had.slice(0, 5).join(", ")}${had.length > 5 ? "…" : ""}.`
          : "");
      break;
    }
    case "applyTableComposition": {
      const e = item(s.ingredientTable, a.entry);
      const p = item(s.products, a.product);
      ensure(
        p.unit !== "ud",
        "La composición es por 100 g: no vale para un producto que se cuenta por unidades.",
      );
      p.composition = e.composition;
      p.compositionSource = tableSource(e);
      remember(s, "table", e.name, p.id);
      note = `Composición de ${p.name} tomada de la tabla de ingredientes (fila «${e.name}»). El stock no cambia.`;
      break;
    }
    case "clearIngredientTable": {
      const n = s.ingredientTable.length;
      s.ingredientTable = [];
      s.nameProducts = s.nameProducts.filter((x) => x.kind !== "table");
      note = `Tabla de ingredientes vaciada (${n} filas). Los productos conservan su composición; se olvida a qué producto correspondía cada fila.`;
      break;
    }
    case "importPriceList": {
      // Same name and same supplier = the same row: it keeps its id. Rows of this file that the
      // new reading no longer brings go away; rows of other files stay.
      const rowKey = (r: { name: string; supplier?: string | null }) =>
        priceKey(r.name) + "|" + priceKey(r.supplier ?? "");
      const old = new Map(s.priceList.map((r) => [rowKey(r), r]));
      const fresh = new Map<string, State["priceList"][number]>();
      let added = 0,
        updated = 0;
      for (const row of a.rows) {
        const key = rowKey(row);
        if (fresh.has(key)) continue;
        const before = old.get(key);
        if (before) updated++;
        else added++;
        fresh.set(key, {
          id: before?.id ?? randomUUID(),
          name: row.name,
          ...(row.supplier ? { supplier: row.supplier } : {}),
          ...(row.cents !== null ? { cents: row.cents } : {}),
          source: a.source,
          page: row.page,
          line: row.line,
          issues: row.issues,
          at: now(),
        });
      }
      const kept = a.replace
        ? []
        : s.priceList.filter(
            (r) => r.source !== a.source && !fresh.has(rowKey(r)),
          );
      const gone = s.priceList.length - kept.length - updated;
      s.priceList = [...kept, ...fresh.values()];
      ensure(
        s.priceList.length <= 5000,
        "La lista de precios no admite más de 5.000 filas.",
      );
      note =
        `Lista de precios «${a.source}»: ${added} ${added === 1 ? "fila nueva" : "filas nuevas"}` +
        (updated ? `, ${updated} actualizadas` : "") +
        (gone > 0 ? `, ${gone} que ya no vienen` : "") +
        ". No cambia productos, precios ni stock.";
      break;
    }
    case "clearPriceList": {
      const n = s.priceList.length;
      ensure(n, "No hay ninguna lista de precios guardada.");
      s.priceList = [];
      s.priceLinks = [];
      s.priceStars = [];
      s.priceNotSame = [];
      s.nameProducts = s.nameProducts.filter((x) => x.kind !== "list");
      note = `Lista de precios vaciada (${n} filas). Los precios apuntados en los productos no cambian; se olvida lo juntado, las estrellas y a qué producto correspondía cada nombre.`;
      break;
    }
    case "linkPriceRows": {
      const rows = [...new Set(a.rows)].map((id) => item(s.priceList, id));
      ensure(
        !rows.some((r) => isHouse(r.supplier)),
        "Lo hecho en casa no se compara con lo que se compra.",
      );
      const keys = new Set(
        rows.flatMap((r) => linkedKeys(s, priceKey(r.name))),
      );
      ensure(
        new Set(rows.map((r) => linkedKeys(s, priceKey(r.name))[0])).size > 1,
        "Esas filas ya cuentan como el mismo ingrediente.",
      );
      ensure(keys.size <= 50, "Demasiados nombres juntos en un ingrediente.");
      s.priceLinks = [
        ...s.priceLinks.filter((set) => !set.some((k) => keys.has(k))),
        [...keys],
      ];
      // Si antes dijo que eran distintos, juntarlos a mano manda.
      s.priceNotSame = s.priceNotSame.filter(
        ([x, y]) => !(keys.has(x!) && keys.has(y!)),
      );
      note = `Juntados como el mismo ingrediente: ${[...new Set(rows.map((r) => r.name))].join(", ")}. Lo has decidido tú: la lista no dice que sean iguales.`;
      break;
    }
    case "unlinkPriceRow": {
      const row = item(s.priceList, a.row);
      const key = priceKey(row.name);
      ensure(
        s.priceLinks.some((set) => set.includes(key)),
        "Esa fila no estaba juntada con ninguna otra.",
      );
      s.priceLinks = s.priceLinks
        .map((set) => set.filter((k) => k !== key))
        .filter((set) => set.length > 1);
      note = `${row.name} vuelve a compararse por separado.`;
      break;
    }
    case "rejectPriceMatch": {
      const [x, y] = a.rows.map((id) => item(s.priceList, id));
      const kx = priceKey(x!.name),
        ky = priceKey(y!.name);
      ensure(
        linkedKeys(s, kx)[0] !== linkedKeys(s, ky)[0],
        "Esas filas ya cuentan como el mismo ingrediente: sepáralas antes.",
      );
      const pair = [kx, ky].sort() as [string, string];
      ensure(
        !s.priceNotSame.some((p) => p[0] === pair[0] && p[1] === pair[1]),
        "Ya habías dicho que son distintos.",
      );
      s.priceNotSame = [...s.priceNotSame, pair];
      note = `${x!.name} y ${y!.name} son ingredientes distintos: no se volverán a proponer como iguales.`;
      break;
    }
    case "linkNameProduct": {
      const p = item(s.products, a.product);
      const name =
        a.kind === "list"
          ? item(s.priceList, a.row).name
          : item(s.ingredientTable, a.row).name;
      remember(s, a.kind, name, p.id);
      note = `«${name}» de ${a.kind === "list" ? "la lista de precios" : "la tabla de ingredientes"} es ${p.name} en tu inventario. Lo has decidido tú; no cambia precios ni stock.`;
      break;
    }
    case "unlinkNameProduct": {
      const name =
        a.kind === "list"
          ? item(s.priceList, a.row).name
          : item(s.ingredientTable, a.row).name;
      const key = priceKey(name);
      ensure(
        s.nameProducts.some((n) => n.kind === a.kind && n.key === key),
        "Ese nombre no tenía producto asignado.",
      );
      s.nameProducts = s.nameProducts.filter(
        (n) => !(n.kind === a.kind && n.key === key),
      );
      note = `«${name}» ya no corresponde a ningún producto del inventario.`;
      break;
    }
    case "addListSuppliers": {
      // Suppliers named in the price list, created with the name the list writes. The list says
      // nothing else about them: category, delivery, phone and the rest stay to be filled in.
      const made: string[] = [];
      const had: string[] = [];
      for (const name of [...new Set(a.names.map(priceKey))]) {
        const row = s.priceList.find(
          (r) => r.supplier && priceKey(r.supplier) === name,
        );
        ensure(row?.supplier, `La lista no nombra al proveedor «${name}».`);
        ensure(
          !isHouse(row.supplier),
          "Lo hecho en casa no es un proveedor al que comprar.",
        );
        if (s.suppliers.some((x) => priceKey(x.name) === name)) {
          had.push(row.supplier);
          continue;
        }
        s.suppliers.push({
          id: randomUUID(),
          name: row.supplier,
          initials: supplierInitials(row.supplier),
          category: "Sin clasificar",
          delivery: "Sin datos de entrega",
          color: "sand",
        });
        made.push(row.supplier);
      }
      ensure(made.length, "Esos proveedores ya están en la app.");
      note =
        `Proveedores creados desde la lista de precios: ${made.length} (${made.slice(0, 6).join(", ")}${made.length > 6 ? "…" : ""}). La lista solo da el nombre: el teléfono, la categoría y la entrega los completas tú en Proveedores. No cambia productos, precios ni stock.` +
        (had.length ? ` Ya estaban: ${had.join(", ")}.` : "");
      break;
    }
    case "starPriceRow": {
      const row = item(s.priceList, a.row);
      const keys = linkedKeys(s, priceKey(row.name));
      s.priceStars = s.priceStars.filter((k) => !keys.includes(k));
      if (a.star) s.priceStars.push(...keys);
      note = a.star
        ? `${row.name} marcado como ingrediente estrella.`
        : `${row.name} ya no está marcado como ingrediente estrella.`;
      break;
    }
    case "usePriceRow": {
      const row = item(s.priceList, a.row);
      const p = item(s.products, a.product);
      ensure(
        !isHouse(row.supplier),
        "Eso es una elaboración de la casa: no es un precio de compra.",
      );
      ensure(
        row.supplier,
        "La lista no dice a qué proveedor se compra: no se puede apuntar.",
      );
      ensure(
        row.cents !== undefined && row.cents > 0,
        "La lista no trae un precio que apuntar en esa fila.",
      );
      ensure(
        !s.recipes.some((r) => r.product === p.id),
        `${p.name} se hace en casa: no tiene precio de compra.`,
      );
      const wanted = priceKey(row.supplier);
      let sup = s.suppliers.find((x) => priceKey(x.name) === wanted);
      let created = false;
      if (!sup) {
        ensure(
          a.addSupplier,
          `${row.supplier} no está entre tus proveedores. Confirma que quieres crearlo.`,
        );
        sup = {
          id: randomUUID(),
          name: row.supplier,
          initials: supplierInitials(row.supplier),
          category: "Sin clasificar",
          delivery: "Sin datos de entrega",
          color: "sand",
        };
        s.suppliers.push(sup);
        created = true;
      }
      const usual = sup.id === p.supplier;
      const alt = p.alternates.find((x) => x.supplier === sup.id);
      const pack = usual ? p.pack : (alt?.pack ?? p.pack);
      // Derived, with its formula: price of the list (per kg, L or unit) × what a pack brings.
      const price = Math.round(row.cents * pack);
      ensure(
        price > 0 && price <= 100_000_000,
        "El precio por paquete que sale no es válido.",
      );
      const from = usual ? p.price : (alt?.price ?? 0);
      ensure(
        price !== from,
        `${p.name} ya está a ${eur(price)} el paquete con ${sup.name}.`,
      );
      if (!usual && !alt)
        ensure(
          p.alternates.length < 5,
          "Como mucho cinco proveedores más por producto. Quita uno antes.",
        );
      s.prices.push({
        id: randomUUID(),
        product: p.id,
        supplier: sup.id,
        at: now(),
        from,
        to: price,
        source: "list",
        ref: row.id,
        refLabel: priceRowSource(row),
      });
      if (usual) p.price = price;
      else if (alt) alt.price = price;
      else p.alternates.push({ supplier: sup.id, pack, price });
      remember(s, "list", row.name, p.id);
      note =
        `Precio de ${p.name} con ${sup.name}: ${eur(row.cents)} por ${p.unit} × ${String(pack).replace(".", ",")} ${p.unit} por paquete = ${eur(price)} el paquete, según la lista de precios (${priceRowSource(row)}).` +
        (usual
          ? ""
          : ` ${sup.name} queda apuntado como otro proveedor de ${p.name}; su proveedor habitual no cambia.`) +
        (created ? ` Proveedor nuevo creado: ${sup.name}.` : "") +
        " El stock no cambia.";
      break;
    }
    case "setBatches": {
      const r = item(s.recipes, a.recipe);
      const list = [...new Set(a.batches.map(round))].sort((x, y) => x - y);
      r.batches = list;
      note = `Tandas de ${r.name}: ${list.join(", ")} kg.`;
      break;
    }
    case "dailySales": {
      ensureDayOpen(s, a.date);
      ensure(
        !notOpenedOn(s, a.date),
        `El día ${a.date} está marcado como «La tienda no abrió». Quita la marca en el Calendario para apuntar su cierre.`,
      );
      ensure(
        new Set(a.lines.map((l) => l.product)).size === a.lines.length,
        "Productos repetidos.",
      );
      const done: string[] = [];
      for (const l of a.lines) {
        const p = item(s.products, l.product);
        ensure(
          l.sold === undefined || l.remaining === undefined,
          `${p.name}: indica lo vendido o lo que queda, no las dos cosas.`,
        );
        // Closing by weighing the tub: what is missing and was not thrown away was sold.
        // Se resta de lo que había al acabar ese día, no del stock de ahora (que puede llevar
        // producciones o movimientos de días posteriores si se cierra un día pasado).
        const had = stockAtDayEnd(s, p.id, a.date);
        const sold =
          l.remaining === undefined
            ? (l.sold ?? 0)
            : Math.round((had - l.waste - l.gift - l.remaining) * 1000) / 1000;
        ensure(
          sold >= 0,
          `${p.name}: queda más de lo que había (${had} ${p.unit}). Si se produjo más, aprueba antes esa producción.`,
        );
        ensure(
          round(sold + l.waste + l.gift) <= had,
          `${p.name}: vendido, merma e invitación suman más que el stock de ese día (${had} ${p.unit}).`,
        );
        if (sold) move(s, p.id, -sold, "exit", `Venta del día ${a.date}`);
        if (l.waste)
          move(
            s,
            p.id,
            -l.waste,
            "waste",
            wasteReasonText(a.date, l.wasteReason),
          );
        if (l.gift) move(s, p.id, -l.gift, "exit", giftText(a.date));
        if (sold || l.waste || l.gift)
          done.push(
            `${p.name}: ${sold ? "vendido " + sold + " " + p.unit : ""}${sold && l.waste ? ", " : ""}${l.waste ? "merma " + l.waste + " " + p.unit + (l.wasteReason ? " (" + wasteReasonLabels[l.wasteReason].toLowerCase() + ")" : "") : ""}${l.gift ? (sold || l.waste ? ", " : "") + "invitación o consumo " + l.gift + " " + p.unit : ""}`,
          );
      }
      ensure(
        done.length > 0,
        "Indica al menos una cantidad vendida, de merma o de invitación.",
      );
      const short = s.products.filter(
        (x) => a.lines.some((l) => l.product === x.id) && x.stock < x.min,
      );
      note =
        `Ventas y mermas del ${a.date}: ${done.join("; ")}.` +
        (short.length
          ? ` Por debajo del mínimo: ${short.map((x) => x.name).join(", ")}.`
          : "");
      break;
    }
    case "undoDailySales": {
      // The whole close of a day is compensated at once; the original movements stay on record.
      const moves = closeMovements(s, a.date);
      ensureDayOpen(s, a.date);
      ensure(
        moves.length > 0,
        "Ese día no tiene ventas ni mermas por deshacer.",
      );
      for (const m of moves)
        move(
          s,
          m.product,
          -m.delta,
          "reversal",
          `Cierre del ${a.date} deshecho`,
          {
            reverses: m.id,
          },
        );
      note = `Cierre del ${a.date} deshecho: ${moves.length} movimientos compensados; el stock vuelve a su sitio.`;
      break;
    }
    case "confirmDay": {
      ensureDayOpen(s, a.date);
      const snapshot = computeDay(s, a.date, a.changeHour);
      ensure(
        snapshot.rows.some(
          (r) => r.produced || r.sold || r.waste || r.gift || r.adjust,
        ),
        "Ese día no tiene producción, ventas, mermas ni ajustes que cerrar.",
      );
      const entry = { at: now(), kind: "confirmed" as const, reason: "" };
      const previous = s.days.find((d) => d.date === a.date);
      const record = {
        id: dayCloseId(a.date),
        date: a.date,
        status: "closed" as const,
        confirmedAt: entry.at,
        ...(a.realSaleCents !== undefined
          ? { realSaleCents: a.realSaleCents }
          : {}),
        snapshot,
        log: [...(previous?.log ?? []), entry],
      };
      s.days = [record, ...s.days.filter((d) => d.date !== a.date)].sort(
        (x, y) => y.date.localeCompare(x.date),
      );
      const t = snapshot.totals;
      const estimated =
        t.soldCents === null
          ? "venta estimada no disponible (falta el valor de venta de algún gelato)"
          : `venta estimada ${eur(t.soldCents)}`;
      const real =
        a.realSaleCents === undefined
          ? ""
          : `, venta real ${eur(a.realSaleCents)}` +
            (t.soldCents === null
              ? ""
              : ` (diferencia ${a.realSaleCents - t.soldCents < 0 ? "−" : "+"}${eur(Math.abs(a.realSaleCents - t.soldCents))})`);
      note = `Día ${a.date} cerrado${previous ? " de nuevo" : ""}: vendido ${t.sold} kg, merma ${t.waste} kg, invitación o consumo ${t.gift} kg, quedan ${t.remaining} kg para mañana; ${estimated}${real}. Para cambiar algo de ese día hay que reabrirlo.`;
      break;
    }
    case "markNotOpened": {
      ensure(
        !notOpenedOn(s, a.date),
        "Ese día ya está marcado como «La tienda no abrió».",
      );
      ensure(
        !isDayClosed(s, a.date),
        "Ese día tiene un cierre confirmado: no se puede marcar como «La tienda no abrió».",
      );
      ensure(
        !closeMovements(s, a.date).some((m) => closeLineOf(m)?.kind === "sale"),
        "Ese día tiene ventas apuntadas. Deshaz su cierre antes de marcar que la tienda no abrió.",
      );
      s.closures = [
        { date: a.date, reason: a.reason, at: now() },
        ...s.closures,
      ].sort((x, y) => y.date.localeCompare(x.date));
      note = `Día ${a.date} marcado: la tienda no abrió${a.reason ? ". Motivo: " + a.reason : ""}. No cambia el stock.`;
      break;
    }
    case "unmarkNotOpened": {
      ensure(notOpenedOn(s, a.date), "Ese día no estaba marcado.");
      s.closures = s.closures.filter((c) => c.date !== a.date);
      note = `Día ${a.date}: quitada la marca «La tienda no abrió».`;
      break;
    }
    case "setWeekSchedule": {
      ensure(
        new Date(a.week + "T12:00:00Z").getUTCDay() === 1,
        "La semana empieza en lunes.",
      );
      const dates = a.days.map((_, i) => addDays(a.week, i));
      const written: State["schedule"] = [];
      for (const [i, d] of a.days.entries()) {
        ensure(d.date === dates[i], "Los días no son los de esa semana.");
        const label = `El ${d.date}`;
        if (d.closed) {
          ensure(
            !d.open && !d.close && !d.shifts.length,
            `${label} está marcado como cerrado: quita la hora de apertura y los turnos.`,
          );
        } else {
          ensure(
            !d.open === !d.close,
            `${label}: escribe la hora de abrir y la de cerrar, o ninguna.`,
          );
          ensure(
            !d.open || d.open !== d.close,
            `${label}: abre y cierra a la misma hora.`,
          );
        }
        for (const t of d.shifts)
          ensure(
            !t.from || t.from !== t.to,
            `${label}: el turno de ${t.person} empieza y acaba a la misma hora.`,
          );
        // Un día sin nada escrito no se guarda: queda «sin horario apuntado».
        if (d.closed || d.open || d.shifts.length)
          written.push({ ...d, at: now() });
      }
      s.schedule = [
        ...s.schedule.filter((x) => !dates.includes(x.date)),
        ...written,
      ].sort((x, y) => y.date.localeCompare(x.date));
      note = `Horario de la semana del ${a.week} guardado: ${written.length} ${written.length === 1 ? "día apuntado" : "días apuntados"}. No cambia el stock ni las ventas.`;
      break;
    }
    case "setScheduleDays": {
      ensure(
        new Set(a.days.map((d) => d.date)).size === a.days.length,
        "Un día aparece dos veces.",
      );
      for (const d of a.days) {
        for (const t of d.shifts)
          ensure(
            !t.from || t.from !== t.to,
            `El ${d.date}: el turno de ${t.person} empieza y acaba a la misma hora.`,
          );
        const old = s.schedule.find((x) => x.date === d.date);
        ensure(
          !old?.closed || !d.shifts.some((t) => !isOff(t)),
          `El ${d.date} está marcado como cerrado en el horario: quita «Cerrado» antes de poner turnos.`,
        );
        const next = {
          date: d.date,
          closed: old?.closed ?? false,
          ...(old?.open ? { open: old.open, close: old.close } : {}),
          shifts: d.shifts,
          at: now(),
        };
        s.schedule = [
          ...s.schedule.filter((x) => x.date !== d.date),
          ...(next.closed || next.open || next.shifts.length ? [next] : []),
        ];
      }
      s.schedule.sort((x, y) => y.date.localeCompare(x.date));
      const people = new Set(
        a.days.flatMap((d) => d.shifts.map((t) => t.person)),
      );
      note = `Cuadrante guardado: ${a.days.length} ${a.days.length === 1 ? "día" : "días"} (del ${a.days[0]!.date} al ${a.days.at(-1)!.date}), ${people.size} ${people.size === 1 ? "persona" : "personas"}. No cambia el stock ni las ventas.`;
      break;
    }
    case "addVacation": {
      ensure(a.from <= a.to, "La fecha «hasta» va después de «desde».");
      ensure(
        addDays(a.from, 366) > a.to,
        "Unas vacaciones de más de un año: revisa las fechas.",
      );
      const same = (p: string) =>
        p.toLocaleLowerCase("es") === a.person.toLocaleLowerCase("es");
      ensure(
        !s.vacations.some(
          (v) => same(v.person) && v.from <= a.to && a.from <= v.to,
        ),
        `${a.person} ya tiene vacaciones en esas fechas.`,
      );
      s.vacations = [
        {
          id: randomUUID(),
          person: a.person,
          from: a.from,
          to: a.to,
          note: a.note,
          at: now(),
        },
        ...s.vacations,
      ].sort((x, y) => y.from.localeCompare(x.from));
      note = `Vacaciones de ${a.person} del ${a.from} al ${a.to} apuntadas. Si tiene turnos esos días, el Calendario lo avisa.`;
      break;
    }
    case "removeVacation": {
      const v = s.vacations.find((x) => x.id === a.id);
      ensure(v, "Esas vacaciones ya no están.");
      s.vacations = s.vacations.filter((x) => x.id !== a.id);
      note = `Quitadas las vacaciones de ${v.person} del ${v.from} al ${v.to}.`;
      break;
    }
    case "setWeighings": {
      ensure(
        a.date <= businessDay(new Date()),
        "Ese día todavía no ha llegado: no se puede pesar.",
      );
      const gelatos = sellableIds(s);
      ensure(
        new Set(a.lines.map((l) => l.product)).size === a.lines.length,
        "Un sabor aparece dos veces.",
      );
      let saved = 0,
        removed = 0;
      for (const l of a.lines) {
        const p = item(s.products, l.product);
        ensure(gelatos.has(p.id), `${p.name} no es un gelato de una receta.`);
        const old = s.weighings.findIndex(
          (w) => w.date === a.date && w.product === p.id,
        );
        if (l.value === null) {
          if (old >= 0) {
            s.weighings.splice(old, 1);
            removed++;
          }
          continue;
        }
        // Gramos enteros (la báscula no da décimas de gramo); los kilos, con tres decimales.
        if (a.unit === "g")
          ensure(
            Number.isInteger(l.value),
            `${p.name}: los gramos van sin decimales.`,
          );
        else
          ensure(
            Math.abs(l.value * 1000 - Math.round(l.value * 1000)) < 1e-6,
            `${p.name}: como mucho tres decimales en kilos (un gramo).`,
          );
        const kg = a.unit === "g" ? Math.round(l.value) / 1000 : round(l.value);
        ensure(kg <= 500, `${p.name}: más de 500 kg en una cubeta.`);
        const w = {
          id: randomUUID(),
          date: a.date,
          product: p.id,
          kg,
          at: now(),
        };
        if (old >= 0) s.weighings[old] = { ...w, id: s.weighings[old]!.id };
        else s.weighings.push(w);
        saved++;
      }
      note = `Pesada de la mañana del ${a.date}: ${saved} ${saved === 1 ? "sabor apuntado" : "sabores apuntados"}${removed ? `, ${removed} quitado${removed === 1 ? "" : "s"}` : ""}. Es una medición: no cambia el stock ni las ventas.`;
      break;
    }
    case "quickFlavors": {
      const taken = new Set(
        [...s.recipes.map((r) => r.name), ...s.products.map((p) => p.name)].map(
          (n) => n.trim().toLocaleLowerCase("es"),
        ),
      );
      const added: string[] = [];
      const skipped: string[] = [];
      for (const raw of a.names) {
        const name = raw.trim();
        const key = name.toLocaleLowerCase("es");
        if (taken.has(key)) {
          skipped.push(name);
          continue;
        }
        taken.add(key);
        s.recipes.push({
          id: randomUUID(),
          name,
          family: a.family,
          product: ownGelato(s, name, a.family),
          yield: 1,
          ingredients: [],
          steps: "",
          allergens: "",
          note: "Dado de alta solo con el nombre: faltan los ingredientes.",
          saleValues: [],
        });
        added.push(name);
      }
      ensure(added.length, "Esos sabores ya existían.");
      note = `${a.family === "sorbete" ? "Sorbettos" : "Gelatos"} dados de alta: ${added.join(", ")}.${skipped.length ? ` Ya existían: ${skipped.join(", ")}.` : ""} Faltan sus ingredientes en el Recetario.`;
      break;
    }
    case "weighingCounts": {
      ensure(
        a.date === businessDay(new Date()),
        "Solo la pesada de hoy puede igualar el stock: un conteo cambia el stock de ahora.",
      );
      const today = s.weighings.filter((w) => w.date === a.date);
      ensure(today.length, "Hoy no hay ninguna pesada apuntada.");
      const undone = undoneMovements(s);
      const days = productionDays(s);
      const moved = new Set(
        s.movements
          .filter(
            (m) =>
              !undone.has(m.id) &&
              !m.reverses &&
              movementDay(s, m, 5, days) === a.date,
          )
          .map((m) => m.product),
      );
      const done: string[] = [];
      const skipped: string[] = [];
      for (const w of today) {
        const p = item(s.products, w.product);
        if (moved.has(p.id)) {
          skipped.push(p.name);
          continue;
        }
        if (round(w.kg - p.stock) === 0) continue;
        move(
          s,
          p.id,
          round(w.kg - p.stock),
          "count",
          `Pesada de la mañana del ${a.date}`,
        );
        done.push(`${p.name} ${w.kg} kg`);
      }
      ensure(
        done.length || skipped.length,
        "El stock de la app ya coincide con la pesada de hoy.",
      );
      note =
        (done.length
          ? `Stock igualado a la pesada de hoy (conteo): ${done.join(", ")}.`
          : "Ningún stock igualado.") +
        (skipped.length
          ? ` No se tocan porque ya tuvieron movimientos hoy: ${skipped.join(", ")}.`
          : "");
      break;
    }
    case "setFlavorMins": {
      const gelatos = sellableIds(s);
      const changed: string[] = [];
      for (const l of a.lines) {
        const p = item(s.products, l.product);
        ensure(gelatos.has(p.id), `${p.name} no es un gelato de una receta.`);
        const min = l.minKg === null ? undefined : round(l.minKg);
        ensure(
          min === undefined || Math.abs(min - l.minKg!) < 1e-9,
          `${p.name}: como mucho tres decimales en kilos.`,
        );
        if (p.minKg === min && !!p.paused === l.paused) continue;
        if (min === undefined) delete p.minKg;
        else p.minKg = min;
        if (l.paused) p.paused = true;
        else delete p.paused;
        changed.push(
          `${p.name}: ${min === undefined ? "sin mínimo" : "mínimo " + min + " kg"}${l.paused ? " (en pausa)" : ""}`,
        );
      }
      ensure(changed.length, "No ha cambiado ningún mínimo.");
      note = `Mínimos de la pesada: ${changed.join("; ")}. Solo avisan; no cambian stock ni producción.`;
      break;
    }
    case "skipFlavor": {
      const p = item(s.products, a.product);
      ensure(
        sellableIds(s).has(p.id),
        `${p.name} no es un gelato de una receta.`,
      );
      const had = s.flavorSkips.some(
        (x) => x.date === a.date && x.product === p.id,
      );
      s.flavorSkips = s.flavorSkips.filter(
        (x) => !(x.date === a.date && x.product === p.id),
      );
      if (a.skip) {
        ensure(!had, `${p.name} ya estaba marcado como «no se hace» ese día.`);
        s.flavorSkips.push({ date: a.date, product: p.id, at: now() });
      } else ensure(had, `${p.name} no estaba marcado ese día.`);
      note = a.skip
        ? `${p.name}: el ${a.date} no se hace. Su mínimo no avisa ese día.`
        : `${p.name}: el ${a.date} vuelve a avisar si baja del mínimo.`;
      break;
    }
    case "setReferencePrice": {
      s.referencePrices = [
        ...s.referencePrices.filter((x) => x.from !== a.from),
        { from: a.from, cents: a.cents, at: now() },
      ].sort((x, y) => x.from.localeCompare(y.from));
      note = `Precio de referencia: ${eur(a.cents)} por kilo desde el ${a.from}. Solo sirve para la segunda estimación de facturación.`;
      break;
    }
    case "calendarPhoto": {
      ensure(
        /^data:image\/(png|jpeg|webp);base64,/.test(a.data),
        "En el Calendario se suben fotos (JPG, PNG o WebP).",
      );
      const photo = {
        id: randomUUID(),
        name: a.name,
        ocrText: a.ocrText,
        data: a.data,
        note: "Foto del Calendario",
        at: now(),
        source: "photo" as const,
        calendarDate: a.date,
      };
      s.photos.unshift(photo);
      s.dayNotes = [
        {
          id: randomUUID(),
          date: a.date,
          text: a.note,
          photo: photo.id,
          at: now(),
        },
        ...s.dayNotes,
      ];
      note = `Foto guardada en el día ${a.date}${a.note ? " con su nota" : ""}. No cambia el stock.`;
      break;
    }
    case "addDayNote": {
      s.dayNotes = [
        { id: randomUUID(), date: a.date, text: a.text, at: now() },
        ...s.dayNotes,
      ];
      note = `Nota apuntada en el día ${a.date}.`;
      break;
    }
    case "removeDayNote": {
      const n = s.dayNotes.find((x) => x.id === a.id);
      ensure(n, "Esa nota ya no está.");
      // La foto no se borra: se queda en su día sin texto.
      if (n.photo) n.text = "";
      else s.dayNotes = s.dayNotes.filter((x) => x.id !== a.id);
      note = n.photo
        ? `Quitado el texto de una foto del día ${n.date}; la foto se conserva.`
        : `Quitada una nota del día ${n.date}.`;
      break;
    }
    case "reopenDay": {
      const d = s.days.find((x) => x.date === a.date);
      ensure(d && d.status === "closed", "Ese día no está cerrado.");
      d.status = "reopened";
      d.log.push({ at: now(), kind: "reopened", reason: a.reason });
      note = `Día ${a.date} reabierto. Motivo: ${a.reason}. Se puede corregir y volver a cerrar; el cierre anterior queda en el registro.`;
      break;
    }
    case "voidProduction": {
      const p = item(s.productions, a.id);
      ensure(
        p.status === "applied",
        "Solo se anula una producción aprobada. Una propuesta se descarta.",
      );
      ensureDayOpen(s, p.date);
      const undone = undoneMovements(s);
      const moves = s.movements.filter(
        (m) => m.production === p.id && !m.reverses && !undone.has(m.id),
      );
      // The finished product must still be there: what was already sold or wasted blocks it.
      for (const m of moves.filter((x) => x.kind === "output")) {
        const prod = item(s.products, m.product);
        ensure(
          prod.stock >= m.delta,
          `No se puede anular: de esos ${m.delta} ${prod.unit} de ${prod.name} ya solo quedan ${prod.stock}. Parte se vendió o se tiró. Deshaz antes el cierre de ese día, o corrige la cantidad con una producción nueva.`,
        );
      }
      const text = `Producción de ${p.quantity} kg de ${p.name} (${p.date}) anulada${a.reason ? ": " + a.reason : ""}`;
      // Finished product out first, ingredients back after: no step leaves an impossible stock.
      for (const m of [
        ...moves.filter((x) => x.kind === "output"),
        ...moves.filter((x) => x.kind !== "output"),
      ])
        move(s, m.product, -m.delta, "reversal", text, { reverses: m.id });
      p.status = "discarded";
      p.voidedAt = now();
      if (a.reason) p.voidReason = a.reason;
      if (a.redo)
        s.productions.unshift({
          id: randomUUID(),
          recipe: p.recipe,
          name: p.name,
          quantity: p.quantity,
          date: p.date,
          at: now(),
          status: "proposed",
          lines: p.lines.map((l) => ({ ...l })),
          ...(p.output ? { output: { ...p.output } } : {}),
          note: p.note,
        });
      note =
        `${text}. Los ingredientes vuelven al stock y el gelato hecho sale; los apuntes originales se conservan en Actividad.` +
        (a.redo
          ? " Queda una propuesta igual para corregirla y aprobarla de nuevo."
          : "");
      break;
    }
    case "undoCloseLine":
    case "editCloseLine": {
      const m = item(s.movements, a.id);
      const line = closeLineOf(m);
      ensure(
        line && !m.reverses && !undoneMovements(s).has(m.id),
        "Esa línea no pertenece a un cierre vigente.",
      );
      ensureDayOpen(s, line.date);
      const prod = item(s.products, m.product);
      const before = Math.abs(m.delta);
      const what =
        line.kind === "sale"
          ? "Venta"
          : line.kind === "waste"
            ? "Merma"
            : "Invitación o consumo";
      if (a.type === "undoCloseLine") {
        move(
          s,
          m.product,
          -m.delta,
          "reversal",
          `${what} del ${line.date} eliminada`,
          { reverses: m.id },
        );
        note = `${what} eliminada: ${prod.name} ${before} ${prod.unit} del ${line.date}. Stock disponible: ${prod.stock} ${prod.unit}.`;
        break;
      }
      ensure(
        a.quantity <= round(prod.stock + before),
        `${prod.name}: ${a.quantity} ${prod.unit} es más de lo que había (${round(prod.stock + before)} ${prod.unit}).`,
      );
      move(
        s,
        m.product,
        -m.delta,
        "reversal",
        `${what} del ${line.date} corregida`,
        { reverses: m.id },
      );
      // Same business day and, unless a new reason is given, the same reason as before.
      const reason =
        line.kind !== "waste"
          ? m.reason
          : a.wasteReason
            ? // Con otro motivo se conserva el detalle que escribió la persona.
              wasteReasonText(line.date, a.wasteReason) +
              (closeDetailOf(m) ? ` · ${closeDetailOf(m)}` : "")
            : m.reason;
      move(s, m.product, -a.quantity, m.kind, reason);
      note = `${what} corregida: ${prod.name} de ${before} a ${a.quantity} ${prod.unit} (${line.date}). Stock disponible: ${prod.stock} ${prod.unit}.`;
      break;
    }
    case "discardProduction": {
      const p = item(s.productions, a.id);
      ensure(p.status === "proposed", "Esta producción ya se resolvió.");
      p.status = "discarded";
      note = `Producción descartada sin cambios de stock: ${p.name} (${p.date}).`;
      break;
    }
    case "link": {
      const m = item(s.messages, a.id),
        o = item(s.orders, a.order);
      ensure(
        m.supplier === o.supplier,
        "El pedido debe pertenecer al mismo proveedor.",
      );
      m.order = o.id;
      applyReplyToOrder(o, m.interpretation);
      note = `Mensaje vinculado a ${o.number}.`;
      break;
    }
    case "photoType": {
      const photo = item(s.photos, a.id);
      photo.docType = a.docType;
      refreshSuggestion(s, photo);
      note = a.docType
        ? `Tipo de documento confirmado por la persona en la foto ${photo.name}: ${a.docType}.`
        : `Tipo de documento retirado de la foto ${photo.name}.`;
      break;
    }
    case "organizePhoto": {
      const photo = item(s.photos, a.id);
      if (a.supplier) item(s.suppliers, a.supplier);
      if (photo.order && a.supplier !== item(s.orders, photo.order).supplier)
        photo.order = undefined;
      photo.supplier = a.supplier;
      photo.documentDate = a.documentDate;
      refreshSuggestion(s, photo);
      note =
        "Clasificación del documento actualizada; se conserva el original.";
      break;
    }
    case "linkDocument": {
      const photo = item(s.photos, a.id);
      if (a.order) {
        const o = item(s.orders, a.order);
        ensure(
          !photo.supplier || photo.supplier === o.supplier,
          "El pedido pertenece a otro proveedor.",
        );
        photo.supplier = o.supplier;
        photo.order = o.id;
        note = `Documento ${photo.name} vinculado al pedido ${o.number}.`;
      } else {
        photo.order = undefined;
        note = `Documento ${photo.name} desvinculado de su pedido.`;
      }
      refreshSuggestion(s, photo);
      break;
    }
    case "applySuggestion": {
      const photo = item(s.photos, a.id);
      const sug = photo.suggestion;
      ensure(!!sug, "Este documento no tiene propuesta pendiente.");
      const applied: string[] = [];
      if (sug.supplier) {
        item(s.suppliers, sug.supplier);
        photo.supplier = sug.supplier;
        applied.push("proveedor");
      }
      if (sug.order) {
        const o = item(s.orders, sug.order);
        ensure(
          !photo.supplier || photo.supplier === o.supplier,
          "El pedido propuesto pertenece a otro proveedor.",
        );
        photo.supplier = o.supplier;
        photo.order = o.id;
        applied.push("pedido " + o.number);
      }
      if (sug.docType) {
        photo.docType = sug.docType;
        applied.push("tipo " + sug.docType);
      }
      ensure(applied.length > 0, "La propuesta no contiene cambios.");
      refreshSuggestion(s, photo);
      note = `Propuesta aceptada por la persona para ${photo.name}: ${applied.join(", ")}.`;
      break;
    }
    case "photo": {
      if (a.supplier) item(s.suppliers, a.supplier);
      if (a.order) {
        const o = item(s.orders, a.order);
        ensure(
          !a.supplier || a.supplier === o.supplier,
          "El pedido pertenece a otro proveedor.",
        );
      }
      const doc = {
        id: randomUUID(),
        name: a.name,
        ocrText: a.ocrText,
        supplier: a.supplier,
        documentDate: a.documentDate,
        data: a.data,
        note: a.note,
        at: now(),
        order: a.order,
        source: a.source,
      };
      s.photos.unshift(doc);
      refreshSuggestion(s, doc);
      note =
        a.source === "whatsapp"
          ? `Documento recibido por WhatsApp archivado: ${a.name}.`
          : "Documento guardado como adjunto local; propuestas por reglas, sin acciones automáticas.";
      break;
    }
  }
  if (a.operationId) s.processed.push(a.operationId);
  s.revision++;
  if (note) s.activity.unshift({ id: randomUUID(), at: now(), text: note });
  return validate(s);
}
