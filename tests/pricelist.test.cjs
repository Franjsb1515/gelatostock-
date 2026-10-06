const test = require("node:test");
const assert = require("node:assert/strict");
const {
  apply,
  seed,
  parsePriceList,
  priceReadingSummary,
  priceGroups,
  priceKey,
  supplierCatalog,
} = require("../build/domain.js");

// Tabla inventada con la forma de una lista real: ingrediente a la izquierda, proveedor en el
// centro y coste a la derecha (los importes, alineados por el final, empiezan en sitios distintos).
const HEAD = [
  { x: 56, y: 776, s: "INGREDIENTE" },
  { x: 300, y: 776, s: "PROVEEDOR" },
  { x: 412, y: 776, s: "COSTO X LT/KG /UND" },
];
const costX = (s) => 530 - s.length * 5;
function page(lines, head = HEAD) {
  const items = [...head];
  lines.forEach(([name, supplier, cost], i) => {
    const y = 756 - i * 20;
    if (name) items.push({ x: 56, y, s: name });
    if (supplier) items.push({ x: 289, y: y + 0.4, s: supplier });
    if (cost) items.push({ x: costX(cost), y: y - 0.3, s: cost });
  });
  return items;
}
const PAGES = [
  page([
    ["AZUCAR DE PRUEBA", "ALMACEN CENTRAL", "1,90 €"],
    ["VAINA SIN PRECIO", "ALMACEN CENTRAL", ""],
    ["LICOR SIN PROVEEDOR", "", "15,00 €"],
    ["ACEITE SIN NADA", "", ""],
    ["ESPECIA CARA", "LACTEOS NORTE", "3.874,00 €"],
    ["CACAO DE PRUEBA 22-24 %", "ALMACEN CENTRAL", "18,28 €"],
    ["LECHE ENTERA", "LACTEOS NORTE", "0,99 €"],
    ["ESTABILIZANTE NEUTRO C.C.", "DISTRIBUCIONES SOL", "16,36 €"],
  ]),
  page([
    ["AZUCAR DE PRUEBA", "DISTRIBUCIONES SOL", "1,45 €"],
    ["AZÚCAR DE PRUEBA", "LACTEOS NORTE", "2,14 €"],
    ["CACAO DE PRUEBA 22-24%", "DISTRIBUCIONES SOL", "13,18 €"],
    ["LECHE ENTERA MARCA", "DISTRIBUCIONES SOL", "1,09 €"],
    ["LECHE FRESCA (ENTERA)", "ALMACEN CENTRAL", "1,48 €"],
    ["ESTABILIZANTE C.C", "ALMACEN CENTRAL", "21,60 €"],
    ["BASE BLANCA", "PRODUCCION PROPIA", "1,63 €"],
    ["BIZCOCHO BAÑADO", "PRODUCCION PROPIA", "0,00 €"],
    ["GALLETA GRATIS", "ALMACEN CENTRAL", "0,00 €"],
    ["GALLETA GRATIS", "LACTEOS NORTE", "2,00 €"],
  ]),
];
const reading = () => parsePriceList(PAGES);
const row = (r, name, supplier) =>
  r.rows.find((x) => x.name === name && x.supplier === supplier);
const imported = () =>
  apply(seed(), {
    type: "importPriceList",
    source: "lista-de-prueba.pdf",
    rows: reading().rows,
  });
const stored = (s, name, supplier) =>
  s.priceList.find((x) => x.name === name && (x.supplier ?? null) === supplier);
const group = (s, name) =>
  priceGroups(s).groups.find((g) => g.rows.some((r) => r.name === name));

