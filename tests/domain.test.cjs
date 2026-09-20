const test = require("node:test");
const assert = require("node:assert/strict");
const {
  seed,
  apply,
  validate,
  pending,
  needed,
  classify,
  nudgeMessage,
  daysSinceDispatch,
  renderNudgeTemplate,
} = require("../src/domain.cjs");
function milkOrder() {
  let s = apply(seed(), { type: "cart", product: "p2", packs: 2 });
  s = apply(s, { type: "authorize", revision: s.revision });
  return apply(s, { type: "send", order: s.orders[0].id });
}
test("conteo reemplaza stock, persiste historial y no muta estado original", () => {
  const a = seed();
  const b = apply(a, { type: "count", product: "p1", value: 3.125 });
  assert.equal(a.products[0].stock, 2.4);
  assert.equal(b.products[0].stock, 3.125);
  assert.match(b.activity[0].text, /Conteo/);
});
test("rechaza cantidades negativas, NaN e infinitas", () => {
  for (const value of [-1, NaN, Infinity])
    assert.throws(() => apply(seed(), { type: "count", product: "p1", value }));
});
test("reposición considera pedidos en camino y respeta cajas", () => {
  const s = milkOrder();
  assert.equal(pending(s, "p2"), 12);
  assert.equal(needed(s, s.products[1]), 2);
});
test("autorizar separa proveedores y vacía carrito sin tocar stock", () => {
  let s = apply(seed(), { type: "suggest" });
  const original = s.products.map((p) => p.stock);
  s = apply(s, { type: "authorize", revision: s.revision });
  assert.equal(s.orders.length, 4);
  assert.equal(s.cart.length, 0);
  assert.deepEqual(
    s.products.map((p) => p.stock),
    original,
  );
});
test("doble autorización y doble envío no duplican pedidos", () => {
  let s = apply(seed(), { type: "cart", product: "p1", packs: 1 });
  const a = { type: "authorize", revision: s.revision };
  s = apply(s, a);
  assert.throws(() => apply(s, a));
  const send = { type: "send", order: s.orders[0].id };
  s = apply(s, send);
  assert.throws(() => apply(s, send));
});
test("rechaza autorización con versión obsoleta", () => {
  let s = apply(seed(), { type: "cart", product: "p1", packs: 1 });
  assert.throws(() => apply(s, { type: "authorize", revision: 0 }));
});
test("recepción parcial y total convierten cajas a litros una sola vez", () => {
  let s = milkOrder();
  const id = s.orders[0].id;
  s = apply(s, {
    type: "receive",
    order: id,
    lines: [{ product: "p2", value: 6 }],
  });
  assert.equal(s.products[1].stock, 14);
  assert.equal(s.orders[0].status, "partial");
  assert.equal(pending(s, "p2"), 6);
  s = apply(s, {
    type: "receive",
    order: id,
    lines: [{ product: "p2", value: 6 }],
  });
  assert.equal(s.products[1].stock, 20);
  assert.equal(s.orders[0].status, "received");
  assert.throws(() =>
    apply(s, {
      type: "receive",
      order: id,
      lines: [{ product: "p2", value: 1 }],
    }),
  );
});
test("reintentar la misma recepción es idempotente", () => {
  let s = milkOrder();
  const a = {
    type: "receive",
    order: s.orders[0].id,
    operationId: "same-operation",
    lines: [{ product: "p2", value: 3 }],
  };
  s = apply(s, a);
  const before = structuredClone(s);
  s = apply(s, a);
  assert.deepEqual(s, before);
});
test("recepciones imposibles y líneas duplicadas se rechazan sin cambios", () => {
  const s = milkOrder();
  const snapshot = JSON.stringify(s);
  for (const lines of [
    [{ product: "p2", value: 13 }],
    [
      { product: "p2", value: 6 },
      { product: "p2", value: 6 },
    ],
    [{ product: "p2", value: 0 }],
  ])
    assert.throws(() =>
      apply(s, { type: "receive", order: s.orders[0].id, lines }),
    );
  assert.equal(JSON.stringify(s), snapshot);
});
test("mensajes relevantes y promociones se distinguen sin modificar stock", () => {
  const s = seed();
  const a = apply(s, {
    type: "message",
    supplier: "s1",
    text: "Sin stock de café",
    eventId: "event-1",
  });
  assert.equal(a.messages[0].priority, "important");
  assert.deepEqual(a.products, s.products);
  assert.equal(
    apply(a, {
      type: "message",
      supplier: "s1",
      text: "Sin stock de café",
      eventId: "event-1",
    }).messages.length,
    a.messages.length,
  );
  assert.equal(classify("Promoción del mes").priority, "low");
  assert.equal(classify("xyz").priority, "review");
});
test("no vincula mensajes a otro proveedor", () => {
  const s = milkOrder();
  const m = apply(s, { type: "message", supplier: "s1", text: "Confirmado" });
  assert.throws(() =>
    apply(m, { type: "link", id: m.messages[0].id, order: m.orders[0].id }),
  );
});
test("copias inválidas se rechazan", () => {
  const s = seed();
  s.products[0].stock = -5;
  assert.throws(() => validate(s));
  assert.throws(() => validate({ version: 99 }));
});
test("alta de producto valida presentación y objetivo", () => {
  const a = {
    type: "product",
    name: "Cacao",
    category: "Postres",
    unit: "kg",
    stock: 2,
    min: 1,
    target: 4,
    pack: 1,
    price: 1500,
    supplier: "s1",
  };
  assert.equal(apply(seed(), a).products.length, 11);
  assert.throws(() => apply(seed(), { ...a, pack: 0 }));
  assert.throws(() => apply(seed(), { ...a, target: 0 }));
});
test("copia con identificadores capaces de inyectar HTML se rechaza", () => {
  const s = seed();
  s.messages[0].id = 'x" onclick="alert(1)';
  assert.throws(() => validate(s));
});
test("entrada, salida y corrección conservan un historial compensado", () => {
  let s = apply(seed(), {
    type: "movement",
    product: "p1",
    kind: "entry",
    value: 2,
    reason: "Entrega",
  });
  const id = s.movements[0].id;
  s = apply(s, {
    type: "movement",
    product: "p1",
    kind: "exit",
    value: 1,
    reason: "Barra",
  });
  s = apply(s, { type: "reverse", id, reason: "Entrega duplicada" });
  assert.equal(s.products[0].stock, 1.4);
  assert.equal(s.movements.length, 3);
  assert.throws(() => apply(s, { type: "reverse", id, reason: "Reintento" }));
  assert.throws(() =>
    apply(s, {
      type: "movement",
      product: "p1",
      kind: "waste",
      value: 2,
      reason: "Merma",
    }),
  );
});
test("cancelar pendiente libera reposición y no altera stock", () => {
  let s = apply(seed(), { type: "cart", product: "p1", packs: 6 });
  s = apply(s, { type: "authorize", revision: s.revision });
  assert.equal(pending(s, "p1"), 6);
  s = apply(s, { type: "cancel", order: s.orders[0].id });
  assert.equal(pending(s, "p1"), 0);
  assert.equal(s.products[0].stock, 2.4);
  assert.throws(() => apply(s, { type: "send", order: s.orders[0].id }));
});
test("editar presentación no cambia los pedidos ya autorizados", () => {
  let s = apply(seed(), { type: "cart", product: "p2", packs: 2 });
  s = apply(s, { type: "authorize", revision: s.revision });
  const p = s.products[1];
  s = apply(s, {
    type: "editProduct",
    product: p.id,
    name: p.name,
    detail: p.detail,
    min: p.min,
    target: p.target,
    pack: 12,
    price: 1500,
    supplier: p.supplier,
  });
  assert.equal(s.orders[0].lines[0].pack, 6);
  assert.equal(s.orders[0].lines[0].price, 690);
});
test("no admite fracciones de unidades ni estados recibidos inconsistentes", () => {
  assert.throws(() =>
    apply(seed(), { type: "count", product: "p6", value: 1.5 }),
  );
  const s = milkOrder();
  s.orders[0].status = "received";
  assert.throws(() => validate(s));
});

