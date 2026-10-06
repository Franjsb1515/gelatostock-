const test = require("node:test");
const assert = require("node:assert/strict");
const { apply, seed, priceGroups } = require("../build/domain.js");
const {
  priceSuggestions,
  likelySame,
  cartAdvice,
  productOfName,
} = require("../build/pricelist.js");

// Filas inventadas con la forma de una lista real (nombre, proveedor, céntimos por kg, L o ud).
const row = (name, supplier, cents) => ({
  name,
  supplier,
  cents,
  page: 1,
  line: 1,
  issues: [],
});
const imported = (rows) =>
  apply(seed(), { type: "importPriceList", source: "lista.pdf", rows });

test("posibles iguales: solo se proponen con su motivo; la persona junta o dice que no, y nunca se juntan solos", () => {
  let s = imported([
    row("LECHE ENTERA", "Proveedor de prueba A", 99),
    row("LECHE ENTERA MARCA", "Proveedor de prueba B", 109),
    row("YEMA DE HUEVO", "Proveedor de prueba A", 1008),
    row("YEMA DE HUEVO 2", "Proveedor de prueba B", null),
    row("CHOCOLATE BLANCO", "Proveedor de prueba A", null),
    row("CHOCOLATE BLANCO 26%", "Proveedor de prueba A", 1540),
    row("CHOCOLATE NEGRO 55%", "Proveedor de prueba A", 1200),
    row("CHOCOLATE NEGRO 73%", "Proveedor de prueba A", 1325),
    row("COPETAS T08", "Proveedor de prueba B", 5),
    row("COPETAS T12", "Proveedor de prueba B", 6),
    row("SAL", "Proveedor de prueba A", 48),
    row("SAL TABLETAS DESCALCIFICADOR", "Proveedor de prueba C", 42),
    row("BASE BLANCA", "PRODUCCION PROPIA", 163),
    row("BASE BLANCA PREMIUM", "PRODUCCION PROPIA", 180),
  ]);
  const pairs = () =>
    priceSuggestions(s)
      .map((x) => [x.a.name, x.b.name].sort().join(" + "))
      .sort();
  assert.deepEqual(pairs(), [
    "CHOCOLATE BLANCO + CHOCOLATE BLANCO 26%",
    "LECHE ENTERA + LECHE ENTERA MARCA",
    "YEMA DE HUEVO + YEMA DE HUEVO 2",
  ]);
  // Motivos en palabras; lo que cambia de porcentaje, tamaño o uso no se propone.
  assert.equal(
    likelySame("LECHE ENTERA", "LECHE ENTERA MARCA"),
    "Las mismas palabras, con «MARCA» de más en uno.",
  );
  assert.equal(
    likelySame("CHOCOLATE BLANCO", "CHOCOLATE BLANCO 26%"),
    "Las mismas palabras, con «26» solo en uno de los dos.",
  );
  assert.equal(
    likelySame("AZUCAR SACAROSA 25KG", "SACAROSA (AZUCAR BLANCA)"),
    "Las mismas palabras, con «BLANCA» de más en uno y «25kg» solo en uno de los dos.",
  );
  assert.equal(likelySame("CHOCOLATE NEGRO 55%", "CHOCOLATE NEGRO 73%"), null);
  assert.equal(likelySame("COPETAS T08", "COPETAS T12"), null);
  assert.equal(likelySame("SAL", "SAL TABLETAS DESCALCIFICADOR"), null);
  assert.equal(likelySame("Leche entera", "LECHE ENTERA"), null);
  // Proponer no junta: los grupos siguen separados.
  assert.equal(priceGroups(s).groups.filter((g) => g.joined.length).length, 0);
  // «No, son distintos»: deja de proponerse y queda apuntado.
  const sug = priceSuggestions(s).find((x) =>
    x.a.name.startsWith("CHOCOLATE BLANCO"),
  );
  s = apply(s, { type: "rejectPriceMatch", rows: [sug.a.row, sug.b.row] });
  assert.equal(s.priceNotSame.length, 1);
  assert.match(s.activity[0].text, /son ingredientes distintos/);
  assert.deepEqual(pairs(), [
    "LECHE ENTERA + LECHE ENTERA MARCA",
    "YEMA DE HUEVO + YEMA DE HUEVO 2",
  ]);
  assert.throws(
    () => apply(s, { type: "rejectPriceMatch", rows: [sug.a.row, sug.b.row] }),
    /Ya habías dicho/,
  );
  // Juntarlos a mano después manda sobre el «no», y ya no se pueden rechazar.
  s = apply(s, { type: "linkPriceRows", rows: [sug.a.row, sug.b.row] });
  assert.deepEqual(s.priceNotSame, []);
  assert.throws(
    () => apply(s, { type: "rejectPriceMatch", rows: [sug.a.row, sug.b.row] }),
    /ya cuentan como el mismo/,
  );
  // «Sí, es el mismo» es juntar: la propuesta desaparece.
  const milk = priceSuggestions(s).find((x) => x.a.name.startsWith("LECHE"));
  s = apply(s, { type: "linkPriceRows", rows: [milk.a.row, milk.b.row] });
  assert.deepEqual(pairs(), ["YEMA DE HUEVO + YEMA DE HUEVO 2"]);
});