test("cada dato va a su columna por la posición: un importe sin proveedor no es un proveedor", () => {
  const r = reading();
  assert.equal(r.reason, "");
  assert.equal(r.rows.length, 18);
  assert.deepEqual(r.skipped, []);
  assert.deepEqual(row(r, "LICOR SIN PROVEEDOR", null), {
    name: "LICOR SIN PROVEEDOR",
    supplier: null,
    cents: 1500,
    page: 1,
    line: 3,
    issues: [],
  });
  // Sin precio no es 0: es «no lo dice».
  assert.equal(row(r, "VAINA SIN PRECIO", "ALMACEN CENTRAL").cents, null);
  const bare = row(r, "ACEITE SIN NADA", null);
  assert.equal(bare.cents, null);
  assert.equal(bare.supplier, null);
  // Los miles con punto y los céntimos con coma.
  assert.equal(row(r, "ESPECIA CARA", "LACTEOS NORTE").cents, 387400);
  assert.equal(row(r, "AZUCAR DE PRUEBA", "DISTRIBUCIONES SOL").cents, 145);
  assert.equal(row(r, "AZUCAR DE PRUEBA", "DISTRIBUCIONES SOL").page, 2);
});

test("un precio 0 se lee como 0, pero queda marcado como dudoso", () => {
  const r = reading();
  const zero = row(r, "GALLETA GRATIS", "ALMACEN CENTRAL");
  assert.equal(zero.cents, 0);
  assert.match(zero.issues[0], /0,00 €/);
  assert.deepEqual(priceReadingSummary(r), {
    rows: 18,
    suppliers: 3,
    house: 2,
    noPrice: 2,
    noSupplier: 2,
    doubtful: 2,
    skipped: 0,
  });
});

test("sin cabecera no se propone nada, y se dice", () => {
  const r = parsePriceList([
    page([["AZUCAR DE PRUEBA", "ALMACEN CENTRAL", "1,90 €"]], []),
  ]);
  assert.deepEqual(r.rows, []);
  assert.match(r.reason, /No se ha encontrado una lista de precios/);
  // Una cabecera a la que le falta la columna de proveedor tampoco vale.
  const two = parsePriceList([
    page([["AZUCAR DE PRUEBA", "", "1,90 €"]], [HEAD[0], HEAD[2]]),
  ]);
  assert.deepEqual(two.rows, []);
  assert.deepEqual(parsePriceList([]).rows, []);
});

test("lo que no se entiende va aparte con su motivo y no se importa", () => {
  const r = parsePriceList([
    [
      ...HEAD,
      { x: 56, y: 756, s: "HARINA DE PRUEBA" },
      { x: 289, y: 756, s: "ALMACEN CENTRAL" },
      { x: 480, y: 756, s: "consultar" },
      { x: 289, y: 736, s: "LACTEOS NORTE" },
      { x: 500, y: 736, s: "2,00 €" },
      { x: 56, y: 716, s: "NATA DE PRUEBA" },
      { x: 289, y: 716, s: "4,10 €" },
      { x: 56, y: 696, s: "NATA DE PRUEBA" },
      { x: 289, y: 696, s: "LACTEOS NORTE" },
      { x: 500, y: 696, s: "4,10 €" },
      { x: 56, y: 676, s: "NATA DE PRUEBA" },
      { x: 289, y: 676, s: "LACTEOS NORTE" },
      { x: 500, y: 676, s: "4,30 €" },
      { x: 56, y: 40, s: "Página 1 de 2" },
    ],
  ]);
  assert.deepEqual(
    r.rows.map((x) => [x.name, x.supplier, x.cents]),
    [["NATA DE PRUEBA", "LACTEOS NORTE", 410]],
  );
  assert.deepEqual(
    r.skipped.map((x) => x.reason),
    [
      "El coste de la fila no se entiende.",
      "Fila sin nombre de ingrediente.",
      "Un importe fuera de la columna del coste.",
      "Repetida con el mismo proveedor: se conserva la primera.",
      "Número de página: no es un ingrediente.",
    ],
  );
});