test("relevancia por referencia exacta no cambia prioridad ni pedidos", () => {
  const s = milkOrder(),
    order = s.orders[0];
  const result = apply(s, {
    type: "message",
    supplier: order.supplier,
    text: `Oferta para ${order.number}`,
  });
  assert.equal(result.messages[0].relevance, "relevant");
  assert.equal(result.messages[0].priority, "low");
  assert.equal(result.messages[0].order, undefined);
  assert.deepEqual(result.orders, s.orders);
  assert.deepEqual(result.products, s.products);
});
test("referencias ajenas, desconocidas o múltiples requieren revisión", () => {
  const s = milkOrder(),
    o = s.orders[0];
  const other = s.suppliers.find((x) => x.id !== o.supplier).id;
  for (const [supplier, text] of [
    [other, o.number],
    [o.supplier, "GS-999999"],
    [o.supplier, `${o.number} GS-999999`],
  ]) {
    const m = apply(s, { type: "message", supplier, text }).messages[0];
    assert.equal(m.relevance, "review");
    assert.equal(m.order, undefined);
  }
});
test("pedido abierto sin referencia no basta para vincular un mensaje", () => {
  const s = milkOrder();
  const m = apply(s, {
    type: "message",
    supplier: s.orders[0].supplier,
    text: "Entrega mañana",
  }).messages[0];
  assert.equal(m.priority, "important");
  assert.equal(m.relevance, "review");
  assert.match(m.relevanceReason, /abierto/);
});
test("corrección manual conserva original y prioridad y registra motivo", () => {
  let s = apply(seed(), {
    type: "message",
    supplier: "s1",
    text: "Oferta de café",
  });
  const m = s.messages[0];
  s = apply(s, {
    type: "relevance",
    id: m.id,
    relevance: "irrelevant",
    reason: "Producto fuera de nuestra carta",
  });
  assert.equal(s.messages[0].text, m.text);
  assert.equal(s.messages[0].priority, m.priority);
  assert.equal(s.messages[0].relevance, "irrelevant");
  assert.match(s.activity[0].text, /fuera de nuestra carta/);
  assert.throws(() =>
    apply(s, {
      type: "relevance",
      id: m.id,
      relevance: "relevant",
      reason: " ",
    }),
  );
});
test("eventos repetidos no duplican y un ID con otro contenido se rechaza", () => {
  const a = {
    type: "message",
    supplier: "s1",
    text: "Hola",
    eventId: "evt-supplier-1",
  };
  const s = apply(seed(), a);
  assert.deepEqual(apply(s, a), s);
  assert.throws(
    () => apply(s, { ...a, text: "Otro mensaje" }),
    /otro contenido/,
  );
  assert.throws(() => apply(s, { ...a, supplier: "s2" }), /otro contenido/);
});
test("copia anterior sin relevancia conserva mensajes para revisión", () => {
  const s = seed();
  for (const m of s.messages) {
    delete m.relevance;
    delete m.relevanceReason;
  }
  const restored = validate(s);
  assert.ok(restored.messages.every((m) => m.relevance === "review"));
  assert.deepEqual(
    restored.messages.map((m) => m.text),
    s.messages.map((m) => m.text),
  );
});