test("cada nombre de la lista recuerda a qué producto corresponde, y el carrito lo usa", () => {
  let s = imported([
    row("LECHE FRESCA ENTERA PASCUAL", "Proveedor de prueba B", 95),
    row("LECHE ENTERA", "Proveedor de prueba A", 110),
  ]);
  s = apply(s, { type: "cart", product: "p2", packs: 1 });
  // Sin decir nada, el carrito encuentra el nombre igual al del producto.
  assert.equal(cartAdvice(s).find((x) => x.product === "p2").list.cents, 110);
  const other = s.priceList.find(
    (r) => r.name === "LECHE FRESCA ENTERA PASCUAL",
  );
  const before = JSON.stringify([s.products, s.prices]);
  s = apply(s, {
    type: "linkNameProduct",
    kind: "list",
    row: other.id,
    product: "p2",
  });
  assert.equal(productOfName(s, "list", "LECHE FRESCA ENTERA PASCUAL"), "p2");
  const groupOf = (name) => priceGroups(s).groups.find((g) => g.name === name);
  assert.equal(groupOf("LECHE FRESCA ENTERA PASCUAL").product, "p2");
  assert.equal(groupOf("LECHE ENTERA").product, null);
  // El carrito usa lo recordado antes que el nombre igual; nada más cambia.
  assert.equal(cartAdvice(s).find((x) => x.product === "p2").list.cents, 95);
  assert.equal(JSON.stringify([s.products, s.prices]), before);
  // Usar un precio también lo recuerda; quitar olvida; quitar dos veces avisa.
  const first = s.priceList.find((r) => r.name === "LECHE ENTERA");
  s = apply(s, {
    type: "usePriceRow",
    row: first.id,
    product: "p2",
    addSupplier: true,
  });
  assert.equal(productOfName(s, "list", "LECHE ENTERA"), "p2");
  s = apply(s, { type: "unlinkNameProduct", kind: "list", row: other.id });
  assert.equal(productOfName(s, "list", "LECHE FRESCA ENTERA PASCUAL"), null);
  assert.throws(
    () => apply(s, { type: "unlinkNameProduct", kind: "list", row: other.id }),
    /no tenía producto/,
  );
  // Volver a subir la lista conserva la memoria (va por nombre); vaciarla la olvida.
  s = apply(s, {
    type: "importPriceList",
    source: "lista.pdf",
    replace: true,
    rows: [row("LECHE ENTERA", "Proveedor de prueba A", 120)],
  });
  assert.equal(productOfName(s, "list", "LECHE ENTERA"), "p2");
  s = apply(s, { type: "clearPriceList" });
  assert.deepEqual(s.nameProducts, []);
});

test("la tabla de ingredientes recuerda el producto al usar su composición, al añadirlo o al elegirlo", () => {
  let s = apply(seed(), {
    type: "importIngredientTable",
    source: "tabla.pdf",
    rows: [
      {
        name: "Leche entera (3,5 m.g.)",
        composition: { sugars: 4.9, fat: 3.5 },
        page: 1,
        issues: [],
      },
      {
        name: "Trehalosa de prueba",
        composition: { sugars: 100 },
        page: 1,
        issues: [],
      },
    ],
  });
  const milk = s.ingredientTable.find((e) => e.name.startsWith("Leche"));
  const tre = s.ingredientTable.find((e) => e.name.startsWith("Trehalosa"));
  assert.equal(productOfName(s, "table", milk.name), null);
  s = apply(s, {
    type: "applyTableComposition",
    entry: milk.id,
    product: "p2",
  });
  assert.equal(productOfName(s, "table", milk.name), "p2");
  s = apply(s, {
    type: "addTableProducts",
    entries: [tre.id],
    supplier: s.suppliers[0].id,
    category: "Gelatería",
    unit: "kg",
  });
  const made = s.products.find((p) => p.name === "Trehalosa de prueba");
  assert.equal(productOfName(s, "table", "Trehalosa de prueba"), made.id);
  s = apply(s, {
    type: "linkNameProduct",
    kind: "table",
    row: milk.id,
    product: "p1",
  });
  assert.equal(productOfName(s, "table", milk.name), "p1");
  // La memoria de la tabla y la de la lista no se mezclan.
  assert.equal(productOfName(s, "list", milk.name), null);
  s = apply(s, { type: "clearIngredientTable" });
  assert.deepEqual(s.nameProducts, []);
});