test("un nombre o un importe partido en trozos se recompone dentro de su columna", () => {
  const r = parsePriceList([
    [
      ...HEAD,
      { x: 56, y: 756, s: "PASTA DE" },
      { x: 110, y: 756, s: "PRUEBA 100%" },
      { x: 289, y: 756, s: "ALMACEN" },
      { x: 340, y: 756, s: "CENTRAL" },
      { x: 490, y: 756, s: "41,80" },
      { x: 520, y: 756, s: "€" },
    ],
  ]);
  assert.deepEqual(r.rows, [
    {
      name: "PASTA DE PRUEBA 100%",
      supplier: "ALMACEN CENTRAL",
      cents: 4180,
      page: 1,
      line: 1,
      issues: [],
    },
  ]);
});

test("importar guarda la lista y no cambia productos, precios ni stock", () => {
  const before = seed();
  const s = imported();
  assert.equal(s.priceList.length, 18);
  assert.deepEqual(s.products, before.products);
  assert.deepEqual(s.suppliers, before.suppliers);
  assert.deepEqual(s.prices, before.prices);
  assert.deepEqual(s.movements, before.movements);
  assert.equal(
    stored(s, "VAINA SIN PRECIO", "ALMACEN CENTRAL").cents,
    undefined,
  );
  assert.equal(stored(s, "LICOR SIN PROVEEDOR", null).supplier, undefined);
  assert.match(s.activity[0].text, /No cambia productos, precios ni stock/);
});

test("volver a importar el mismo archivo sustituye sus filas y conserva las de otros", () => {
  let s = imported();
  const id = stored(s, "LECHE ENTERA", "LACTEOS NORTE").id;
  s = apply(s, {
    type: "importPriceList",
    source: "otra-lista.pdf",
    rows: [
      {
        name: "MIEL DE PRUEBA",
        supplier: "ALMACEN CENTRAL",
        cents: 900,
        page: 1,
        line: 1,
      },
    ],
  });
  assert.equal(s.priceList.length, 19);
  s = apply(s, {
    type: "importPriceList",
    source: "lista-de-prueba.pdf",
    rows: [
      {
        name: "Leche entera",
        supplier: "Lacteos Norte",
        cents: 105,
        page: 1,
        line: 1,
      },
      { name: "FRUTA NUEVA", supplier: null, cents: null, page: 1, line: 2 },
    ],
  });
  assert.deepEqual(s.priceList.map((r) => r.name).sort(), [
    "FRUTA NUEVA",
    "Leche entera",
    "MIEL DE PRUEBA",
  ]);
  const milk = s.priceList.find((r) => r.name === "Leche entera");
  assert.equal(milk.id, id);
  assert.equal(milk.cents, 105);
  s = apply(s, { type: "clearPriceList" });
  assert.deepEqual(s.priceList, []);
  assert.throws(
    () => apply(s, { type: "clearPriceList" }),
    /No hay ninguna lista/,
  );
});

test("solo se juntan solos los nombres iguales sin tildes ni signos", () => {
  assert.equal(
    priceKey("CACAO DE PRUEBA 22-24 %"),
    priceKey("cacao de prueba 22-24%"),
  );
  assert.equal(priceKey("ESTABILIZANTE C.C."), priceKey("Estabilizante C.C"));
  assert.notEqual(priceKey("LECHE ENTERA"), priceKey("LECHE ENTERA MARCA"));
  const s = imported();
  const sugar = group(s, "AZUCAR DE PRUEBA");
  assert.deepEqual(
    sugar.rows.map((r) => [r.supplier, r.cents, r.cheapest]),
    [
      ["DISTRIBUCIONES SOL", 145, true],
      ["ALMACEN CENTRAL", 190, false],
      ["LACTEOS NORTE", 214, false],
    ],
  );
  assert.deepEqual(sugar.joined, []);
  assert.equal(group(s, "CACAO DE PRUEBA 22-24 %").rows.length, 2);
  // Los casi iguales NO se juntan solos: cada uno es su grupo, sin recomendación.
  for (const name of [
    "LECHE ENTERA",
    "LECHE ENTERA MARCA",
    "LECHE FRESCA (ENTERA)",
    "ESTABILIZANTE NEUTRO C.C.",
    "ESTABILIZANTE C.C",
  ]) {
    const g = group(s, name);
    assert.equal(g.rows.length, 1, name);
    assert.equal(g.cheapest, null, name);
    assert.equal(g.next, null, name);
    assert.equal(g.saving, null, name);
  }
});

