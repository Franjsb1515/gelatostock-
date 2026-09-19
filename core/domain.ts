import { randomUUID } from "node:crypto";
import {
  interpretReply,
  labels as replyLabels,
  normalizePhrase,
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
export { localDate } from "./messages";
export { recipeBalance, balanceRanges, balanceLabels } from "./balance";
export { weeklyReport, weekStart, weekBounds } from "./report";
export { priceAlerts, countStatus, zoneLabels } from "./inventory";
export {
  orderReminders,
  defaultOrderTemplate,
  renderOrderTemplate,
} from "./orders";
import { defaultOrderTemplate, renderOrderTemplate } from "./orders";
import { zoneLabels } from "./inventory";
import {
  wasteReasonText,
  wasteReasonLabels,
  giftText,
  closeMovements,
  closeLineOf,
  undoneMovements,
} from "./sales";
export {
  salesHistory,
  giftLabel,
  wasteReasons,
  wasteReasonLabels,
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
import { computeDay, dayCloseId, isDayClosed } from "./day";
export { computeDay, daySummary, isDayClosed } from "./day";
const eur = (cents: number): string =>
  (cents / 100).toFixed(2).replace(".", ",") + " €";
export const round = (n: number) => Math.round(n * 1000) / 1000;
export function ensure(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const now = () => new Date().toISOString();
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
    Math.ceil(round(p.target - p.stock - pending(s, p.id)) / p.pack),
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
        relevanceReason: `Menciona ${matches[0]!.number}, un pedido de este proveedor. Verificá el contenido antes de vincularlo.`,
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
      "El producto terminado no puede ser ingrediente de su propia receta.",
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
    after >= 0 && after <= 1_000_000,
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
      move(s, p.id, a.kind === "entry" ? a.value : -a.value, a.kind, a.reason);
      note = `${a.kind === "entry" ? "Entrada" : a.kind === "waste" ? "Merma" : "Salida"}: ${p.name}, ${a.value} ${p.unit}. ${a.reason}`;
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
      if (a.composition !== undefined)
        p.composition = Object.values(a.composition).some(
          (v) => v !== undefined,
        )
          ? a.composition
          : undefined;
      note = `Ficha actualizada: ${p.name}. La unidad base y el stock no se modificaron.`;
      break;
    }
    case "supplier": {
      const { type, revision, operationId, id, ...fields } = a;
      if (id) Object.assign(item(s.suppliers, id), fields);
      else s.suppliers.push({ id: randomUUID(), ...fields });
      note = `Proveedor guardado: ${a.name}. Sin conexión externa.`;
      break;
    }
    case "cart": {
      item(s.products, a.product);
      s.cart = s.cart.filter((l) => l.product !== a.product);
      if (a.packs) s.cart.push({ product: a.product, packs: a.packs });
      note = "Carrito actualizado.";
      break;
    }
    case "suggest": {
      for (const p of s.products.filter((p) => p.stock < p.min)) {
        const packs = needed(s, p);
        if (packs && !s.cart.some((l) => l.product === p.id))
          s.cart.push({ product: p.id, packs });
      }
      note = "Reposición propuesta descontando pedidos pendientes.";
      break;
    }
    case "authorize": {
      ensure(
        a.revision === s.revision,
        "El carrito cambió. Revisalo antes de autorizar.",
      );
      ensure(s.cart.length, "El carrito está vacío.");
      for (const supplier of new Set(
        s.cart.map((l) => item(s.products, l.product).supplier),
      )) {
        const number =
          Math.max(0, ...s.orders.map((o) => Number(o.number.slice(3)))) + 1;
        s.orders.unshift({
          id: randomUUID(),
          number: `GS-${String(number).padStart(3, "0")}`,
          supplier,
          status: "pending",
          at: now(),
          simulated: true,
          lines: s.cart
            .filter((l) => item(s.products, l.product).supplier === supplier)
            .map((l) => {
              const p = item(s.products, l.product);
              return {
                product: p.id,
                packs: l.packs,
                pack: p.pack,
                price: p.price,
                received: 0,
              };
            }),
        });
      }
      s.cart = [];
      note =
        "Pedidos de demostración autorizados. Ningún envío real realizado.";
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
        "Primero simulá el envío del pedido.",
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
      const { type, revision, operationId, id, ...fields } = a;
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
        ensure(p.unit === "kg", "El producto terminado debe medirse en kg.");
      }
      if (id) Object.assign(item(s.recipes, id), fields);
      else s.recipes.push({ id: randomUUID(), ...fields, saleValues: [] });
      note = `Receta guardada: ${fields.name} (rinde ${fields.yield} kg).`;
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
      note = `Identidad del negocio actualizada: ${a.name}${a.place ? " · " + a.place : ""}.`;
      break;
    }
    case "setSaleValue": {
      const r = item(s.recipes, a.recipe);
      ensure(
        r.product,
        "Asigna primero un producto terminado a la receta: el valor se aplica a sus kilos.",
      );
      const owner = s.recipes.find(
        (x) => x.product === r.product && x.saleValues.length,
      );
      ensure(
        !owner || owner.id === r.id,
        `El valor de este producto terminado ya se lleva en la receta «${owner?.name}».`,
      );
      const before = saleValueOn(s, r.product, a.from);
      r.saleValues = [
        ...r.saleValues.filter((v) => v.from !== a.from),
        { from: a.from, cents: a.cents, at: now() },
      ].sort((x, y) => x.from.localeCompare(y.from));
      note = `Valor de venta de ${r.name}: ${eur(a.cents)} por kilo desde el ${a.from}${before !== null && before !== a.cents ? ` (antes ${eur(before)})` : ""}. Los días anteriores conservan el valor que tenían.`;
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
      const factor = a.quantity / r.yield;
      const lines = r.ingredients.map((i) => {
        const p = item(s.products, i.product);
        const raw = i.quantity * factor;
        return {
          product: i.product,
          quantity: p.unit === "ud" ? Math.ceil(raw - 1e-9) : round(raw),
        };
      });
      s.productions.unshift({
        id: randomUUID(),
        recipe: r.id,
        name: r.name,
        quantity: a.quantity,
        date: a.date,
        at: now(),
        status: "proposed",
        lines,
        ...(r.product
          ? { output: { product: r.product, quantity: a.quantity } }
          : {}),
        note: "",
      });
      note = `Producción propuesta: ${a.quantity} kg de ${r.name} (${a.date}). Consumo estimado por receta; nada cambia hasta aprobarlo.`;
      break;
    }
    case "applyProduction": {
      const p = item(s.productions, a.id);
      ensure(p.status === "proposed", "Esta producción ya se resolvió.");
      const r = item(s.recipes, p.recipe);
      ensureDayOpen(s, p.date);
      ensure(
        new Set(a.lines.map((l) => l.product)).size === a.lines.length &&
          a.lines.every((l) =>
            r.ingredients.some((i) => i.product === l.product),
          ),
        "Solo se pueden ajustar ingredientes de la receta.",
      );
      p.lines = a.lines.map((l) => ({
        product: l.product,
        quantity: l.quantity,
      }));
      if (p.output && a.output !== undefined) p.output.quantity = a.output;
      p.note = a.note;
      p.status = "applied";
      // Snapshot with today's purchase prices and the approved consumption; later price changes
      // never rewrite it.
      const cost = productionCost(s, r, p);
      if (cost) p.cost = cost;
      else delete p.cost;
      const consumed: string[] = [];
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
      }
      if (p.output && p.output.quantity)
        move(
          s,
          p.output.product,
          p.output.quantity,
          "output",
          `Producto terminado: ${p.name} (${p.date})`,
          { production: p.id },
        );
      const short = s.products.filter(
        (x) => p.lines.some((l) => l.product === x.id) && x.stock < x.min,
      );
      note =
        `Producción aprobada: ${p.quantity} kg de ${p.name} (${p.date}). Consumo: ${consumed.join(", ") || "sin consumo"}.` +
        (short.length
          ? ` Por debajo del mínimo tras producir: ${short.map((x) => x.name).join(", ")}. Revisa la reposición.`
          : "");
      break;
    }
    case "dailySales": {
      ensureDayOpen(s, a.date);
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
        const sold =
          l.remaining === undefined
            ? (l.sold ?? 0)
            : Math.round((p.stock - l.waste - l.gift - l.remaining) * 1000) /
              1000;
        ensure(
          sold >= 0,
          `${p.name}: queda más de lo que había (${p.stock} ${p.unit}). Si se produjo más, aprueba antes esa producción.`,
        );
        ensure(
          sold + l.waste + l.gift <= p.stock,
          `${p.name}: vendido, merma e invitación suman más que el stock (${p.stock} ${p.unit}).`,
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
        `${text}. Los ingredientes vuelven al stock y el producto terminado sale; los movimientos originales se conservan.` +
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
            ? wasteReasonText(line.date, a.wasteReason)
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
