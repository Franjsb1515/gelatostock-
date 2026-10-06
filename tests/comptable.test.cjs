const test = require("node:test");
const assert = require("node:assert/strict");
const { apply, seed } = require("../build/domain.js");
const { parseCompositionTable } = require("../build/comptable.js");
const { recipeBalance } = require("../build/balance.js");

// Tabla sintética con la forma de una tabla de balance: cabecera en tres líneas y una columna
// cada 50 puntos. Los valores son inventados para la prueba; no son los de ninguna tabla real.
const X = {
  quantity: 360,
  sugars: 440,
  fat: 490,
  msnf: 540,
  otherSolids: 590,
  solids: 640,
  water: 690,
  lactose: 740,
  milkProtein: 790,
  minerals: 840,
  protein: 890,
  fiber: 940,
  pacSugars: 990,
  pac: 1040,
  pod: 1090,
};
const header = (y) => [
  { x: 590, y: y + 12, s: "OTROS" },
  { x: 640, y: y + 12, s: "SOLIDOS" },
  { x: 790, y: y + 12, s: "PROTEÍNA" },
  { x: 840, y: y + 12, s: "SALES" },
  { x: 890, y: y + 12, s: "PROTEÍNAS" },
  { x: 990, y: y + 12, s: "PAC" },
  { x: 180, y, s: "INGREDIENTES" },
  { x: X.quantity, y, s: "CANTIDAD" },
  { x: X.sugars, y, s: "AZUCAR" },
  { x: X.fat, y, s: "GRASAS" },
  { x: X.msnf, y, s: "S.M.L." },
  { x: X.water, y, s: "AGUA" },
  { x: X.lactose, y, s: "LACTOSA" },
  { x: X.fiber, y, s: "FIBRAS" },
  { x: X.pac, y, s: "PAC TOTAL" },
  { x: X.pod, y, s: "POD" },
  { x: X.otherSolids, y: y - 12, s: "SOLIDOS" },
  { x: X.solids, y: y - 12, s: "TOTALES" },
  { x: X.milkProtein, y: y - 12, s: "(leche)" },
  { x: X.minerals, y: y - 12, s: "MINERALES" },
  { x: X.protein, y: y - 12, s: "(totales)" },
  { x: X.pacSugars, y: y - 12, s: "Azúcares" },
];
const order = Object.keys(X);
/** Una fila: los números van a su columna con un pequeño desplazamiento, como en un PDF. */
const line = (y, name, values, skip = []) => [
  ...(name ? [{ x: 80, y, s: name }] : []),
  ...order
    .map((k, i) => ({ k, v: values[i] }))
    .filter(({ k, v }) => v !== undefined && !skip.includes(k))
    .map(({ k, v }) => ({ x: X[k] + 6, y, s: v })),
];
const milk = [
  "100,0",
  "0,0",
  "3,0",
  "9,0",
  "0,0",
  "12,0",
  "88,0",
  "5,0",
  "3,0",
  "0,7",
  "3,0",
  "0,0",
  "5,0",
  "8,0",
  "0,8",
];
const sugar = [
  "100,0",
  "100,0",
  "0,0",
  "0,0",
  "0,0",
  "100,0",
  "0,0",
  "0,0",
  "0,0",
  "0,0",
  "0,0",
  "0,0",
  "100,0",
  "100,0",
  "100,0",
];
const fructose = [...sugar.slice(0, 12), "190,0", "190,0", "170,0"];

test("tabla de composición: cada número va a su columna por posición y nada se rellena", () => {
  const page = [
    ...header(700),
    ...line(650, "Leche de prueba", milk),
    // Fila con el nombre en la línea de debajo de sus números.
    ...line(620, "", sugar),
    { x: 80, y: 608, s: "Azúcar de prueba" },
    ...line(580, "Fructosa de prueba", fructose),
    // Faltan dos celdas: quedan sin valor y se avisa.
    ...line(550, "Fila incompleta", milk, ["otherSolids", "minerals"]),
    // Rangos de referencia: no son ingredientes.
    { x: 80, y: 500, s: "% GELATO" },
    { x: X.sugars, y: 500, s: "18 - 22" },
    ...line(470, "Después de los rangos", milk),
  ];
  const t = parseCompositionTable([page]);
  assert.equal(t.reason, "");
  assert.equal(t.columns.length, 14);
  assert.deepEqual(
    t.rows.map((r) => r.name),
    [
      "Leche de prueba",
      "Azúcar de prueba",
      "Fructosa de prueba",
      "Fila incompleta",
    ],
  );
  const [m, s, f, inc] = t.rows;
  assert.deepEqual(m.composition, {
    sugars: 0,
    fat: 3,
    msnf: 9,
    otherSolids: 0,
    solids: 12,
    water: 88,
    lactose: 5,
    milkProtein: 3,
    minerals: 0.7,
    protein: 3,
    fiber: 0,
    pacSugars: 5,
    pac: 8,
    pod: 0.8,
  });
  assert.deepEqual(m.issues, []);
  assert.equal(s.composition.sugars, 100);
  // PAC y POD son índices: pasar de 100 no es un aviso.
  assert.equal(f.composition.pac, 190);
  assert.deepEqual(f.issues, []);
  // Lo que la tabla no trae no es 0.
  assert.equal(inc.composition.otherSolids, undefined);
  assert.equal(inc.composition.minerals, undefined);
  assert.equal(inc.composition.solids, 12);
  assert.match(inc.issues.join(" "), /no trae: Otros sólidos, Sales minerales/);
  assert.match(t.skipped.map((x) => x.reason).join(" "), /No son ingredientes/);
});