test("el más barato, el siguiente y la diferencia salen de una fórmula", () => {
  const g = group(imported(), "AZUCAR DE PRUEBA");
  assert.equal(g.suppliers, 3);
  assert.equal(g.cheapest.supplier, "DISTRIBUCIONES SOL");
  // Siguiente: (190 − 145) ÷ 145 = 31,0 % más.
  assert.deepEqual(g.next, {
    supplier: "ALMACEN CENTRAL",
    cents: 190,
    pct: 31,
  });
  // Diferencia: 214 − 145 = 69 céntimos; 69 ÷ 214 = 32,2 % sobre el más caro.
  assert.deepEqual(g.saving, { cents: 69, pct: 32.2, dearest: 214 });
});

test("un precio 0, una fila sin precio o sin proveedor no cuentan como el más barato", () => {
  const s = imported();
  const zero = group(s, "GALLETA GRATIS");
  assert.deepEqual(
    zero.rows.map((r) => [r.supplier, r.cents, r.compared]),
    [
      ["LACTEOS NORTE", 200, true],
      ["ALMACEN CENTRAL", 0, false],
    ],
  );
  assert.equal(zero.cheapest, null);
  assert.equal(group(s, "VAINA SIN PRECIO").rows[0].cents, null);
  assert.equal(group(s, "LICOR SIN PROVEEDOR").rows[0].compared, false);
});

test("lo hecho en casa va aparte y nunca compite como proveedor", () => {
  const s = imported();
  const c = priceGroups(s);
  assert.deepEqual(
    c.house.map((r) => [r.name, r.cents]),
    [
      ["BASE BLANCA", 163],
      ["BIZCOCHO BAÑADO", 0],
    ],
  );
  assert.ok(
    !c.groups.some((g) =>
      g.rows.some((r) => r.supplier === "PRODUCCION PROPIA"),
    ),
  );
  assert.equal(c.totals.suppliers, 3);
  const house = stored(s, "BASE BLANCA", "PRODUCCION PROPIA");
  assert.throws(
    () =>
      apply(s, {
        type: "linkPriceRows",
        rows: [house.id, stored(s, "LECHE ENTERA", "LACTEOS NORTE").id],
      }),
    /hecho en casa/,
  );
  assert.throws(
    () => apply(s, { type: "usePriceRow", row: house.id, product: "p2" }),
    /elaboración de la casa/,
  );
});

test("juntar a mano une nombres distintos, lo dice, y se puede deshacer", () => {
  let s = imported();
  const a = stored(s, "LECHE ENTERA", "LACTEOS NORTE");
  const b = stored(s, "LECHE ENTERA MARCA", "DISTRIBUCIONES SOL");
  const c = stored(s, "LECHE FRESCA (ENTERA)", "ALMACEN CENTRAL");
  s = apply(s, { type: "linkPriceRows", rows: [a.id, b.id] });
  let g = group(s, "LECHE ENTERA");
  assert.deepEqual(
    g.rows.map((r) => [r.name, r.cents, r.cheapest]),
    [
      ["LECHE ENTERA", 99, true],
      ["LECHE ENTERA MARCA", 109, false],
    ],
  );
  assert.deepEqual([...g.joined].sort(), [
    "LECHE ENTERA",
    "LECHE ENTERA MARCA",
  ]);
  assert.throws(
    () => apply(s, { type: "linkPriceRows", rows: [a.id, b.id] }),
    /ya cuentan como el mismo/,
  );
  s = apply(s, { type: "linkPriceRows", rows: [b.id, c.id] });
  assert.equal(s.priceLinks.length, 1);
  assert.equal(group(s, "LECHE ENTERA").rows.length, 3);
  s = apply(s, { type: "unlinkPriceRow", row: c.id });
  assert.equal(group(s, "LECHE ENTERA").rows.length, 2);
  assert.equal(group(s, "LECHE FRESCA (ENTERA)").rows.length, 1);
  s = apply(s, { type: "unlinkPriceRow", row: a.id });
  assert.deepEqual(s.priceLinks, []);
  assert.throws(
    () => apply(s, { type: "unlinkPriceRow", row: a.id }),
    /no estaba juntada/,
  );
});