const { interpretReply, resolveDate } = require("../src/domain.cjs");
const AT = "2026-09-08T10:00:00.000Z"; // martes
test("respuestas de proveedor: falta de producto, confirmación y fecha resuelta", () => {
  const falta = interpretReply(
    "Hola, no tengo nata esta semana, lo siento",
    AT,
  );
  assert.equal(falta.category, "out_of_stock");
  assert.equal(falta.needsReading, true);
  assert.match(falta.missing, /nata/);
  const ok = interpretReply("Ok perfecto, anotado", AT);
  assert.equal(ok.category, "confirmation");
  assert.equal(ok.needsReading, false);
  const lunes = interpretReply("El pedido llega el lunes", AT);
  assert.equal(lunes.category, "delivery_date");
  assert.equal(lunes.deliveryDate, "2026-09-14");
  assert.equal(lunes.needsReading, false);
  const retraso = interpretReply("No podremos entregar hasta el jueves", AT);
  assert.equal(retraso.category, "delivery_date");
  assert.equal(retraso.deliveryDate, "2026-09-10");
  assert.equal(retraso.needsReading, true);
  assert.equal(
    interpretReply("¿Prefieres esperar al lunes o cancelar?", AT).category,
    "cancellation",
  );
  assert.equal(
    interpretReply("¿Te viene bien a las 10?", AT).category,
    "question",
  );
  assert.equal(interpretReply("Solo quedan dos cajas", AT).category, "change");
  assert.equal(interpretReply("asdf qwer", AT).needsReading, true);
});
test("fechas relativas: mañana, día del mes, dd/mm, en N días y sin fecha exacta", () => {
  assert.equal(resolveDate("llega mañana", AT).date, "2026-09-09");
  assert.equal(resolveDate("pasado mañana sin falta", AT).date, "2026-09-10");
  assert.equal(resolveDate("te lo mando el 20", AT).date, "2026-09-20");
  assert.equal(resolveDate("el día 3 lo tienes", AT).date, "2026-10-03");
  assert.equal(resolveDate("sale el 15/09", AT).date, "2026-09-15");
  assert.equal(resolveDate("en 3 días", AT).date, "2026-09-11");
  assert.equal(resolveDate("la semana que viene", AT).date, undefined);
  assert.equal(
    resolveDate("la semana que viene", AT).hint,
    "la semana que viene",
  );
  assert.equal(resolveDate("martes", AT).date, "2026-09-15");
  assert.deepEqual(resolveDate("gracias", AT), {});
});
test("mensaje nuevo guarda interpretación y la anotación de IA no cambia stock ni pedidos", () => {
  let s = apply(seed(), {
    type: "message",
    supplier: "s2",
    text: "No tenemos leche hasta el viernes",
  });
  const m = s.messages[0];
  assert.equal(m.interpretation.category, "out_of_stock");
  assert.equal(m.interpretation.needsReading, true);
  assert.equal(m.priority, "important");
  const before = JSON.stringify([s.products, s.orders]);
  s = apply(s, {
    type: "aiNote",
    id: m.id,
    category: "out_of_stock",
    status: "agreement",
    model: "prueba",
  });
  assert.equal(s.messages[0].aiReading.category, "out_of_stock");
  assert.equal(JSON.stringify([s.products, s.orders]), before);
  assert.throws(() =>
    apply(s, {
      type: "aiNote",
      id: m.id,
      category: "comprar",
      status: "agreement",
      model: "x",
    }),
  );
});
test("receta: valida productos, unidades enteras y producto terminado en kg", () => {
  const base = seed();
  assert.equal(base.recipes.length, 1);
  assert.throws(
    () =>
      apply(base, {
        type: "recipe",
        name: "Mala",
        yield: 1,
        ingredients: [{ product: "p6", quantity: 1.5 }],
      }),
    /enteras/,
  );
  assert.throws(
    () =>
      apply(base, {
        type: "recipe",
        name: "Mala",
        product: "p2",
        yield: 1,
        ingredients: [{ product: "p1", quantity: 0.1 }],
      }),
    /kg/,
  );
  assert.throws(() =>
    apply(base, {
      type: "recipe",
      name: "Mala",
      yield: 1,
      ingredients: [
        { product: "p2", quantity: 1 },
        { product: "p2", quantity: 1 },
      ],
    }),
  );
  const s = apply(base, {
    type: "recipe",
    name: "Gelato de vainilla",
    product: "p5",
    yield: 5,
    ingredients: [
      { product: "p2", quantity: 3 },
      { product: "p6", quantity: 2 },
    ],
  });
  assert.equal(s.recipes.length, 2);
  const edited = apply(s, {
    type: "recipe",
    id: s.recipes[1].id,
    name: "Gelato de vainilla",
    product: "p5",
    yield: 5,
    ingredients: [{ product: "p2", quantity: 2.5 }],
  });
  assert.equal(edited.recipes[1].ingredients.length, 1);
});
test("producción: propuesta escalada, aprobación editable, terminado y descarte", () => {
  let s = apply(seed(), {
    type: "recipe",
    name: "Gelato de vainilla",
    product: "p5",
    yield: 5,
    ingredients: [
      { product: "p2", quantity: 3 },
      { product: "p6", quantity: 2 },
    ],
  });
  const recipe = s.recipes[1].id;
  const milk = () => s.products.find((p) => p.id === "p2").stock;
  const cups = () => s.products.find((p) => p.id === "p6").stock;
  const vanilla = () => s.products.find((p) => p.id === "p5").stock;
  const before = [milk(), cups(), vanilla()];
  s = apply(s, { type: "produce", recipe, quantity: 2, date: "2026-09-08" });
  const p = s.productions[0];
  assert.equal(p.status, "proposed");
  assert.deepEqual(p.lines, [
    { product: "p2", quantity: 1.2 },
    { product: "p6", quantity: 1 },
  ]);
  assert.deepEqual(p.output, { product: "p5", quantity: 2 });
  assert.deepEqual([milk(), cups(), vanilla()], before);
  assert.throws(
    () =>
      apply(s, {
        type: "applyProduction",
        id: p.id,
        lines: [{ product: "p1", quantity: 1 }],
      }),
    /ingredientes/,
  );
  s = apply(s, {
    type: "applyProduction",
    id: p.id,
    lines: [
      { product: "p2", quantity: 1.5 },
      { product: "p6", quantity: 0 },
    ],
    output: 1.8,
    note: "Se usó más leche",
  });
  assert.equal(s.productions[0].status, "applied");
  assert.equal(milk(), before[0] - 1.5);
  assert.equal(cups(), before[1]);
  assert.equal(vanilla(), before[2] + 1.8);
  assert.equal(s.movements.filter((m) => m.production === p.id).length, 2);
  assert.equal(s.movements.find((m) => m.kind === "production").delta, -1.5);
  assert.throws(() =>
    apply(s, { type: "applyProduction", id: p.id, lines: [] }),
  );
  s = apply(s, { type: "produce", recipe, quantity: 1, date: "2026-09-09" });
  s = apply(s, { type: "discardProduction", id: s.productions[0].id });
  assert.equal(s.productions[0].status, "discarded");
  assert.equal(milk(), before[0] - 1.5);
  assert.throws(
    () => apply(s, { type: "deleteRecipe", id: recipe }),
    /trazabilidad/,
  );
  const reversed = apply(s, {
    type: "reverse",
    id: s.movements.find((m) => m.kind === "production").id,
    reason: "Error de cálculo",
  });
  assert.equal(reversed.products.find((x) => x.id === "p2").stock, before[0]);
});
test("producción no deja stock negativo y avisa de mínimos", () => {
  let s = apply(seed(), {
    type: "produce",
    recipe: "r1",
    quantity: 100,
    date: "2026-09-08",
  });
  assert.throws(
    () =>
      apply(s, {
        type: "applyProduction",
        id: s.productions[0].id,
        lines: s.productions[0].lines,
      }),
    /negativo/,
  );
  s = apply(seed(), {
    type: "produce",
    recipe: "r1",
    quantity: 10,
    date: "2026-09-08",
  });
  s = apply(s, {
    type: "applyProduction",
    id: s.productions[0].id,
    lines: s.productions[0].lines,
  });
  assert.match(s.activity[0].text, /mínimo/);
  assert.equal(s.products.find((p) => p.id === "p2").stock, 3);
  assert.equal(
    s.products.find((p) => p.id === "p4").stock,
    seed().products.find((p) => p.id === "p4").stock + 10,
  );
});
test("respuestas rutinarias: el corpus de desarrollo se lee por reglas con la categoría esperada", () => {
  const corpus = require("./fixtures/ai-replies-corpus.json");
  const failures = corpus.filter((x) => {
    const r = interpretReply(x.text, AT);
    return !(x.accept || [x.expected]).includes(r.category);
  });
  assert.deepEqual(
    failures.map((x) => x.id),
    [],
  );
  assert.ok(corpus.length >= 60);
});

