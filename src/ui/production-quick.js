// Producción rápida (como el vídeo del usuario): un botón por sabor; al tocarlo, su receta con las
// cantidades de cada tanda y «Hecho», que registra la tanda en un paso (acción produceNow). Las
// bases se usan de la cámara o se hacen en el momento. Si un ingrediente no llega en el stock de
// la app, se avisa y se deja hacer (queda en negativo para corregirlo con un conteo).
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
const defaultBatches = [1, 4, 8, 16, 30, 60];
const quickFamilies = [
  ["crema", "Gelatos"],
  ["sorbete", "Sorbettos"],
  ["base", "Bases"],
  ["postre", "Postres"],
  ["otro", "Otras"],
];
/** Cantidad en la unidad más cómoda: 0,86 kg → «860 g»; 7,5 L → «7,5 L». */
function quickAmount(q, unit) {
  if (unit === "kg" && Math.abs(q) < 1) return num(Math.round(q * 1000)) + " g";
  if (unit === "L" && Math.abs(q) < 1) return num(Math.round(q * 1000)) + " ml";
  return num(Math.round(q * 1000) / 1000) + " " + unit;
}
const quickNeed = (r, ingredient, kg) => (ingredient.quantity * kg) / r.yield;

/** Botones de sabores para producir, por familias. */
function quickPanel() {
  const recipes = state.recipes.filter(
    (r) => r.ingredients.length || r.product,
  );
  if (!recipes.length) return "";
  const toProduce = Object.fromEntries(
    (alerts?.day?.toProduce || []).map((x) => [x.name, x.suggest]),
  );
  const groups = quickFamilies
    .map(([family, title]) => {
      const list = recipes.filter((r) => (r.family || "crema") === family);
      if (!list.length) return "";
      return `<div class="quick-group"><h3>${title}</h3><div class="quick-grid">${list
        .map((r) => {
          const p = r.product ? product(r.product) : null;
          const hint =
            p && toProduce[p.name] ? `Faltan ${num(toProduce[p.name])} kg` : "";
          return `<button class="quick-tile ${family}" data-action="quickOpen" data-recipe="${esc(r.id)}"><strong>${esc(r.name)}</strong>${p ? `<span>En stock: ${quickAmount(p.stock, p.unit)}</span>` : ""}${hint ? `<em>${esc(hint)}</em>` : ""}${r.ingredients.length ? "" : "<small>Sin ingredientes todavía</small>"}</button>`;
        })
        .join("")}</div></div>`;
    })
    .join("");
  return `<section class="panel quick-panel"><div class="panel-heading"><div><h2>Producir</h2><p>Toca un sabor, elige la tanda y pulsa «Hecho»: se descuentan los ingredientes y se suma el gelato al momento.</p></div></div><div class="quick-body">${groups}</div></section>`;
}