test("la estrella la pone la persona, y manda en el orden", () => {
  let s = imported();
  const before = priceGroups(s);
  assert.equal(before.totals.stars, 0);
  // Sin estrellas: primero donde más diferencia hay (cacao 5,10 €; azúcar 0,69 €), luego por nombre.
  assert.deepEqual(
    before.groups.slice(0, 3).map((g) => g.name),
    ["CACAO DE PRUEBA 22-24%", "AZUCAR DE PRUEBA", "ACEITE SIN NADA"],
  );
  s = apply(s, {
    type: "starPriceRow",
    row: stored(s, "LECHE ENTERA", "LACTEOS NORTE").id,
    star: true,
  });
  const after = priceGroups(s);
  assert.equal(after.groups[0].name, "LECHE ENTERA");
  assert.equal(after.groups[0].star, true);
  assert.equal(after.groups[1].name, "CACAO DE PRUEBA 22-24%");
  assert.equal(after.totals.stars, 1);
  s = apply(s, {
    type: "starPriceRow",
    row: stored(s, "LECHE ENTERA", "LACTEOS NORTE").id,
    star: false,
  });
  assert.deepEqual(s.priceStars, []);
});

test("usar un precio de la lista en un producto: con confirmación, con su origen y sin cambiar el proveedor habitual", () => {
  let s = imported();
  const p = () => s.products.find((x) => x.id === "p2");
  const usualBefore = p().supplier;
  const priceBefore = p().price;
  const stockBefore = p().stock;
  const r = stored(s, "LECHE ENTERA", "LACTEOS NORTE");
  // El proveedor de la lista no existe: sin confirmación expresa no se crea ni se apunta nada.
  assert.throws(
    () => apply(s, { type: "usePriceRow", row: r.id, product: "p2" }),
    /no está entre tus proveedores/,
  );
  const suppliersBefore = s.suppliers.length;
  s = apply(s, {
    type: "usePriceRow",
    row: r.id,
    product: "p2",
    addSupplier: true,
  });
  assert.equal(s.suppliers.length, suppliersBefore + 1);
  const sup = s.suppliers.at(-1);
  assert.equal(sup.name, "LACTEOS NORTE");
  assert.equal(sup.initials, "LN");
  assert.equal(p().supplier, usualBefore);
  assert.equal(p().price, priceBefore);
  assert.equal(p().stock, stockBefore);
  // Derivado con fórmula: céntimos por unidad × lo que trae el paquete.
  const alt = p().alternates.find((x) => x.supplier === sup.id);
  assert.deepEqual(alt, {
    supplier: sup.id,
    pack: p().pack,
    price: Math.round(99 * p().pack),
  });
  const entry = s.prices.at(-1);
  assert.equal(entry.source, "list");
  assert.equal(entry.ref, r.id);
  assert.equal(
    entry.refLabel,
    "lista-de-prueba.pdf · página 1 · fila 7 · «LECHE ENTERA»",
  );
  assert.equal(entry.to, alt.price);
  assert.match(s.activity[0].text, /su proveedor habitual no cambia/);
  const line = supplierCatalog(s, sup.id).find((l) => l.product === "p2");
  assert.equal(line.source, "list");
  assert.equal(line.refLabel, entry.refLabel);
  assert.throws(
    () => apply(s, { type: "usePriceRow", row: r.id, product: "p2" }),
    /ya está a/,
  );
});

