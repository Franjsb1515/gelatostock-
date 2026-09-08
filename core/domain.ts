import { randomUUID } from "node:crypto";
import { interpretReply, labels as replyLabels } from "./messages";
import {
  stateSchema,
  parseAction,
  type State,
  type Product,
  type Movement,
  type Message,
} from "./schema";
export { seed } from "./seed";
export {
  interpretReply,
  resolveDate,
  replyCategories,
  labels as replyLabels,
} from "./messages";
export const round = (n: number) => Math.round(n * 1000) / 1000;
export function ensure(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const now = () => new Date().toISOString();
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
export function orderMessage(s: State, orderId: string): string {
  const o = item(s.orders, orderId);
  const lines = o.lines.map((l) => {
    const p = item(s.products, l.product);
    return `- ${l.packs} × ${p.name} (${round(l.pack)} ${p.unit} por presentación, ${round(l.packs * l.pack)} ${p.unit})`;
  });
  return [
    `Hola, pedido ${o.number} de ${s.business}:`,
    ...lines,
    "¿Nos confirmas disponibilidad y fecha de entrega? Gracias.",
  ].join("\n");
}
export function classify(
  text: string,
  at = now(),
): Pick<Message, "kind" | "priority" | "reason" | "interpretation"> {
  const base = classifyLegacy(text.toLowerCase());
  const interpretation =
    base.kind === "promotion"
      ? {
          category: "other" as const,
          needsReading: false,
          summary:
            "Promoción informativa; no requiere respuesta ni cambia pedidos.",
        }
      : interpretReply(text, at);
  const byCategory: Partial<
    Record<typeof interpretation.category, Pick<Message, "kind" | "priority">>
  > = {
    out_of_stock: { kind: "change", priority: "important" },
    cancellation: { kind: "change", priority: "important" },
    change: { kind: "change", priority: "important" },
    question: { kind: "unknown", priority: "important" },
    delivery_date: { kind: "delivery", priority: "important" },
    confirmation: { kind: "confirmation", priority: "normal" },
  };
  const mapped =
    base.kind === "promotion"
      ? base
      : byCategory[interpretation.category] || base;
  return {
    kind: mapped.kind,
    priority: mapped.priority,
    reason:
      base.kind === "promotion"
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
        "Posible cambio de disponibilidad o condiciones. Revisá el mensaje.",
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
    reason: "Mensaje sin clasificación clara. Revisá su relevancia.",
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
      ? `Este proveedor tiene ${active.length} pedido(s) abierto(s), pero el mensaje no identifica cuál. Revisá la relación.`
      : "No hay una referencia comprobable a un pedido. Revisá si afecta a tu negocio.",
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
      unique(s.productions.map((p) => p.id)),
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
  for (const photo of s.photos)
    ensure(
      !photo.supplier || suppliers.has(photo.supplier),
      "Proveedor de foto inexistente.",
    );
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
          (p) => p.id === m.production && p.status === "applied",
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
      "Los datos cambiaron. Revisá la operación.",
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
      Object.assign(p, {
        name: a.name,
        detail: a.detail,
        min: a.min,
        target: a.target,
        pack: a.pack,
        price: a.price,
        supplier: a.supplier,
      });
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
      ensure(total > 0, "Indicá al menos una cantidad recibida.");
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
        ...classify(a.text),
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
          message.relevanceReason = `Respuesta al pedido ${o.number}, enviado por WhatsApp a este número. Verificá el contenido.`;
          if (message.interpretation?.deliveryDate)
            o.expected = message.interpretation.deliveryDate;
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
      else s.recipes.push({ id: randomUUID(), ...fields });
      note = `Receta guardada: ${fields.name} (rinde ${fields.yield} kg).`;
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
      if (m.interpretation?.deliveryDate)
        o.expected = m.interpretation.deliveryDate;
      note = `Mensaje vinculado a ${o.number}.`;
      break;
    }
    case "photoType": {
      const photo = item(s.photos, a.id);
      photo.docType = a.docType;
      note = a.docType
        ? `Tipo de documento confirmado por la persona en la foto ${photo.name}: ${a.docType}.`
        : `Tipo de documento retirado de la foto ${photo.name}.`;
      break;
    }
    case "organizePhoto": {
      const photo = item(s.photos, a.id);
      if (a.supplier) item(s.suppliers, a.supplier);
      photo.supplier = a.supplier;
      photo.documentDate = a.documentDate;
      note = "Clasificación de foto actualizada; se conserva el original.";
      break;
    }
    case "photo": {
      if (a.supplier) item(s.suppliers, a.supplier);
      s.photos.unshift({
        id: randomUUID(),
        name: a.name,
        ocrText: a.ocrText,
        supplier: a.supplier,
        documentDate: a.documentDate,
        data: a.data,
        note: a.note,
        at: now(),
      });
      note = "Foto guardada como adjunto local. Sin reconocimiento automático.";
      break;
    }
  }
  if (a.operationId) s.processed.push(a.operationId);
  s.revision++;
  if (note) s.activity.unshift({ id: randomUUID(), at: now(), text: note });
  return validate(s);
}
