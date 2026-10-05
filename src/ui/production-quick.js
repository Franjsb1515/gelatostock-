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
  return `<section class="panel quick-panel"><div class="panel-heading"><div><h2>Producir</h2><p>Toca un sabor y elige los kilos.</p></div></div><div class="quick-body">${groups}</div></section>`;
}

/** Kilos como se escriben en la casilla: 2.5 → «2,5». */
const quickKg = (n) => String(Math.round(n * 1000) / 1000).replace(".", ",");

/**
 * Pasos de «Preparar» para unos kilos: primero el orden guardado en la receta y después, uno a
 * uno, los ingredientes que ese orden no nombra (ninguno se queda fuera). Una base que se hace
 * ahora trae delante sus propios pasos.
 */
function quickSteps(r, kg, baseNow = () => false) {
  const steps = [];
  const add = (rec, amount, group, expand) => {
    const one = (i, text) => {
      const p = product(i.product);
      const need = quickNeed(rec, i, amount);
      const base = state.recipes.find(
        (x) => x.product === i.product && x.family === "base",
      );
      if (expand && base && baseNow(i)) {
        add(base, need, `Primero, la base: ${p.name}`, false);
        steps.push({
          group,
          name: p.name,
          amount: quickAmount(need, p.unit),
          text,
          tag: "La que acabas de hacer",
        });
        return;
      }
      steps.push({
        group,
        name: p.name,
        amount: quickAmount(need, p.unit),
        text,
        tag: expand && base ? "De la cámara" : "",
      });
    };
    const seen = new Set();
    for (const st of rec.process || []) {
      const i =
        st.product && rec.ingredients.find((x) => x.product === st.product);
      if (i) {
        seen.add(i.product);
        one(i, st.text || "");
      } else if (st.text)
        steps.push({ group, name: "", amount: "", text: st.text, tag: "" });
    }
    for (const i of rec.ingredients) if (!seen.has(i.product)) one(i, "");
  };
  add(r, kg, "", true);
  return steps;
}