test("envío real registra destino, texto y hora en el pedido sin tocar stock", () => {
  const { orderMessage } = require("../src/domain.cjs");
  let s = milkOrder();
  s = apply(s, { type: "cart", product: "p2", packs: 1 });
  s = apply(s, { type: "authorize", revision: s.revision });
  const o = s.orders[0];
  const text = orderMessage(s, o.id);
  assert.match(text, /pedido GS-\d+ de Artello/);
  assert.match(text, /1 × Leche entera \(6 L por presentación, 6 L\)/);
  const stock = s.products.map((p) => p.stock);
  s = apply(s, {
    type: "send",
    order: o.id,
    dispatch: {
      channel: "whatsapp",
      to: "+34910000001",
      messageId: "m1",
      at: new Date().toISOString(),
      text,
    },
  });
  assert.equal(s.orders[0].status, "sent");
  assert.equal(s.orders[0].dispatch.to, "+34910000001");
  assert.match(s.activity[0].text, /ENVIADO por WhatsApp/);
  assert.deepEqual(
    s.products.map((p) => p.stock),
    stock,
  );
  assert.throws(() => apply(s, { type: "send", order: o.id }));
});

test("una respuesta de WhatsApp al número del pedido enviado se vincula sola y fija la entrega prevista", () => {
  let s = apply(seed(), { type: "cart", product: "p2", packs: 1 });
  s = apply(s, { type: "authorize", revision: s.revision });
  const o = s.orders[0];
  s = apply(s, {
    type: "send",
    order: o.id,
    dispatch: {
      channel: "whatsapp",
      to: "+34910000001",
      messageId: "m1",
      at: new Date().toISOString(),
      text: "Pedido",
    },
  });
  s = apply(s, {
    type: "message",
    supplier: o.supplier,
    text: "Ok, te llega el lunes",
    eventId: "wa-1",
    channel: "whatsapp",
    sender: "+34910000001",
  });
  const m = s.messages[0];
  assert.equal(m.channel, "whatsapp");
  assert.equal(m.simulated, false);
  assert.equal(m.order, o.id);
  assert.equal(m.relevance, "relevant");
  assert.ok(s.orders[0].expected);
  assert.match(s.activity[0].text, /WhatsApp/);
  // another number, or a second open order to the same number: no automatic link
  const other = apply(s, {
    type: "message",
    supplier: o.supplier,
    text: "Hola",
    channel: "whatsapp",
    sender: "+34999999999",
  });
  assert.equal(other.messages[0].order, undefined);
  assert.equal(
    apply(seed(), { type: "message", supplier: "s1", text: "hola" }).messages[0]
      .simulated,
    true,
  );
});

test("el tipo de documento de una foto lo confirma la persona y se puede retirar", () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  let s = apply(seed(), { type: "photo", name: "f.png", data: png });
  const id = s.photos[0].id;
  s = apply(s, { type: "photoType", id, docType: "factura" });
  assert.equal(s.photos[0].docType, "factura");
  assert.match(s.activity[0].text, /confirmado por la persona/);
  assert.throws(() => apply(s, { type: "photoType", id, docType: "comprar" }));
  s = apply(s, { type: "photoType", id });
  assert.equal(s.photos[0].docType, undefined);
});

test("ventas y mermas del día crean salidas trazables de producto terminado y avisan de mínimos", () => {
  const before = seed().products.find((p) => p.id === "p4").stock;
  let s = apply(seed(), {
    type: "dailySales",
    date: "2026-09-08",
    lines: [
      { product: "p4", sold: 1.5, waste: 0.25 },
      { product: "p5", sold: 0, waste: 0 },
    ],
  });
  assert.equal(s.products.find((p) => p.id === "p4").stock, before - 1.75);
  assert.equal(
    s.movements.filter((m) => /del día 2026-09-08/.test(m.reason)).length,
    2,
  );
  assert.equal(s.movements.find((m) => m.kind === "waste").delta, -0.25);
  assert.match(s.activity[0].text, /Ventas y mermas/);
  assert.throws(
    () =>
      apply(seed(), {
        type: "dailySales",
        date: "2026-09-08",
        lines: [{ product: "p4", sold: 0, waste: 0 }],
      }),
    /al menos/,
  );
  assert.throws(
    () =>
      apply(seed(), {
        type: "dailySales",
        date: "2026-09-08",
        lines: [{ product: "p4", sold: 999, waste: 0 }],
      }),
    /más que el stock/,
  );
  assert.throws(
    () =>
      apply(seed(), {
        type: "dailySales",
        date: "2026-09-08",
        lines: [
          { product: "p4", sold: 1, waste: 0 },
          { product: "p4", sold: 1, waste: 0 },
        ],
      }),
    /repetidos/,
  );
});

test("limpieza de actividad conserva las entradas recientes y nunca toca movimientos", () => {
  let s = seed();
  for (let i = 0; i < 60; i++)
    s = apply(s, { type: "count", product: "p1", value: i % 5 });
  const old = "2000-01-01T00:00:00.000Z";
  s.activity = s.activity.map((a, i) => (i >= 55 ? { ...a, at: old } : a));
  const movements = s.movements.length;
  const purged = apply(s, {
    type: "purge",
    before: "2020-01-01T00:00:00.000Z",
    keep: 50,
  });
  assert.equal(purged.activity.filter((a) => a.at === old).length, 0);
  assert.equal(purged.movements.length, movements);
  assert.match(purged.activity[0].text, /Limpieza: eliminadas 6 entradas/);
  const keepAll = apply(s, {
    type: "purge",
    before: "2020-01-01T00:00:00.000Z",
    keep: 100,
  });
  assert.equal(keepAll.activity.filter((a) => a.at === old).length, 6);
});

