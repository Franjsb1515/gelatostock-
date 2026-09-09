const test = require("node:test");
const assert = require("node:assert/strict");
const {
  seed,
  apply,
  validate,
  pending,
  needed,
  classify,
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
    /negativo/,
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