test("si el proveedor de la lista es el habitual del producto, cambia su precio y el historial cita la fila", () => {
  let s = seed();
  const p = s.products.find((x) => x.id === "p2");
  const usual = s.suppliers.find((x) => x.id === p.supplier);
  s = apply(s, {
    type: "importPriceList",
    source: "lista-de-prueba.pdf",
    rows: [
      {
        name: "LECHE DE PRUEBA",
        supplier: usual.name.toUpperCase(),
        cents: 123,
        page: 3,
        line: 4,
      },
      { name: "LECHE DE PRUEBA", supplier: null, cents: 100, page: 3, line: 5 },
      {
        name: "LECHE DE PRUEBA",
        supplier: "OTRO",
        cents: null,
        page: 3,
        line: 6,
      },
    ],
  });
  const rows = s.priceList;
  assert.throws(
    () =>
      apply(s, {
        type: "usePriceRow",
        row: rows[1].id,
        product: "p2",
        addSupplier: true,
      }),
    /no dice a qué proveedor/,
  );
  assert.throws(
    () =>
      apply(s, {
        type: "usePriceRow",
        row: rows[2].id,
        product: "p2",
        addSupplier: true,
      }),
    /no trae un precio/,
  );
  const count = s.suppliers.length;
  s = apply(s, { type: "usePriceRow", row: rows[0].id, product: "p2" });
  const after = s.products.find((x) => x.id === "p2");
  assert.equal(s.suppliers.length, count);
  assert.equal(after.price, Math.round(123 * p.pack));
  assert.equal(after.supplier, p.supplier);
  assert.deepEqual(after.alternates, p.alternates);
  assert.equal(after.stock, p.stock);
  const line = supplierCatalog(s, p.supplier).find((l) => l.product === "p2");
  assert.equal(line.source, "list");
  assert.match(line.refLabel, /página 3 · fila 4/);
});

test("lista de precios (juez): una lista nueva puede sustituir a la anterior, y un precio apuntado a otro proveedor no tapa la subida del habitual", () => {
  const { priceAlerts } = require("../build/inventory.js");
  const row = (name, supplier, cents) => ({
    name,
    supplier,
    cents,
    page: 1,
    line: 1,
    issues: [],
  });
  let s = apply(seed(), {
    type: "importPriceList",
    source: "vieja.pdf",
    rows: [row("Ingrediente uno", "Proveedor A", 100)],
  });
  // Sin sustituir, conviven; sustituyendo, solo queda la nueva.
  const both = apply(s, {
    type: "importPriceList",
    source: "nueva.pdf",
    rows: [row("Ingrediente uno", "Proveedor B", 90)],
  });
  assert.equal(both.priceList.length, 2);
  s = apply(s, {
    type: "importPriceList",
    source: "nueva.pdf",
    replace: true,
    rows: [row("Ingrediente uno", "Proveedor B", 90)],
  });
  assert.deepEqual(
    s.priceList.map((r) => r.source),
    ["nueva.pdf"],
  );
  // Subida del proveedor habitual de p2 y, después, un precio de la lista para otro proveedor.
  const p = s.products.find((x) => x.id === "p2");
  s = apply(s, {
    type: "editProduct",
    product: "p2",
    name: p.name,
    detail: p.detail,
    min: p.min,
    target: p.target,
    pack: p.pack,
    price: p.price + 100,
    supplier: p.supplier,
  });
  const before = priceAlerts(s).filter((x) => x.product === "p2").length;
  assert.equal(before, 1);
  s = apply(s, {
    type: "usePriceRow",
    row: s.priceList[0].id,
    product: "p2",
    addSupplier: true,
  });
  assert.equal(s.products.find((x) => x.id === "p2").supplier, p.supplier);
  assert.equal(priceAlerts(s).filter((x) => x.product === "p2").length, 1);
});