test("escenarios ampliados: cierre, pago, documento, tipografía y horas se leen por reglas", () => {
  const corpus = require("./fixtures/ai-replies-corpus-2.json");
  const failures = corpus.filter((x) => {
    const r = interpretReply(x.text, "2026-09-09T10:00:00.000Z");
    return !(x.accept || [x.expected]).includes(r.category);
  });
  assert.deepEqual(
    failures.map((x) => x.id),
    [],
  );
  assert.equal(
    resolveDate("te lo dejo el 3 de octubre", "2026-09-09T10:00:00Z").date,
    "2026-10-03",
  );
  assert.equal(
    resolveDate("mñn te llega", "2026-09-09T10:00:00Z").date,
    "2026-09-10",
  );
  assert.equal(
    resolveDate("antes de las 12", "2026-09-09T10:00:00Z").hint,
    "antes de las 12",
  );
  const promo = interpretReply(
    "Oferta: 2x1 en tarrinas hasta el domingo",
    "2026-09-09T10:00:00Z",
  );
  assert.equal(promo.category, "other");
  assert.equal(promo.needsReading, false);
});
test("corregir una lectura la recuerda y se aplica a mensajes iguales o casi iguales", () => {
  let s = apply(seed(), {
    type: "message",
    supplier: "s2",
    text: "Estamos de balance, no servimos hasta el lunes",
  });
  const id = s.messages[0].id;
  s = apply(s, { type: "correctReading", id, category: "closed" });
  assert.equal(s.messages[0].interpretation.category, "closed");
  assert.equal(s.messages[0].interpretation.corrected, true);
  assert.equal(s.learned.length, 1);
  assert.match(s.activity[0].text, /Lectura corregida/);
  s = apply(s, {
    type: "message",
    supplier: "s2",
    text: "Estamos de balance, no servimos hasta el LUNES!!",
  });
  assert.equal(s.messages[0].interpretation.category, "closed");
  assert.equal(s.messages[0].interpretation.learned, true);
  assert.match(s.messages[0].interpretation.summary, /Aprendido/);
  s = apply(s, {
    type: "message",
    supplier: "s2",
    text: "Mañana os llega todo",
  });
  assert.equal(s.messages[0].interpretation.category, "delivery_date");
  s = apply(s, { type: "forgetLearned", id: s.learned[0].id });
  assert.equal(s.learned.length, 0);
  s = apply(s, {
    type: "message",
    supplier: "s2",
    text: "Estamos de balance, no servimos hasta el lunes",
  });
  assert.notEqual(s.messages[0].interpretation.learned, true);
  const noRemember = apply(seed(), {
    type: "message",
    supplier: "s2",
    text: "Vale",
  });
  const done = apply(noRemember, {
    type: "correctReading",
    id: noRemember.messages[0].id,
    category: "question",
    remember: false,
  });
  assert.equal(done.learned.length, 0);
  assert.equal(done.messages[0].interpretation.needsReading, true);
});

test("la identidad del negocio se edita y aparece en el texto de los pedidos", () => {
  const { orderMessage } = require("../src/domain.cjs");
  let s = apply(seed(), {
    type: "business",
    name: "Heladería Prueba",
    place: "Palma",
  });
  assert.equal(s.business, "Heladería Prueba");
  assert.equal(s.place, "Palma");
  s = apply(s, { type: "cart", product: "p2", packs: 1 });
  s = apply(s, { type: "authorize", revision: s.revision });
  assert.match(orderMessage(s, s.orders[0].id), /de Heladería Prueba/);
  assert.throws(() => apply(s, { type: "business", name: "", place: "" }));
});

test("documentos: propuesta por número de pedido, por único pedido o por importe; vínculo confirmado por la persona", () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  let s = milkOrder();
  const order = s.orders[0];
  s = apply(s, {
    type: "photo",
    name: "f1.png",
    data: png,
    ocrText: "FACTURA F-9\nPedido " + order.number + "\nTotal: 999,00 EUR",
  });
  let doc = s.photos[0];
  assert.equal(doc.suggestion.order, order.id);
  assert.equal(doc.suggestion.supplier, order.supplier);
  assert.equal(doc.suggestion.docType, "factura");
  s = apply(s, { type: "applySuggestion", id: doc.id });
  doc = s.photos[0];
  assert.equal(doc.order, order.id);
  assert.equal(doc.docType, "factura");
  assert.equal(doc.suggestion, undefined);
  s = apply(s, {
    type: "photo",
    name: "f2.png",
    data: png,
    supplier: order.supplier,
    documentDate: new Date().toISOString().slice(0, 10),
  });
  assert.equal(s.photos[0].suggestion.order, order.id);
  assert.match(s.photos[0].suggestion.reason, /Único pedido/);
  const total = (order.lines.reduce((n, l) => n + l.packs * l.price, 0) / 100)
    .toFixed(2)
    .replace(".", ",");
  s = apply(s, { type: "cart", product: "p2", packs: 3 });
  s = apply(s, { type: "authorize", revision: s.revision });
  s = apply(s, { type: "send", order: s.orders[0].id });
  s = apply(s, {
    type: "photo",
    name: "f3.png",
    data: png,
    supplier: order.supplier,
    ocrText: "FACTURA\nTotal: " + total + " EUR",
  });
  assert.equal(s.photos[0].suggestion.order, order.id);
  assert.match(s.photos[0].suggestion.reason, /importe/);
  assert.throws(() =>
    apply(s, {
      type: "linkDocument",
      id: s.photos[0].id,
      order:
        apply(seed(), { type: "cart", product: "p1", packs: 1 }).orders[0]
          ?.id || "nope",
    }),
  );
  const other = s.orders.find((o) => o.supplier !== order.supplier);
  if (other)
    assert.throws(
      () =>
        apply(s, { type: "linkDocument", id: s.photos[0].id, order: other.id }),
      /otro proveedor/,
    );
  s = apply(s, { type: "linkDocument", id: s.photos[0].id, order: order.id });
  assert.equal(s.photos[0].order, order.id);
  s = apply(s, { type: "linkDocument", id: s.photos[0].id });
  assert.equal(s.photos[0].order, undefined);
});
test("un PDF se guarda como documento y se acepta como origen WhatsApp", () => {
  const pdf =
    "data:application/pdf;base64," +
    Buffer.from("%PDF-1.4\n%fake\n").toString("base64");
  const s = apply(seed(), {
    type: "photo",
    name: "albaran.pdf",
    data: pdf,
    supplier: "s2",
    source: "whatsapp",
    documentDate: "2026-09-09",
  });
  assert.equal(s.photos[0].source, "whatsapp");
  assert.equal(s.photos[0].name, "albaran.pdf");
  assert.match(s.activity[0].text, /WhatsApp/);
});

test("decidir sobre un mensaje lo cierra con la decisión anotada, sin tocar pedidos ni stock", () => {
  let s = apply(seed(), {
    type: "message",
    supplier: "s2",
    text: "No tenemos nata hasta el lunes",
  });
  const before = JSON.stringify([s.products, s.orders]);
  s = apply(s, {
    type: "decide",
    id: s.messages[0].id,
    decision: "La compro en Makro esta tarde",
  });
  assert.equal(s.messages[0].reviewed, true);
  assert.equal(s.messages[0].read, true);
  assert.equal(s.messages[0].decision, "La compro en Makro esta tarde");
  assert.ok(s.messages[0].decidedAt);
  assert.match(s.activity[0].text, /Decisión sobre un mensaje/);
  assert.equal(JSON.stringify([s.products, s.orders]), before);
  assert.throws(() =>
    apply(s, { type: "decide", id: s.messages[0].id, decision: "" }),
  );
});

