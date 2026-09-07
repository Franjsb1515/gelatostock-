const { randomUUID } = require("node:crypto");
const round = (n) => Math.round(n * 1000) / 1000;
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const qty = (n) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000000;
function seed() {
  const products = [
    [
      "p1",
      "Café de especialidad",
      "Blend casa · tueste medio",
      "Cafetería",
      "kg",
      2.4,
      4,
      8,
      1,
      2450,
      "s1",
      "coffee",
    ],
    [
      "p2",
      "Leche entera",
      "Caja de 6 × 1 L",
      "Cafetería",
      "L",
      8,
      12,
      30,
      6,
      690,
      "s2",
      "milk",
    ],
    [
      "p3",
      "Pistacho siciliano",
      "Helado terminado · cubeta 5 kg",
      "Gelatería",
      "kg",
      3.2,
      5,
      10,
      5,
      6800,
      "s3",
      "ice",
    ],
    [
      "p4",
      "Chocolate 70 %",
      "Helado terminado · cubeta 5 kg",
      "Gelatería",
      "kg",
      7.5,
      4,
      10,
      5,
      4900,
      "s3",
      "ice",
    ],
    [
      "p5",
      "Vainilla de Madagascar",
      "Helado terminado · cubeta 5 kg",
      "Gelatería",
      "kg",
      6,
      4,
      10,
      5,
      4500,
      "s3",
      "ice",
    ],
    [
      "p6",
      "Vasos para llevar",
      "Paquete de 50 · 240 ml",
      "Envases",
      "ud",
      35,
      100,
      250,
      50,
      480,
      "s4",
      "cup",
    ],
    [
      "p7",
      "Bebida de avena",
      "Barista · caja de 6 × 1 L",
      "Cafetería",
      "L",
      12,
      6,
      24,
      6,
      1380,
      "s2",
      "milk",
    ],
    [
      "p8",
      "Tarta de queso",
      "Porciones terminadas · caja de 8",
      "Postres",
      "ud",
      5,
      8,
      16,
      8,
      2400,
      "s2",
      "cake",
    ],
    [
      "p9",
      "Conos artesanos",
      "Caja de 100 unidades",
      "Envases",
      "ud",
      140,
      80,
      200,
      100,
      1850,
      "s4",
      "ice",
    ],
    [
      "p10",
      "Nata para montar",
      "Caja de 6 × 1 L",
      "Postres",
      "L",
      9,
      6,
      18,
      6,
      2580,
      "s2",
      "milk",
    ],
  ].map(
    ([
      id,
      name,
      detail,
      category,
      unit,
      stock,
      min,
      target,
      pack,
      price,
      supplier,
      icon,
    ]) => ({
      id,
      name,
      detail,
      category,
      unit,
      stock,
      min,
      target,
      pack,
      price,
      supplier,
      icon,
    }),
  );
  return {
    version: 1,
    revision: 0,
    business: "Gelato & Café",
    demo: true,
    products,
    suppliers: [
      {
        id: "s1",
        name: "Origen Coffee",
        initials: "OC",
        category: "Café de especialidad",
        delivery: "Martes y jueves",
        color: "sand",
      },
      {
        id: "s2",
        name: "Fresco Mercado",
        initials: "FM",
        category: "Lácteos y pastelería",
        delivery: "Lunes a viernes",
        color: "rose",
      },
      {
        id: "s3",
        name: "Gelato Italia",
        initials: "GI",
        category: "Helados artesanos",
        delivery: "Miércoles y viernes",
        color: "sage",
      },
      {
        id: "s4",
        name: "EcoPack",
        initials: "EP",
        category: "Envases y consumibles",
        delivery: "48–72 horas",
        color: "lavender",
      },
    ],
    processed: [],
    cart: [],
    orders: [],
    messages: [
      {
        id: "welcome-message",
        supplier: "s2",
        text: "Buenos días. Esta semana la entrega del jueves pasa al viernes. Confírmanos si te viene bien.",
        kind: "delivery",
        priority: "important",
        reason: "Cambio de entrega: requiere revisión.",
        read: false,
        reviewed: false,
        at: new Date().toISOString(),
        simulated: true,
      },
    ],
    activity: [
      {
        id: randomUUID(),
        at: new Date().toISOString(),
        text: "Espacio de demostración creado. Los proveedores y precios son ficticios.",
      },
    ],
    photos: [],
  };
}
function pending(s, id) {
  return round(
    s.orders
      .filter((o) => o.status !== "received")
      .reduce(
        (sum, o) =>
          sum +
          o.lines
            .filter((l) => l.product === id)
            .reduce((a, l) => a + l.packs * l.pack - l.received, 0),
        0,
      ),
  );
}
function needed(s, p) {
  return Math.max(
    0,
    Math.ceil(round(p.target - p.stock - pending(s, p.id)) / p.pack),
  );
}
function classify(text) {
  const t = text.toLowerCase();
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
function validate(s) {
  assert(
    s &&
      s.version === 1 &&
      s.demo === true &&
      typeof s.business === "string" &&
      s.business.length <= 80,
    "Copia incompatible con este prototipo.",
  );
  for (const k of [
    "products",
    "suppliers",
    "cart",
    "orders",
    "messages",
    "activity",
    "photos",
  ])
    assert(
      Array.isArray(s[k]) && s[k].length <= 20000,
      `Datos inválidos: ${k}`,
    );
  for (const key of ["products", "suppliers", "orders", "messages", "photos"])
    assert(
      new Set(s[key].map((x) => x.id)).size === s[key].length,
      "Identificadores repetidos.",
    );
  for (const k of ["products", "suppliers", "orders", "messages", "photos"])
    for (const x of s[k])
      assert(
        typeof x.id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(x.id),
        "Identificador inválido.",
      );
  const supplierIds = new Set(s.suppliers.map((x) => x.id));
  const productIds = new Set(s.products.map((x) => x.id));
  for (const x of s.suppliers)
    assert(
      typeof x.id === "string" &&
        typeof x.name === "string" &&
        typeof x.initials === "string" &&
        typeof x.category === "string" &&
        typeof x.delivery === "string" &&
        ["sage", "rose", "sand", "lavender"].includes(x.color),
      "Proveedor inválido.",
    );
  for (const x of s.products)
    assert(
      typeof x.id === "string" &&
        typeof x.name === "string" &&
        x.name.length > 0 &&
        typeof x.detail === "string" &&
        typeof x.category === "string" &&
        ["kg", "L", "ud"].includes(x.unit) &&
        qty(x.stock) &&
        qty(x.min) &&
        qty(x.target) &&
        x.target >= x.min &&
        qty(x.pack) &&
        x.pack > 0 &&
        Number.isSafeInteger(x.price) &&
        x.price >= 0 &&
        x.price <= 100000000 &&
        supplierIds.has(x.supplier),
      "Producto inválido.",
    );
  for (const x of s.cart)
    assert(
      productIds.has(x.product) &&
        Number.isInteger(x.packs) &&
        x.packs > 0 &&
        x.packs <= 10000,
      "Carrito inválido.",
    );
  assert(
    new Set(s.cart.map((x) => x.product)).size === s.cart.length,
    "Líneas repetidas.",
  );
  for (const o of s.orders) {
    assert(
      typeof o.id === "string" &&
        supplierIds.has(o.supplier) &&
        ["pending", "sent", "partial", "received"].includes(o.status) &&
        Array.isArray(o.lines) &&
        o.lines.length > 0 &&
        typeof o.at === "string",
      "Pedido inválido.",
    );
    for (const l of o.lines)
      assert(
        productIds.has(l.product) &&
          Number.isInteger(l.packs) &&
          l.packs > 0 &&
          l.packs <= 10000 &&
          qty(l.pack) &&
          l.pack > 0 &&
          Number.isSafeInteger(l.price) &&
          l.price >= 0 &&
          qty(l.received) &&
          l.received <= l.packs * l.pack,
        "Recepción inválida.",
      );
  }
  for (const m of s.messages)
    assert(
      typeof m.id === "string" &&
        typeof m.text === "string" &&
        m.text.length <= 5000 &&
        supplierIds.has(m.supplier) &&
        ["important", "normal", "low", "review"].includes(m.priority) &&
        typeof m.reason === "string" &&
        typeof m.read === "boolean" &&
        typeof m.at === "string" &&
        (!m.order ||
          s.orders.some((o) => o.id === m.order && o.supplier === m.supplier)),
      "Mensaje inválido.",
    );
  for (const a of s.activity)
    assert(
      typeof a.text === "string" && typeof a.at === "string",
      "Historial inválido.",
    );
  for (const ph of s.photos)
    assert(
      typeof ph.name === "string" &&
        typeof ph.note === "string" &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(ph.data) &&
        ph.data.length < 8000000,
      "Foto inválida.",
    );
  assert(
    !s.processed ||
      (Array.isArray(s.processed) &&
        s.processed.length <= 20000 &&
        s.processed.every((x) => typeof x === "string")),
    "Operaciones inválidas.",
  );
  assert(
    Buffer.byteLength(JSON.stringify(s)) <= 24000000,
    "El archivo local llegó al límite de 24 MB del prototipo. Exportá los datos antes de continuar.",
  );
  assert(
    Number.isSafeInteger(s.revision) && s.revision >= 0,
    "Versión inválida.",
  );
  return s;
}
function apply(state, a) {
  assert(a && typeof a.type === "string", "Acción inválida.");
  if (a.operationId && (state.processed || []).includes(a.operationId))
    return state;
  if (a.revision !== undefined)
    assert(
      a.revision === state.revision,
      "Los datos cambiaron. Revisá la operación.",
    );
  const s = structuredClone(state);
  let note = "";
  if (a.type === "count") {
    const p = s.products.find((p) => p.id === a.product);
    assert(p && qty(a.value), "Cantidad inválida.");
    note = `Conteo de ${p.name}: ${p.stock} → ${a.value} ${p.unit}.`;
    p.stock = round(a.value);
  } else if (a.type === "product") {
    assert(
      typeof a.name === "string" &&
        a.name.trim().length > 0 &&
        a.name.length <= 100,
      "Escribí un nombre válido.",
    );
    s.products.push({
      id: randomUUID(),
      name: a.name.trim(),
      detail: String(a.detail || "").slice(0, 200),
      category: a.category,
      unit: a.unit,
      stock: a.stock,
      min: a.min,
      target: a.target,
      pack: a.pack,
      price: a.price,
      supplier: a.supplier,
      icon: "box",
    });
    note = `Producto creado: ${a.name}.`;
  } else if (a.type === "cart") {
    const p = s.products.find((p) => p.id === a.product);
    assert(
      p && Number.isInteger(a.packs) && a.packs >= 0 && a.packs <= 10000,
      "Cantidad de paquetes inválida.",
    );
    s.cart = s.cart.filter((l) => l.product !== p.id);
    if (a.packs) s.cart.push({ product: p.id, packs: a.packs });
    note = `Carrito actualizado: ${p.name}.`;
  } else if (a.type === "suggest") {
    for (const p of s.products.filter((p) => p.stock < p.min)) {
      const n = needed(s, p);
      if (n && !s.cart.some((l) => l.product === p.id))
        s.cart.push({ product: p.id, packs: n });
    }
    note = "Reposición propuesta con los pedidos pendientes descontados.";
  } else if (a.type === "authorize") {
    assert(
      a.revision === s.revision,
      "El carrito cambió. Revisalo antes de autorizar.",
    );
    assert(s.cart.length, "El carrito está vacío.");
    for (const supplier of new Set(
      s.cart.map((l) => s.products.find((p) => p.id === l.product).supplier),
    )) {
      s.orders.unshift({
        id: randomUUID(),
        number: `GS-${String(s.orders.length + 1).padStart(3, "0")}`,
        supplier,
        status: "pending",
        at: new Date().toISOString(),
        simulated: true,
        lines: s.cart
          .filter(
            (l) =>
              s.products.find((p) => p.id === l.product).supplier === supplier,
          )
          .map((l) => {
            const p = s.products.find((p) => p.id === l.product);
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
      "Pedidos de demostración autorizados y pendientes. No se ha contactado a proveedores.";
  } else if (a.type === "send") {
    const o = s.orders.find((o) => o.id === a.order);
    assert(o && o.status === "pending", "Este pedido ya se procesó.");
    o.status = "sent";
    note = `Envío SIMULADO de ${o.number}. Ningún mensaje real enviado.`;
  } else if (a.type === "receive") {
    const o = s.orders.find((o) => o.id === a.order);
    assert(
      o && ["sent", "partial"].includes(o.status),
      "Primero simulá el envío del pedido.",
    );
    assert(
      Array.isArray(a.lines) &&
        a.lines.length &&
        new Set(a.lines.map((l) => l.product)).size === a.lines.length,
      "Recepción inválida.",
    );
    let total = 0;
    for (const l of a.lines) {
      const ol = o.lines.find((x) => x.product === l.product);
      assert(
        ol &&
          qty(l.value) &&
          l.value <= round(ol.packs * ol.pack - ol.received),
        "La recepción supera la cantidad pendiente.",
      );
      ol.received = round(ol.received + l.value);
      s.products.find((p) => p.id === l.product).stock = round(
        s.products.find((p) => p.id === l.product).stock + l.value,
      );
      total += l.value;
    }
    assert(total > 0, "Indicá al menos una cantidad recibida.");
    o.status = o.lines.every(
      (l) => round(l.received) === round(l.packs * l.pack),
    )
      ? "received"
      : "partial";
    note = `Recepción ${o.status === "received" ? "completa" : "parcial"} registrada para ${o.number}.`;
  } else if (a.type === "message") {
    assert(
      s.suppliers.some((x) => x.id === a.supplier) &&
        typeof a.text === "string" &&
        a.text.trim() &&
        a.text.length <= 5000,
      "Mensaje inválido.",
    );
    if (a.eventId && s.messages.some((m) => m.id === a.eventId)) return s;
    const c = classify(a.text);
    s.messages.unshift({
      id: a.eventId || randomUUID(),
      supplier: a.supplier,
      text: a.text,
      ...c,
      at: new Date().toISOString(),
      read: false,
      reviewed: false,
      simulated: true,
    });
    note = `Evento de demostración recibido de ${s.suppliers.find((x) => x.id === a.supplier).name}.`;
  } else if (a.type === "read") {
    const m = s.messages.find((m) => m.id === a.id);
    assert(m, "Mensaje inexistente.");
    m.read = true;
  } else if (a.type === "review") {
    const m = s.messages.find((m) => m.id === a.id);
    assert(m, "Mensaje inexistente.");
    m.reviewed = true;
    m.read = true;
    note =
      "Mensaje marcado como revisado; no se aceptaron cambios comerciales.";
  } else if (a.type === "priority") {
    const m = s.messages.find((m) => m.id === a.id);
    assert(
      m && ["important", "normal", "low", "review"].includes(a.priority),
      "Prioridad inválida.",
    );
    m.priority = a.priority;
    m.reason = "Prioridad corregida manualmente.";
    note = "Prioridad del mensaje actualizada.";
  } else if (a.type === "link") {
    const m = s.messages.find((m) => m.id === a.id);
    const o = s.orders.find((o) => o.id === a.order);
    assert(
      m && o && m.supplier === o.supplier,
      "El pedido debe pertenecer al mismo proveedor.",
    );
    m.order = o.id;
    note = `Mensaje vinculado a ${o.number}.`;
  } else if (a.type === "photo") {
    assert(
      typeof a.data === "string" && a.data.length < 8000000,
      "La imagen es demasiado grande.",
    );
    s.photos.unshift({
      id: randomUUID(),
      name: String(a.name).slice(0, 200),
      data: a.data,
      note: String(a.note || "").slice(0, 500),
      at: new Date().toISOString(),
    });
    note =
      "Foto guardada para consulta manual. No se ejecutó reconocimiento automático.";
  } else throw new Error("Acción no disponible.");
  s.processed = s.processed || [];
  if (a.operationId) {
    assert(
      typeof a.operationId === "string" && a.operationId.length <= 100,
      "Operación inválida.",
    );
    s.processed.push(a.operationId);
  }
  s.revision++;
  if (note)
    s.activity.unshift({
      id: randomUUID(),
      at: new Date().toISOString(),
      text: note,
    });
  return validate(s);
}
module.exports = { seed, apply, validate, pending, needed, classify };
