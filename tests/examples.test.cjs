const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  seed,
  emptyState,
  apply,
  validate,
  examplesPlan,
} = require("../src/domain.cjs");
const { Store } = require("../build/store.js");

// Un pedido de práctica (sin WhatsApp) de un producto, enviado con «Ya lo pedí por otro medio».
function practiceOrder(s, product) {
  s = apply(s, { type: "cart", product, packs: 1 });
  s = apply(s, { type: "authorize", revision: s.revision });
  return apply(s, { type: "send", order: s.orders[0].id });
}

test("ejemplo: sin uso propio se quita todo lo de ejemplo y no se puede repetir", () => {
  let s = practiceOrder(seed(), "p3");
  const plan = examplesPlan(s);
  assert.equal(plan.products.length, 10);
  assert.equal(plan.suppliers.length, 4);
  assert.deepEqual(
    plan.recipes.map((r) => r.id),
    ["r1"],
  );
  assert.equal(plan.orders.length, 1);
  assert.equal(plan.messages, 1);
  assert.deepEqual(plan.kept, []);
  s = apply(s, { type: "removeExamples" });
  assert.equal(s.demo, false);
  for (const list of ["products", "suppliers", "orders", "messages", "recipes"])
    assert.equal(s[list].length, 0, list);
  assert.equal(s.movements.length, 0);
  assert.match(s.activity[0].text, /Datos de ejemplo quitados: 10 productos/);
  assert.throws(() => apply(s, { type: "removeExamples" }), /ya se quitaron/);
  // Lo que queda sigue siendo un estado válido.
  validate(JSON.parse(JSON.stringify(s)));
});

test("ejemplo: lo que se usa se queda con su stock; un pedido enviado por WhatsApp también", () => {
  let s = seed();
  // Receta propia con Leche entera (p2); la receta de ejemplo r1 se va igualmente.
  s = apply(s, {
    type: "recipe",
    name: "Fior di latte",
    family: "crema",
    yield: 1,
    ingredients: [{ product: "p2", quantity: 0.6 }],
  });
  // Conteo a mano de Vasos (p6): movimiento propio.
  s = apply(s, { type: "count", product: "p6", value: 40 });
  // Pedido de práctica de Café (p1) con recepción: el café se va con su movimiento.
  s = practiceOrder(s, "p1");
  s = apply(s, {
    type: "receive",
    order: s.orders[0].id,
    lines: [{ product: "p1", value: 1 }],
  });
  // Pedido de práctica de Leche (p2) recibido: la leche se queda y su movimiento pierde el enlace.
  s = practiceOrder(s, "p2");
  const milkOrder = s.orders[0].id;
  s = apply(s, {
    type: "receive",
    order: milkOrder,
    lines: [{ product: "p2", value: 6 }],
  });
  const milkStock = s.products.find((p) => p.id === "p2").stock;
  // Un pedido de Pistacho (p3) que sí salió por WhatsApp: no es práctica.
  s = practiceOrder(s, "p3");
  const sent = JSON.parse(JSON.stringify(s));
  sent.orders[0].dispatch = {
    channel: "whatsapp",
    to: "+34600000000",
    messageId: "m1",
    at: new Date().toISOString(),
    text: "Pedido",
  };
  s = validate(sent);
  const plan = examplesPlan(s);
  assert.deepEqual(plan.kept.map((k) => [k.id, k.why]).sort(), [
    ["p2", "está en la receta Fior di latte"],
    ["p3", `está en el pedido ${s.orders[0].number}, enviado por WhatsApp`],
    ["p6", "tiene movimientos de stock apuntados a mano"],
  ]);
  assert.equal(plan.orders.length, 2);
  s = apply(s, { type: "removeExamples" });
  assert.deepEqual(s.products.map((p) => p.id).sort(), ["p2", "p3", "p6"]);
  // Proveedores: Fresco Mercado (p2), Gelato Italia (p3) y EcoPack (p6); Origen Coffee se va.
  assert.deepEqual(s.suppliers.map((x) => x.id).sort(), ["s2", "s3", "s4"]);
  const milk = s.products.find((p) => p.id === "p2");
  assert.equal(milk.stock, milkStock);
  assert.equal(milk.composition, undefined, "composición de ejemplo quitada");
  const receipt = s.movements.find(
    (m) => m.product === "p2" && m.kind === "receipt",
  );
  assert.ok(receipt && receipt.order === undefined);
  assert.equal(s.orders.length, 1);
  assert.ok(s.orders[0].dispatch);
  assert.equal(
    s.movements.filter((m) => m.product === "p1").length,
    0,
    "el café de ejemplo se va con su historia",
  );
  assert.equal(s.recipes.length, 1);
});

test("ejemplo: una composición cambiada por la persona no se toca", () => {
  let s = seed();
  s = apply(s, {
    type: "recipe",
    name: "Avena",
    family: "crema",
    yield: 1,
    ingredients: [{ product: "p7", quantity: 1 }],
  });
  const p7 = s.products.find((p) => p.id === "p7");
  s = apply(s, {
    type: "editProduct",
    product: "p7",
    name: p7.name,
    detail: p7.detail,
    min: p7.min,
    target: p7.target,
    pack: p7.pack,
    price: p7.price,
    supplier: p7.supplier,
    composition: { ...p7.composition, fat: 2 },
  });
  s = apply(s, { type: "removeExamples" });
  assert.equal(s.products.find((p) => p.id === "p7").composition.fat, 2);
});

test("instalación nueva: empieza vacía, sin ejemplo, y admite el primer proveedor y producto", () => {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "vacio-test-"));
  const store = new Store(dir, { start: emptyState });
  try {
    let s = store.load();
    assert.equal(s.demo, false);
    for (const list of [
      "products",
      "suppliers",
      "orders",
      "messages",
      "recipes",
    ])
      assert.equal(s[list].length, 0, list);
    assert.equal(examplesPlan(s).products.length, 0);
    assert.throws(
      () => store.dispatch({ type: "removeExamples" }),
      /ya se quitaron/,
    );
    s = store.dispatch({
      type: "supplier",
      name: "Lácteos Sóller",
      initials: "LS",
      category: "Lácteos",
      delivery: "Lunes",
      color: "sage",
    });
    s = store.dispatch({
      type: "product",
      name: "Leche fresca",
      detail: "Garrafa de 5 L",
      category: "Gelatería",
      unit: "L",
      stock: 0,
      min: 5,
      target: 20,
      pack: 5,
      price: 450,
      supplier: s.suppliers[0].id,
      icon: "milk",
    });
    assert.equal(s.products.length, 1);
  } finally {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