test("tabla de composición: lo que no cuadra se avisa y no se corrige", () => {
  const off = [...milk];
  off[5] = "20,0"; // sólidos totales que no son la suma
  const half = [...milk];
  half[0] = "50,0";
  const salt = [...sugar];
  salt[12] = "580,0";
  salt[13] = "0,0";
  const t = parseCompositionTable([
    [
      ...header(700),
      ...line(650, "Suma rara", off),
      ...line(620, "Media ración", half),
      ...line(590, "Índice raro", salt),
      ...line(560, "Suma rara", milk),
      // Un texto en una columna de números: la fila entera se deja fuera.
      ...line(530, "Con letras", milk).map((c) =>
        c.x === X.fat + 6 ? { ...c, s: "aprox" } : c,
      ),
    ],
  ]);
  const by = Object.fromEntries(t.rows.map((r) => [r.name, r]));
  assert.equal(by["Suma rara"].composition.solids, 20);
  assert.match(by["Suma rara"].issues.join(" "), /suman 12 y la tabla dice 20/);
  assert.match(by["Suma rara"].issues.join(" "), /agua suman 108, no 100/);
  assert.match(by["Media ración"].issues.join(" "), /no 100/);
  assert.match(by["Índice raro"].issues.join(" "), /PAC total \(0\) es menor/);
  assert.equal(by["Índice raro"].composition.pacSugars, 580);
  assert.equal(t.rows.length, 3);
  assert.match(
    t.skipped.map((x) => x.text + " " + x.reason).join(" | "),
    /Suma rara Nombre repetido.*Con letras: «aprox»/,
  );
});

test("tabla de composición: sin cabecera no se propone nada", () => {
  const t = parseCompositionTable([
    [
      { x: 80, y: 700, s: "Factura 114" },
      { x: 80, y: 680, s: "Leche" },
      { x: 300, y: 680, s: "12,0" },
    ],
  ]);
  assert.equal(t.rows.length, 0);
  assert.match(t.reason, /No se ha encontrado una tabla/);
});

test("tabla de ingredientes: guardarla no toca el inventario; añadir y aplicar citan la fuente", () => {
  const rows = parseCompositionTable([
    [
      ...header(700),
      ...line(650, "Leche entera", milk),
      ...line(620, "Azúcar de prueba", sugar),
    ],
  ]).rows;
  const s0 = seed();
  let s = apply(s0, {
    type: "importIngredientTable",
    source: "tabla.pdf",
    rows,
  });
  assert.equal(s.ingredientTable.length, 2);
  assert.deepEqual(s.products, s0.products);
  assert.deepEqual(s.movements, s0.movements);
  // Volver a subirla actualiza por nombre, no duplica.
  s = apply(s, { type: "importIngredientTable", source: "tabla.pdf", rows });
  assert.equal(s.ingredientTable.length, 2);
  const [milkRow, sugarRow] = s.ingredientTable;
  // «Leche entera» ya existe (p2): no se crea otra; el azúcar sí, con stock 0 y sin precio.
  s = apply(s, {
    type: "addTableProducts",
    entries: [milkRow.id, sugarRow.id],
    supplier: "s2",
    category: "Gelatería",
    unit: "kg",
  });
  assert.equal(s.products.length, s0.products.length + 1);
  const made = s.products.at(-1);
  assert.equal(made.name, "Azúcar de prueba");
  assert.equal(made.stock, 0);
  assert.equal(made.price, 0);
  assert.equal(made.composition.pod, 100);
  assert.equal(
    made.compositionSource,
    "tabla.pdf · página 1 · «Azúcar de prueba»",
  );
  assert.match(s.activity[0].text, /Ya estaban y no se tocan: Leche entera/);
  assert.throws(
    () =>
      apply(s, {
        type: "addTableProducts",
        entries: [milkRow.id],
        supplier: "s2",
        category: "Gelatería",
        unit: "kg",
      }),
    /ya están en el inventario/,
  );
  // Aplicar la fila a la leche del inventario: cambia la composición, no el stock ni el precio.
  const before = s.products.find((p) => p.id === "p2");
  s = apply(s, {
    type: "applyTableComposition",
    entry: milkRow.id,
    product: "p2",
  });
  const after = s.products.find((p) => p.id === "p2");
  assert.equal(after.composition.lactose, 5);
  assert.equal(after.stock, before.stock);
  assert.equal(after.price, before.price);
  assert.match(
    after.compositionSource,
    /tabla\.pdf · página 1 · «Leche entera»/,
  );
  // Cambiarla a mano quita la marca de «de la tabla».
  s = apply(s, {
    type: "editProduct",
    product: "p2",
    name: after.name,
    detail: after.detail,
    min: after.min,
    target: after.target,
    pack: after.pack,
    price: after.price,
    supplier: after.supplier,
    composition: { ...after.composition, fat: 3.6 },
  });
  assert.equal(
    s.products.find((p) => p.id === "p2").compositionSource,
    undefined,
  );
  // Vaciar la tabla no toca los productos.
  const kept = s.products;
  s = apply(s, { type: "clearIngredientTable" });
  assert.equal(s.ingredientTable.length, 0);
  assert.deepEqual(s.products, kept);
});

