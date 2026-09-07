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