test("carrito: avisa del proveedor apuntado con el que la línea sale más barata y solo cambia si la persona lo pide", () => {
  const { cartAdvice } = require("../build/pricelist.js");
  // Leche (p2): habitual s2, 6 L por 6,90 €. Otro proveedor s1: 10 L por 9,00 €.
  let s = apply(seed(), {
    type: "setAlternate",
    product: "p2",
    supplier: "s1",
    pack: 10,
    price: 900,
  });
  s = apply(s, { type: "suggest" });
  const line = s.cart.find((l) => l.product === "p2");
  // La propuesta va con el habitual; no se cambia sola.
  assert.equal(line.supplier, undefined);
  assert.match(s.activity[0].text, /más barata.* con otro proveedor/);
  const a = cartAdvice(s).find((x) => x.product === "p2");
  const units = line.packs * 6;
  const packs = Math.ceil(units / 10);
  assert.equal(a.chosen.cents, line.packs * 690);
  if (packs * 900 < line.packs * 690) {
    assert.deepEqual(
      [a.cheaper.supplier, a.cheaper.packs, a.cheaper.cents, a.cheaper.saving],
      ["s1", packs, packs * 900, line.packs * 690 - packs * 900],
    );
  } else assert.equal(a.cheaper, null);
  // Un producto sin otro proveedor apuntado no recibe consejo, y uno sin precio tampoco.
  assert.equal(cartAdvice(s).find((x) => x.product === "p1").cheaper, null);
  const s2 = apply(s, { type: "cartCheapest" });
  const moved = s2.cart.find((l) => l.product === "p2");
  assert.equal(moved.supplier, "s1");
  assert.equal(moved.packs, packs);
  assert.equal(s2.products.find((p) => p.id === "p2").supplier, "s2");
  assert.equal(cartAdvice(s2).find((x) => x.product === "p2").cheaper, null);
  // Ya no hay nada que bajar: se dice, no se hace nada.
  assert.throws(
    () => apply(s2, { type: "cartCheapest" }),
    /no hay ninguna línea/,
  );
  // Un alternativo sin precio no se propone nunca.
  let s3 = apply(seed(), {
    type: "setAlternate",
    product: "p2",
    supplier: "s1",
    pack: 10,
    price: 0,
  });
  s3 = apply(s3, { type: "suggest" });
  assert.equal(cartAdvice(s3).find((x) => x.product === "p2").cheaper, null);
});

test("carrito: lo más barato de la lista de precios se enseña para el producto que se llama igual, sin compararlo con el paquete", () => {
  const { cartAdvice } = require("../build/pricelist.js");
  const row = (name, supplier, cents) => ({
    name,
    supplier,
    cents,
    page: 1,
    line: 1,
    issues: [],
  });
  let s = apply(seed(), {
    type: "importPriceList",
    source: "lista.pdf",
    rows: [
      row("LECHE ENTERA", "Proveedor de prueba A", 110),
      row("Leche entera", "Proveedor de prueba B", 95),
      row("Otra cosa", "Proveedor de prueba B", 5),
    ],
  });
  s = apply(s, { type: "cart", product: "p2", packs: 2 });
  s = apply(s, { type: "cart", product: "p1", packs: 1 });
  const milk = cartAdvice(s).find((x) => x.product === "p2");
  assert.equal(milk.list.supplier, "Proveedor de prueba B");
  assert.equal(milk.list.cents, 95);
  assert.equal(milk.list.suppliers, 2);
  assert.equal(milk.list.noted, false);
  // La lista no cambia la línea ni propone cambiar de proveedor por sí sola.
  assert.equal(milk.cheaper, null);
  assert.equal(cartAdvice(s).find((x) => x.product === "p1").list, null);
  // Al apuntarlo la persona en el producto, deja de ser «de la lista» y pasa a compararse.
  s = apply(s, {
    type: "usePriceRow",
    row: milk.list.row,
    product: "p2",
    addSupplier: true,
  });
  const after = cartAdvice(s).find((x) => x.product === "p2");
  assert.equal(after.list.noted, true);
  assert.equal(after.cheaper.cents, 2 * 6 * 95);
});