test("proveedor: la web de compra solo admite direcciones https completas", () => {
  const base = {
    type: "supplier",
    name: "Makro Palma",
    initials: "MK",
    category: "Mayorista",
    delivery: "Recogida",
    color: "sand",
  };
  assert.throws(
    () => apply(seed(), { ...base, web: "http://www.makro.es" }),
    /https/,
  );
  assert.throws(() => apply(seed(), { ...base, web: "makro.es" }), /https/);
  const s = apply(seed(), { ...base, web: "https://www.makro.es/" });
  assert.equal(s.suppliers.at(-1).web, "https://www.makro.es/");
  assert.equal(apply(seed(), { ...base, web: "" }).suppliers.at(-1).web, "");
});

test("recetario: familia, elaboración y alérgenos se guardan; la familia por defecto es crema", () => {
  let s = apply(seed(), {
    type: "recipe",
    name: "Sorbete de limón",
    family: "sorbete",
    yield: 2,
    ingredients: [{ product: "p2", quantity: 0.5 }],
    steps: "Mezclar y mantecar.",
    allergens: "Ninguno",
    note: "",
  });
  const r = s.recipes.at(-1);
  assert.equal(r.family, "sorbete");
  assert.equal(r.steps, "Mezclar y mantecar.");
  assert.equal(r.allergens, "Ninguno");
  s = apply(s, {
    type: "recipe",
    name: "Sin familia",
    yield: 1,
    ingredients: [{ product: "p2", quantity: 0.5 }],
  });
  assert.equal(s.recipes.at(-1).family, "crema");
  assert.equal(s.recipes.at(-1).steps, "");
  assert.throws(() =>
    apply(s, {
      type: "recipe",
      name: "Mal",
      family: "helado",
      yield: 1,
      ingredients: [{ product: "p2", quantity: 0.5 }],
    }),
  );
});

test("fechas locales: «mañana» se resuelve con el día del calendario local, no UTC", () => {
  const { resolveDate, localDate } = require("../src/domain.cjs");
  // 23:30 UTC: en Palma ya es el día siguiente; la lectura debe partir del día local.
  const at = "2026-09-08T23:30:00.000Z";
  const local = new Date(at);
  const tomorrow = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + 1,
  );
  assert.equal(resolveDate("llega mañana", at)?.date, localDate(tomorrow));
  assert.equal(localDate(new Date(2026, 0, 5, 0, 30)), "2026-01-05");
});

test("balance técnico: porcentajes sobre la masa, rangos por familia y fichas que faltan", () => {
  const { recipeBalance } = require("../src/domain.cjs");
  const s = seed();
  const r = s.recipes[0]; // 0,5 L leche + 0,2 L nata por kg
  const b = recipeBalance(s, r);
  assert.equal(b.mass, 0.7);
  assert.equal(b.complete, true);
  // leche 4,8/3,6/12,5/8,9 · nata 3/35/41/6 → (0,5·x + 0,2·y)/0,7
  assert.equal(
    b.values.fat,
    Math.round(((0.5 * 3.6 + 0.2 * 35) / 0.7) * 10) / 10,
  );
  assert.equal(
    b.values.sugars,
    Math.round(((0.5 * 4.8 + 0.2 * 3) / 0.7) * 10) / 10,
  );
  assert.equal(b.flags.find((f) => f.key === "fat").status, "high");
  assert.equal(b.flags.find((f) => f.key === "sugars").status, "low");
  const s2 = apply(s, {
    type: "editProduct",
    product: "p2",
    name: "Leche entera",
    detail: "",
    min: 1,
    target: 2,
    pack: 6,
    price: 690,
    supplier: "s2",
    composition: {},
  });
  assert.equal(s2.products.find((p) => p.id === "p2").composition, undefined);
  const b2 = recipeBalance(s2, s2.recipes[0]);
  assert.equal(b2.complete, false);
  assert.deepEqual(b2.missing, ["Leche entera"]);
  assert.equal(b2.flags[0].status, "unknown");
  assert.throws(() =>
    apply(s, {
      type: "editProduct",
      product: "p2",
      name: "Leche",
      detail: "",
      min: 1,
      target: 2,
      pack: 6,
      price: 690,
      supplier: "s2",
      composition: { fat: 150 },
    }),
  );
});
test("resumen semanal: ventas, mermas, producción, pedidos y avisos de la semana local", () => {
  const { weeklyReport, weekStart, localDate } = require("../src/domain.cjs");
  const today = localDate(new Date());
  const start = weekStart(new Date());
  let s = apply(seed(), { type: "cart", product: "p2", packs: 1 });
  s = apply(s, { type: "authorize", revision: s.revision });
  s = apply(s, {
    type: "dailySales",
    date: today,
    lines: [{ product: "p4", sold: 1, waste: 0.5 }],
  });
  s = apply(s, {
    type: "movement",
    product: "p2",
    kind: "waste",
    value: 0.25,
    reason: "caducada",
  });
  const r = weeklyReport(s, start);
  assert.equal(r.start, start);
  assert.ok(r.days.some((d) => d.date === today));
  assert.equal(r.totals.sales, 1);
  assert.equal(r.totals.waste, 0.75);
  assert.equal(r.sales[0].name, "Chocolate 70 %");
  assert.equal(r.orders.created, 1);
  assert.ok(r.orders.spent > 0);
  assert.equal(r.production.length, 0);
  assert.ok(r.totals.movements >= 3);
  const empty = weeklyReport(s, "2020-01-06");
  assert.equal(empty.totals.sales, 0);
  assert.equal(empty.orders.created, 0);
  assert.equal(empty.days.length, 7);
});