test("balance: agua, PAC y POD se informan y un dato que falta es «No disponible», no 0", () => {
  let s = seed();
  const r = s.recipes[0]; // 0,5 L de leche (p2) + 0,2 L de nata (p10)
  const more = (st) =>
    Object.fromEntries(
      recipeBalance(st, st.recipes[0]).more.map((m) => [m.key, m.value]),
    );
  // La semilla no trae PAC ni agua: no disponible.
  assert.equal(more(s).pac, null);
  assert.equal(more(s).water, null);
  const edit = (st, id, composition) => {
    const p = st.products.find((x) => x.id === id);
    return apply(st, {
      type: "editProduct",
      product: id,
      name: p.name,
      detail: p.detail,
      min: p.min,
      target: p.target,
      pack: p.pack,
      price: p.price,
      supplier: p.supplier,
      composition: { ...p.composition, ...composition },
    });
  };
  s = edit(s, "p2", { pac: 8, water: 88 });
  // Solo la leche lo trae: sigue sin poder decirse.
  assert.equal(more(s).pac, null);
  s = edit(s, "p10", { pac: 5, water: 60 });
  assert.equal(more(s).pac, Math.round(((0.5 * 8 + 0.2 * 5) / 0.7) * 10) / 10);
  assert.equal(
    more(s).water,
    Math.round(((0.5 * 88 + 0.2 * 60) / 0.7) * 10) / 10,
  );
  assert.equal(more(s).pod, null);
  assert.equal(r.ingredients.length, 2);
});

test("tabla de composición (juez): una fila imposible o una página sin cabecera se dicen y no rompen el resto", () => {
  const big = [...milk];
  big[2] = "140,0";
  const t = parseCompositionTable([
    [
      ...header(700),
      ...line(650, "Leche de prueba", milk),
      ...line(620, "Grasa imposible", big),
      ...line(590, "N".repeat(101), milk),
    ],
    [{ x: 80, y: 700, s: "Notas sueltas sin tabla" }],
  ]);
  assert.deepEqual(
    t.rows.map((r) => r.name),
    ["Leche de prueba"],
  );
  const why = t.skipped.map((x) => `p${x.page} ${x.reason}`).join(" | ");
  assert.match(why, /p1 Trae un valor imposible/);
  assert.match(why, /p1 El nombre pasa de 100 letras/);
  assert.match(why, /p2 No tiene la cabecera de la tabla/);
  // Lo que queda se puede guardar entero.
  const s = apply(seed(), {
    type: "importIngredientTable",
    source: "tabla.pdf",
    rows: t.rows,
  });
  assert.equal(s.ingredientTable.length, 1);
});

test("tabla de ingredientes (juez): no se aplica a un producto por unidades y el balance avisa si el azúcar se cuenta de dos formas", () => {
  const rows = parseCompositionTable([
    [...header(700), ...line(650, "Leche de prueba", milk)],
  ]).rows;
  let s = apply(seed(), {
    type: "importIngredientTable",
    source: "tabla.pdf",
    rows,
  });
  const unit = s.products.find((p) => p.unit === "ud");
  assert.throws(
    () =>
      apply(s, {
        type: "applyTableComposition",
        entry: s.ingredientTable[0].id,
        product: unit.id,
      }),
    /por unidades/,
  );
  assert.equal(recipeBalance(s, s.recipes[0]).mixedSugars, false);
  // La leche pasa a la ficha de la tabla (lactosa aparte); la nata sigue con la antigua.
  s = apply(s, {
    type: "applyTableComposition",
    entry: s.ingredientTable[0].id,
    product: "p2",
  });
  assert.equal(recipeBalance(s, s.recipes[0]).mixedSugars, true);
});