/** Tarjeta de un sabor: kilos, cantidades por tanda, bases, «Preparar» paso a paso y «Hecho». */
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
  // Kilos escritos: null si la casilla está vacía, NaN si no es una cantidad válida.
  const typed = () => {
    const raw = String($('#modal [name="other"]')?.value || "")
      .trim()
      .replace(",", ".");
    if (!raw) return null;
    const n = Number(raw);
    return n > 0 && n <= 1000 ? n : NaN;
  };
  const baseMode = (i) => $(`#modal [name="base:${i.product}"]`)?.value;
  const short = (i, qty) =>
    !(bases.includes(i) && baseMode(i) === "now") &&
    product(i.product).stock < quickNeed(r, i, qty);
  // Solo se redibuja la tabla y los avisos: lo escrito (kilos, día, correcciones) no se toca.
  const draw = () => {
    const other = typed();
    const qty = other > 0 ? other : kg;
    const extra = !batches.includes(qty);
    const cols = extra ? [...batches, qty] : batches;
    const head = cols
      .map((b) =>
        extra && b === qty
          ? `<th class="num"><span class="quick-batch on">${num(b)} kg</span></th>`
          : `<th class="num"><button type="button" class="quick-batch ${b === qty ? "on" : ""}" data-batch="${b}">${num(b)} kg</button></th>`,
      )
      .join("");
    const rows = r.ingredients
      .map((i) => {
        const p = product(i.product);
        const need = quickNeed(r, i, qty);
        const isBase = bases.includes(i);
        const low = short(i, qty);
        return `<tr class="${low ? "quick-short" : ""}"><th>${esc(p.name)}${isBase ? ' <small class="pill neutral">Base</small>' : ""}</th>${cols
          .map(
            (b) =>
              `<td class="num ${b === qty ? "on" : ""}">${quickAmount(quickNeed(r, i, b), p.unit)}</td>`,
          )
          .join(
            "",
          )}<td class="num">${quickAmount(p.stock, p.unit)}${low ? `<br><small>faltan ${quickAmount(need - p.stock, p.unit)}</small>` : ""}</td></tr>`;
      })
      .join("");
    $("#quick-table").innerHTML =
      `<div class="table-scroll"><table class="quick-table"><thead><tr><th>Ingrediente</th>${head}<th class="num">En stock</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th>Total</th>${cols.map((b) => `<td class="num ${b === qty ? "on" : ""}">${num(b)} kg</td>`).join("")}<td></td></tr></tfoot></table></div>`;
    const baseChoice = bases
      .map((i) => {
        const p = product(i.product);
        const need = quickNeed(r, i, qty);
        const mode = baseMode(i) || (p.stock >= need ? "stock" : "now");
        return `<label class="field">${esc(p.name)} (${quickAmount(need, p.unit)})<select name="base:${esc(i.product)}">${options(
          [
            ["stock", `De la cámara (hay ${quickAmount(p.stock, p.unit)})`],
            ["now", "Hacerla ahora"],
          ],
          mode,
        )}</select></label>`;
      })
      .join("");
    const shorts = r.ingredients.filter((i) => short(i, qty));
    // La misma comprobación que al guardar la receta: «500 L» cuando eran 500 ml.
    const recipeMass = r.ingredients.reduce(
      (n, i) =>
        n + (["kg", "L"].includes(product(i.product).unit) ? i.quantity : 0),
      0,
    );
    const odd = r.yield > 0 && recipeMass > r.yield * 3;
    // Lo que se va a gastar con los kilos elegidos, de un vistazo.
    const spend = r.ingredients
      .map((i) => {
        const p = product(i.product);
        return `<span class="pill neutral">${esc(p.name)} ${quickAmount(quickNeed(r, i, qty), p.unit)}</span>`;
      })
      .join("");
    $("#quick-after").innerHTML =
      `${Number.isNaN(other) ? `<p class="ai-warning">Escribe los kilos: entre 0,1 y 1000.</p>` : ""}${odd ? `<p class="ai-warning">Revisa la receta: sus ingredientes suman ${num(recipeMass)} kg o L para ${num(r.yield)} kg. Si eran gramos o mililitros, corrígela en el Recetario.</p>` : ""}${spend ? `<p class="quick-spend"><strong>Para ${num(qty)} kg</strong>${spend}</p>` : ""}${baseChoice ? `<div class="quick-bases"><strong>Bases</strong>${baseChoice}</div>` : ""}${shorts.length ? `<p class="ai-warning">Falta según la app: ${shorts.map((i) => `${esc(product(i.product).name)} (${quickAmount(quickNeed(r, i, qty) - product(i.product).stock, product(i.product).unit)})`).join(", ")}. Puedes hacerlo igual: quedará en negativo hasta que lo cuentes.</p>` : ""}`;
    for (const i of r.ingredients) {
      const input = $(`#modal [name="fix:${i.product}"]`);
      if (input)
        input.placeholder = num(Math.round(quickNeed(r, i, qty) * 1000) / 1000);
    }
  };
  modal(
    r.name,
    r.ingredients.length
      ? "Elige los kilos. «Preparar» te guía paso a paso; «Hecho» lo registra."
      : "Elige los kilos y pulsa «Hecho».",
    `<div id="quick-body"><div id="quick-main"><div class="quick-other"><label class="field">Kilos a hacer<span class="stepper quick-stepper"><button type="button" class="step" data-kg="-0.5" aria-label="500 gramos menos">−</button><input class="quantity" name="other" type="text" inputmode="decimal" autocomplete="off" value="${quickKg(kg)}" aria-label="Kilos a hacer"><button type="button" class="step" data-kg="0.5" aria-label="500 gramos más">+</button></span></label><label class="field">Día<input name="date" type="date" value="${esc(today)}" required></label></div><div id="quick-table"></div><div id="quick-after"></div><details class="quick-fix"><summary>Usé otra cantidad de algún ingrediente</summary>${r.ingredients
      .map((i) => {
        const p = product(i.product);
        return `<label class="field">${esc(p.name)} (${esc(p.unit)})<input name="fix:${esc(i.product)}" type="text" inputmode="decimal" autocomplete="off"></label>`;
      })
      .join(
        "",
      )}<p class="fineprint">En blanco, lo de la receta.</p></details></div><div id="quick-prep" class="quick-off"></div></div>`,
    async (f) => {
      const other = typed();
      if (Number.isNaN(other))
        throw Error("Escribe los kilos: entre 0,1 y 1000.");
      const quantity = other ?? kg;
      let corrected = false;
      const lines = r.ingredients.map((i) => {
        const raw = String(f.get("fix:" + i.product) || "")
          .trim()
          .replace(",", ".");
        if (raw) corrected = true;
        const q = raw ? Number(raw) : quickNeed(r, i, quantity);
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
  const form = $("#modal-form");
  const submit = form.querySelector('button[type="submit"]');
  const other = $('#modal [name="other"]');
  // «Preparar»: la misma tarjeta enseña un paso cada vez; «Hecho» solo aparece al final.
  let steps = [];
  let at = 0;
  if (r.ingredients.length) {
    submit.className = "btn secondary";
    submit.insertAdjacentHTML(
      "beforebegin",
      '<button type="button" class="btn primary" id="quick-prep-go">Preparar</button>',
    );
  }
  const go = $("#quick-prep-go");
  const prep = (on) => {
    $("#quick-main").classList.toggle("quick-off", on);
    $("#quick-prep").classList.toggle("quick-off", !on);
    go?.classList.toggle("quick-off", on);
    const end = on && at >= steps.length;
    submit.className =
      "btn " +
      (!go || end ? "primary" : "secondary") +
      (on && !end ? " quick-off" : "");
    if (!on) return;
    const qty = typed() || kg;
    const st = steps[at];
    $("#quick-prep").innerHTML = end
      ? `<div class="quick-step done"><span class="quick-step-count">Todo añadido</span><strong class="quick-step-amount">${num(qty)} kg</strong><p class="quick-step-text">Pulsa «Hecho» para registrarlo: se descuentan los ingredientes y se suma ${r.product ? "el gelato" : "lo hecho"}.</p></div><div class="quick-step-nav"><button type="button" class="btn secondary" data-prep="-1">← Anterior</button></div>`
      : `<div class="quick-step"><span class="quick-step-count">Paso ${at + 1} de ${steps.length}${st.group ? " · " + esc(st.group) : ""}</span>${st.name ? `<span class="quick-step-name">${esc(st.name)}${st.tag ? ` <small class="pill neutral">${esc(st.tag)}</small>` : ""}</span><strong class="quick-step-amount">${st.amount}</strong>` : ""}${st.text ? `<p class="quick-step-text">${esc(st.text)}</p>` : ""}</div><div class="quick-step-nav"><button type="button" class="btn secondary" data-prep="${at ? "-1" : "table"}">${at ? "← Anterior" : "← Volver a la tabla"}</button><button type="button" class="btn primary" data-prep="1">${at + 1 < steps.length ? "Siguiente →" : "Listo →"}</button></div>`;
  };
  draw();
  form.addEventListener("click", (e) => {
    const b = e.target.closest(
      "[data-batch],[data-kg],[data-prep],#quick-prep-go",
    );
    if (!b) return;
    if (b.dataset.batch) {
      kg = Number(b.dataset.batch);
      other.value = quickKg(kg);
      draw();
    } else if (b.dataset.kg) {
      // De 500 g en 500 g, cayendo siempre en un múltiplo de medio kilo.
      const now = typed() || kg;
      const up = Number(b.dataset.kg) > 0;
      const next = up
        ? Math.floor(now / 0.5 + 1e-9) * 0.5 + 0.5
        : Math.ceil(now / 0.5 - 1e-9) * 0.5 - 0.5;
      other.value = quickKg(Math.min(1000, Math.max(0.5, next)));
      draw();
    } else if (b.id === "quick-prep-go") {
      if (Number.isNaN(typed())) {
        $("#form-error").textContent = "Escribe los kilos: entre 0,1 y 1000.";
        return;
      }
      $("#form-error").textContent = "";
      steps = quickSteps(
        r,
        typed() || kg,
        (i) => bases.includes(i) && baseMode(i) === "now",
      );
      at = 0;
      prep(true);
    } else if (b.dataset.prep === "table") prep(false);
    else {
      at = Math.max(0, Math.min(steps.length, at + Number(b.dataset.prep)));
      prep(true);
    }
  });
  other.addEventListener("focus", () => other.select());
  $("#quick-body").addEventListener("input", (e) => {
    if (e.target.name === "other") draw();
  });
  $("#quick-body").addEventListener("change", (e) => {
    if (e.target.name?.startsWith("base:")) draw();
  });
}

/** Orden de preparación de una receta: pasos con un ingrediente, una instrucción o las dos cosas. */
function processEditor(r) {
  let rows = r.process?.length
    ? r.process.map((x) => ({ product: x.product || "", text: x.text || "" }))
    : r.ingredients.map((i) => ({ product: i.product, text: "" }));
  const choices = [
    ["", "Sin ingrediente (solo la instrucción)"],
    ...r.ingredients.map((i) => [i.product, product(i.product).name]),
  ];
  const read = () => {
    rows = [...document.querySelectorAll("#proc-rows .proc-row")].map(
      (row) => ({
        product: row.querySelector("select").value,
        text: row.querySelector("input").value.trim(),
      }),
    );
  };
  const draw = () => {
    $("#proc-rows").innerHTML = rows
      .map(
        (x, n) =>
          `<div class="proc-row"><span class="proc-n">${n + 1}</span><select aria-label="Ingrediente del paso ${n + 1}">${options(choices, x.product)}</select><input type="text" maxlength="300" autocomplete="off" value="${esc(x.text)}" placeholder="Qué hacer (opcional): calentar a 45 °C" aria-label="Instrucción del paso ${n + 1}"><span class="proc-tools"><button type="button" class="step" data-proc="up" data-n="${n}" aria-label="Subir el paso ${n + 1}" ${n ? "" : "disabled"}>↑</button><button type="button" class="step" data-proc="down" data-n="${n}" aria-label="Bajar el paso ${n + 1}" ${n + 1 < rows.length ? "" : "disabled"}>↓</button><button type="button" class="step" data-proc="del" data-n="${n}" aria-label="Quitar el paso ${n + 1}">✕</button></span></div>`,
      )
      .join("");
  };
  modal(
    "Orden de preparación · " + r.name,
    "Los pasos que se verán, uno a uno, al pulsar «Preparar». Las cantidades salen de la receta.",
    `<div id="proc-rows"></div><button type="button" class="btn secondary" data-proc="add">${icon("plus")} Añadir paso</button><p class="fineprint">Un ingrediente sin paso se enseña al final. Sin pasos, se sigue el orden de la receta.</p>`,
    async () => {
      read();
      const steps = rows
        .filter((x) => x.product || x.text)
        .map((x) => ({
          ...(x.product ? { product: x.product } : {}),
          text: x.text,
        }));
      const used = steps.flatMap((x) => (x.product ? [x.product] : []));
      if (new Set(used).size !== used.length)
        throw Error("Un ingrediente solo puede ir en un paso.");
      return mutate(
        { type: "setProcess", recipe: r.id, steps },
        "Orden de preparación guardado.",
      );
    },
  );
  $("#modal").classList.add("wide");
  draw();
  $("#modal-form").addEventListener("click", (e) => {
    const b = e.target.closest("[data-proc]");
    if (!b) return;
    read();
    const n = Number(b.dataset.n);
    if (b.dataset.proc === "add") rows.push({ product: "", text: "" });
    if (b.dataset.proc === "del") rows.splice(n, 1);
    if (b.dataset.proc === "up") rows.splice(n - 1, 2, rows[n], rows[n - 1]);
    if (b.dataset.proc === "down") rows.splice(n, 2, rows[n + 1], rows[n]);
    draw();
  });
}

// Botones de la producción rápida. Devuelve true si la acción era suya.
function quickAction(name, el) {
  if (name === "quickOpen") {
    quickCard(el.dataset.recipe);
    return true;
  }
  if (name === "processEdit") {
    processEditor(state.recipes.find((x) => x.id === el.dataset.id));
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