test("historial de precios: editar el precio deja rastro y avisa de subidas recientes", () => {
  const { priceAlerts } = require("../src/domain.cjs");
  const base = {
    type: "editProduct",
    product: "p2",
    name: "Leche entera",
    detail: "",
    min: 12,
    target: 30,
    pack: 6,
    supplier: "s2",
  };
  let s = apply(seed(), { ...base, price: 690 });
  assert.equal(s.prices.length, 0);
  s = apply(s, { ...base, price: 760 });
  assert.equal(s.prices.length, 1);
  assert.equal(s.prices[0].from, 690);
  assert.equal(s.prices[0].to, 760);
  const alerts = priceAlerts(s, 30);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].name, "Leche entera");
  assert.equal(alerts[0].pct, 10.1);
  s = apply(s, { ...base, price: 700 });
  assert.equal(priceAlerts(s, 30).length, 0);
  assert.equal(s.prices.length, 2);
});
test("conteo por zonas: la hoja ajusta el stock, deja conteos y el recordatorio sabe qué zona toca", () => {
  const { countStatus } = require("../src/domain.cjs");
  let s = seed();
  const before = countStatus(s, 7);
  assert.ok(before.every((z) => z.due && z.lastCount === null));
  s = apply(s, {
    type: "editProduct",
    product: "p2",
    name: "Leche entera",
    detail: "",
    min: 12,
    target: 30,
    pack: 6,
    price: 690,
    supplier: "s2",
    zone: "camara",
  });
  s = apply(s, {
    type: "editProduct",
    product: "p10",
    name: "Nata para montar",
    detail: "",
    min: 4,
    target: 12,
    pack: 1,
    price: 320,
    supplier: "s2",
    zone: "camara",
  });
  const stockNata = s.products.find((p) => p.id === "p10").stock;
  // The demo already places p7 and p8 in the cold room: they are counted as they stand.
  const others = s.products
    .filter(
      (p) =>
        (p.zone || "almacen") === "camara" && !["p2", "p10"].includes(p.id),
    )
    .map((p) => ({ product: p.id, value: p.stock }));
  s = apply(s, {
    type: "countSheet",
    zone: "camara",
    lines: [
      { product: "p2", value: 5 },
      { product: "p10", value: stockNata },
      ...others,
    ],
  });
  assert.equal(s.products.find((p) => p.id === "p2").stock, 5);
  const counts = s.movements.filter((m) => m.kind === "count");
  assert.equal(counts.length, 2 + others.length);
  assert.ok(counts.every((m) => /Conteo de Cámara/.test(m.reason)));
  assert.match(
    s.activity[0].text,
    new RegExp(2 + others.length + " productos revisados, 1 con diferencia"),
  );
  const camara = countStatus(s, 7).find((z) => z.zone === "camara");
  assert.equal(camara.due, false);
  assert.equal(camara.products, 2 + others.length);
  assert.equal(camara.ageDays, 0);
  // Ten days later the zone is due again; with the reminder off, nothing is due.
  for (const m of s.movements)
    if (m.kind === "count")
      m.at = new Date(Date.now() - 10 * 86400000).toISOString();
  assert.equal(countStatus(s, 7).find((z) => z.zone === "camara").due, true);
  assert.ok(countStatus(s, 0).every((z) => !z.due));
  assert.throws(() =>
    apply(s, {
      type: "countSheet",
      zone: "camara",
      lines: [
        { product: "p2", value: 1 },
        { product: "p2", value: 2 },
      ],
    }),
  );
});

test("respuestas vinculadas: confirmación y fecha marcan el pedido; acciones desde el mensaje", () => {
  const {
    orderReminders,
    renderOrderTemplate,
    defaultOrderTemplate,
  } = require("../src/domain.cjs");
  let s = apply(seed(), {
    type: "supplier",
    id: "s2",
    name: "Fresco Mercado",
    initials: "FM",
    category: "x",
    delivery: "x",
    color: "sage",
    whatsapp: "+34910000001",
  });
  s = apply(s, { type: "cart", product: "p2", packs: 1 });
  s = apply(s, { type: "cart", product: "p10", packs: 1 });
  s = apply(s, { type: "authorize", revision: s.revision });
  const o = s.orders.find((x) => x.status === "pending");
  s = apply(s, {
    type: "send",
    order: o.id,
    dispatch: {
      channel: "whatsapp",
      to: "+34910000001",
      messageId: "m1",
      at: new Date().toISOString(),
      text: "x",
    },
  });
  assert.equal(s.orders[0].confirmedAt, undefined);
  s = apply(s, {
    type: "message",
    supplier: "s2",
    text: "Ok perfecto, os lo llevamos el lunes",
    channel: "whatsapp",
    sender: "+34910000001",
  });
  const sent = s.orders.find((x) => x.id === o.id);
  assert.equal(s.messages[0].order, o.id);
  assert.ok(sent.confirmedAt);
  assert.ok(sent.expected);
  // Out of stock: the product leaves the order by an explicit action; the other line stays.
  s = apply(s, { type: "removeLine", order: o.id, product: "p10" });
  assert.equal(s.orders.find((x) => x.id === o.id).lines.length, 1);
  assert.throws(
    () => apply(s, { type: "removeLine", order: o.id, product: "p2" }),
    /único producto/,
  );
  s = apply(s, { type: "setExpected", order: o.id, date: "2030-01-15" });
  assert.equal(s.orders.find((x) => x.id === o.id).expected, "2030-01-15");
  // Reminders: an old pending order, an unanswered sent order and an overdue one.
  let r = apply(seed(), { type: "cart", product: "p1", packs: 1 });
  r = apply(r, { type: "authorize", revision: r.revision });
  r.orders[0].at = new Date(Date.now() - 2 * 86400000).toISOString();
  const rem = orderReminders(r);
  assert.equal(rem.length, 1);
  assert.equal(rem[0].kind, "unsent");
  r.orders[0].status = "sent";
  r.orders[0].dispatch = {
    channel: "whatsapp",
    to: "+34600000000",
    messageId: "x",
    at: new Date(Date.now() - 2 * 86400000).toISOString(),
    text: "x",
  };
  assert.equal(orderReminders(r)[0].kind, "unanswered");
  r.orders[0].expected = "2020-01-01";
  assert.equal(orderReminders(r)[0].kind, "overdue");
  r.orders[0].expected = undefined;
  r.orders[0].confirmedAt = new Date().toISOString();
  assert.equal(orderReminders(r).length, 0);
  // Template rendering keeps the default when {lineas} is missing.
  assert.match(
    renderOrderTemplate("Buenas, {proveedor}:\n{lineas}\nGracias, {negocio}", {
      numero: "GS-1",
      negocio: "Artello",
      lineas: "- 1 × Leche",
      proveedor: "Fresco",
    }),
    /^Buenas, Fresco:\n- 1 × Leche\nGracias, Artello$/,
  );
  assert.equal(
    renderOrderTemplate("sin marcador", {
      numero: "GS-1",
      negocio: "A",
      lineas: "L",
      proveedor: "P",
    }),
    renderOrderTemplate(defaultOrderTemplate, {
      numero: "GS-1",
      negocio: "A",
      lineas: "L",
      proveedor: "P",
    }),
  );
});