/** Tarjeta de un sabor: cantidades por tanda, stock, bases y «Hecho». */
function quickCard(recipeId) {
  const r = state.recipes.find((x) => x.id === recipeId);
  if (!r) return;
  const batches = r.batches?.length ? r.batches : defaultBatches;
  let kg = batches[0];
  const today = businessToday();
  const bases = r.ingredients.filter((i) => {
    const b = state.recipes.find((x) => x.product === i.product);
    return b && b.family === "base";
  });
  const draw = () => {
    // Lo ya escrito (día, otra cantidad, correcciones) se conserva al cambiar de tanda.
    const keepDate = $('#modal [name="date"]')?.value || today;
    const head = batches
      .map(
        (b) =>
          `<th class="num"><button type="button" class="quick-batch ${b === kg ? "on" : ""}" data-batch="${b}">${num(b)} kg</button></th>`,
      )
      .join("");
    const rows = r.ingredients
      .map((i) => {
        const p = product(i.product);
        const need = quickNeed(r, i, kg);
        const isBase = bases.some((b) => b.product === i.product);
        const mode = $(`#modal [name="base:${i.product}"]`)?.value;
        const short = !(isBase && mode === "now") && p.stock < need;
        return `<tr class="${short ? "quick-short" : ""}"><th>${esc(p.name)}${isBase ? ' <small class="pill neutral">Base</small>' : ""}</th>${batches
          .map(
            (b) =>
              `<td class="num ${b === kg ? "on" : ""}">${quickAmount(quickNeed(r, i, b), p.unit)}</td>`,
          )
          .join(
            "",
          )}<td class="num">${quickAmount(p.stock, p.unit)}${short ? `<br><small>quedará en ${quickAmount(p.stock - need, p.unit)}</small>` : ""}</td></tr>`;
      })
      .join("");
    const baseChoice = bases
      .map((i) => {
        const p = product(i.product);
        const need = quickNeed(r, i, kg);
        const current = $(`#modal [name="base:${i.product}"]`)?.value;
        const mode = current || (p.stock >= need ? "stock" : "now");
        return `<label class="field">${esc(p.name)} (${quickAmount(need, p.unit)})<select name="base:${esc(i.product)}">${options(
          [
            ["stock", `De la cámara (hay ${quickAmount(p.stock, p.unit)})`],
            ["now", "Hacerla ahora con esta tanda"],
          ],
          mode,
        )}</select></label>`;
      })
      .join("");
    const shorts = r.ingredients.filter((i) => {
      const p = product(i.product);
      const isBase = bases.some((b) => b.product === i.product);
      const mode = $(`#modal [name="base:${i.product}"]`)?.value;
      return !(isBase && mode === "now") && p.stock < quickNeed(r, i, kg);
    });
    $("#quick-body").innerHTML =
      `<div class="table-scroll"><table class="quick-table"><thead><tr><th>Ingrediente</th>${head}<th class="num">En stock</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th>Total</th>${batches.map((b) => `<td class="num ${b === kg ? "on" : ""}">${num(b)} kg</td>`).join("")}<td></td></tr></tfoot></table></div><div class="quick-other"><label class="field">Otra cantidad (kg)<input name="other" type="text" inputmode="decimal" autocomplete="off" placeholder="${num(kg)}"></label><label class="field">Día<input name="date" type="date" value="${esc(keepDate)}" required></label></div>${baseChoice ? `<div class="quick-bases"><strong>Bases</strong>${baseChoice}</div>` : ""}${shorts.length ? `<p class="ai-warning">Según la app no hay bastante de: ${shorts.map((i) => esc(product(i.product).name)).join(", ")}. Puedes hacerlo igual: quedará en negativo y te avisará para que lo cuentes.</p>` : ""}<details class="quick-fix"><summary>Corregir lo que de verdad se usó</summary>${r.ingredients
        .map((i) => {
          const p = product(i.product);
          return `<label class="field">${esc(p.name)} (${esc(p.unit)})<input name="fix:${esc(i.product)}" type="text" inputmode="decimal" autocomplete="off" placeholder="${num(Math.round(quickNeed(r, i, kg) * 1000) / 1000)}"></label>`;
        })
        .join(
          "",
        )}<p class="fineprint">En blanco, lo de la receta. En la unidad del ingrediente (kg o L).</p></details>`;
  };
  modal(
    r.name,
    `Elige la tanda (o escribe otra cantidad) y pulsa «Hecho». Se descuentan los ingredientes y se suma ${r.product ? "el gelato" : "lo hecho"} al momento.`,
    `<div id="quick-body"></div>`,
    async (f) => {
      const other = String(f.get("other") || "")
        .trim()
        .replace(",", ".");
      const quantity = other ? Number(other) : kg;
      if (!(quantity > 0) || quantity > 1000)
        throw Error("Escribe una cantidad entre 0 y 1000 kg.");
      const factor = quantity / kg;
      let corrected = false;
      const lines = r.ingredients.map((i) => {
        const raw = String(f.get("fix:" + i.product) || "")
          .trim()
          .replace(",", ".");
        if (raw) corrected = true;
        const q = raw ? Number(raw) : quickNeed(r, i, kg) * factor;
        if (!Number.isFinite(q) || q < 0)
          throw Error(`${product(i.product).name}: cantidad no válida.`);
        return { product: i.product, quantity: Math.round(q * 1000) / 1000 };
      });
      const saved = await mutate(
        {
          type: "produceNow",
          recipe: r.id,
          quantity: Math.round(quantity * 1000) / 1000,
          date: f.get("date"),
          ...(corrected ? { lines } : {}),
          bases: bases.map((i) => ({
            product: i.product,
            mode: f.get("base:" + i.product) === "now" ? "now" : "stock",
          })),
        },
        "",
      );
      if (!saved) return false;
      toast(state.activity[0]?.text || "Producción registrada.");
      return true;
    },
    "Hecho",
  );
  $("#modal").classList.add("wide");
  draw();
  $("#quick-body").addEventListener("click", (e) => {
    const b = e.target.closest("[data-batch]");
    if (!b) return;
    kg = Number(b.dataset.batch);
    const other = $('#modal [name="other"]');
    if (other) other.value = "";
    draw();
  });
  $("#quick-body").addEventListener("change", (e) => {
    if (e.target.name?.startsWith("base:")) draw();
  });
}

// Botones de la producción rápida. Devuelve true si la acción era suya.
function quickAction(name, el) {
  if (name === "quickOpen") {
    quickCard(el.dataset.recipe);
    return true;
  }
  if (name === "setBatchesUi") {
    const r = state.recipes.find((x) => x.id === el.dataset.id);
    modal(
      "Tandas de " + r.name,
      "Los kilos que se ven como columnas al producir este sabor. Separados por comas: 1, 4, 8, 16, 30, 60.",
      field(
        "Tandas (kg)",
        "batches",
        (r.batches?.length ? r.batches : defaultBatches).join(", "),
        "text",
        'required autocomplete="off"',
      ),
      async (f) => {
        // Las tandas se separan con comas (o espacios); un decimal, con punto: «0.5, 1, 4».
        const batches = String(f.get("batches") || "")
          .split(/[,;\s]+/)
          .filter(Boolean)
          .map(Number);
        if (!batches.length || batches.some((b) => !(b > 0 && b <= 1000)))
          throw Error(
            "Escribe kilos mayores que 0 separados por comas (un decimal, con punto: 0.5).",
          );
        if (batches.length > 12) throw Error("Como mucho 12 tandas.");
        return mutate(
          { type: "setBatches", recipe: r.id, batches },
          "Tandas guardadas.",
        );
      },
    );
    return true;
  }
  return false;
}