// Otro proveedor para el mismo producto: lo escribe la persona y solo se usa si lo elige.
test("otro proveedor: se apunta con su formato y su precio, y no cambia la ficha", () => {
  let s = apply(seed(), {
    type: "setAlternate",
    product: "p2",
    supplier: "s3",
    pack: 12,
    price: 1290,
  });
  const p = s.products.find((x) => x.id === "p2");
  assert.deepEqual(p.alternates, [{ supplier: "s3", pack: 12, price: 1290 }]);
  assert.equal(p.supplier, "s2");
  assert.equal(p.pack, 6);
  assert.equal(p.price, 690);
  // Repetir el mismo proveedor actualiza su línea, no la duplica.
  s = apply(s, {
    type: "setAlternate",
    product: "p2",
    supplier: "s3",
    pack: 10,
    price: 1100,
  });
  assert.deepEqual(s.products.find((x) => x.id === "p2").alternates, [
    { supplier: "s3", pack: 10, price: 1100 },
  ]);
  assert.throws(
    () =>
      apply(s, {
        type: "setAlternate",
        product: "p2",
        supplier: "s2",
        pack: 1,
        price: 100,
      }),
    /proveedor habitual/,
  );
});
test("el carrito compra a quien se elija y el pedido va a ese proveedor", () => {
  let s = apply(seed(), {
    type: "setAlternate",
    product: "p2",
    supplier: "s3",
    pack: 12,
    price: 1290,
  });
  s = apply(s, { type: "cart", product: "p2", packs: 2, supplier: "s3" });
  assert.equal(s.cart[0].supplier, "s3");
  // Cambiar la cantidad sin decir proveedor conserva la elección.
  s = apply(s, { type: "cart", product: "p2", packs: 3 });
  assert.equal(s.cart[0].supplier, "s3");
  s = apply(s, { type: "authorize", revision: s.revision });
  const o = s.orders[0];
  assert.equal(o.supplier, "s3");
  assert.deepEqual(o.lines, [
    { product: "p2", packs: 3, pack: 12, price: 1290, received: 0 },
  ]);
  // El producto sigue siendo del proveedor de siempre.
  assert.equal(s.products.find((x) => x.id === "p2").supplier, "s2");
});
test("volver al proveedor habitual y quitar la alternativa deja el carrito limpio", () => {
  let s = apply(seed(), {
    type: "setAlternate",
    product: "p2",
    supplier: "s3",
    pack: 12,
    price: 1290,
  });
  s = apply(s, { type: "cart", product: "p2", packs: 1, supplier: "s3" });
  s = apply(s, { type: "cart", product: "p2", packs: 1, supplier: "s2" });
  assert.equal(s.cart[0].supplier, undefined);
  s = apply(s, { type: "cart", product: "p2", packs: 1, supplier: "s3" });
  s = apply(s, { type: "removeAlternate", product: "p2", supplier: "s3" });
  assert.equal(s.cart[0].supplier, undefined);
  assert.deepEqual(s.products.find((x) => x.id === "p2").alternates, []);
  assert.throws(
    () => apply(s, { type: "cart", product: "p2", packs: 1, supplier: "s3" }),
    /no está apuntado/,
  );
});

// Reclamar respuesta: deja rastro, no cambia el pedido y solo una vez al día.
function whatsappOrder() {
  let s = apply(seed(), { type: "cart", product: "p2", packs: 2 });
  s = apply(s, { type: "authorize", revision: s.revision });
  return {
    id: s.orders[0].id,
    pending: s,
    sent: apply(s, {
      type: "send",
      order: s.orders[0].id,
      dispatch: {
        channel: "whatsapp",
        to: "+34910000001",
        messageId: "m-1",
        at: "2026-09-18T09:00:00.000Z",
        text: "Pedido",
      },
    }),
  };
}
test("un recordatorio deja rastro sin tocar el pedido y no se repite el mismo día", () => {
  const base = whatsappOrder();
  const id = base.id;
  let s = base.pending;
  const dispatch = (at) => ({
    channel: "whatsapp",
    to: "+34910000001",
    messageId: "n-" + at,
    at,
    text: "¿Nos confirmáis el pedido?",
  });
  // Sin envío real por WhatsApp no hay nada que reclamar, aunque el pedido figure enviado.
  const simulado = milkOrder();
  assert.throws(
    () =>
      apply(simulado, {
        type: "nudge",
        order: simulado.orders[0].id,
        dispatch: dispatch("2026-09-20T10:00:00.000Z"),
      }),
    /no se envió por WhatsApp/,
  );
  assert.throws(
    () =>
      apply(s, {
        type: "nudge",
        order: id,
        dispatch: dispatch("2026-09-20T10:00:00.000Z"),
      }),
    /enviado y todavía en curso/,
  );
  s = base.sent;
  const before = JSON.stringify(s.orders[0].lines);
  s = apply(s, {
    type: "nudge",
    order: id,
    dispatch: dispatch("2026-09-20T10:00:00.000Z"),
  });
  assert.equal(s.orders[0].nudges.length, 1);
  assert.equal(s.orders[0].status, "sent");
  assert.equal(s.orders[0].confirmedAt, undefined);
  assert.equal(JSON.stringify(s.orders[0].lines), before);
  assert.match(s.activity[0].text, /Recordatorio/);
  assert.throws(
    () =>
      apply(s, {
        type: "nudge",
        order: id,
        dispatch: dispatch("2026-09-20T18:30:00.000Z"),
      }),
    /hoy/,
  );
  const next = apply(s, {
    type: "nudge",
    order: id,
    dispatch: dispatch("2026-09-21T09:00:00.000Z"),
  });
  assert.equal(next.orders[0].nudges.length, 2);
  // Un pedido confirmado ya no se reclama.
  const done = apply(s, { type: "confirmOrder", order: id });
  assert.throws(
    () =>
      apply(done, {
        type: "nudge",
        order: id,
        dispatch: dispatch("2026-09-22T09:00:00.000Z"),
      }),
    /ya confirmó/,
  );
});
test("el texto del recordatorio sale de la plantilla y dice cuántos días lleva", () => {
  const s = whatsappOrder().sent;
  const at = Date.parse("2026-09-21T09:00:00.000Z");
  const text = nudgeMessage(s, s.orders[0].id, undefined, at);
  assert.match(text, /GS-001/);
  assert.match(text, /3 días/);
  assert.match(text, /Artello/);
  assert.equal(
    daysSinceDispatch(s, s.orders[0].id, Date.parse("2026-09-19T09:00:00.000Z"))
      .text,
    "1 día",
  );
  // Una plantilla sin {numero} no se usa: el proveedor no sabría de qué pedido hablamos.
  assert.equal(
    renderNudgeTemplate("Hola, ¿alguna novedad?", {
      numero: "GS-001",
      negocio: "Artello",
      proveedor: "Fresco Mercado",
      dias: "3 días",
    }),
    nudgeMessage(s, s.orders[0].id, undefined, at),
  );
});
