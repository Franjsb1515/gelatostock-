// Tabla de ingredientes (Inventario): la composición de cada ingrediente leída de un PDF de la
// persona. Es una biblioteca: desde aquí se añaden ingredientes al inventario con su composición
// o se pone la de una fila en un producto que ya existe. Nada se guarda sin confirmar y lo que la
// tabla no trae se enseña como «—», nunca como 0.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
let ingredientsOpen = false;
let ingredientsPicked = new Set();
const compKeys = [
  ["sugars", "Azúcar"],
  ["fat", "Grasas"],
  ["msnf", "Sólidos lácteos no grasos"],
  ["otherSolids", "Otros sólidos"],
  ["solids", "Sólidos totales"],
  ["water", "Agua"],
  ["lactose", "Lactosa"],
  ["milkProtein", "Proteína de leche"],
  ["minerals", "Sales minerales"],
  ["protein", "Proteínas totales"],
  ["fiber", "Fibras"],
  ["pacSugars", "PAC de los azúcares"],
  ["pac", "PAC total"],
  ["pod", "POD"],
];
// PAC y POD son índices, no tantos por ciento.
const compIndex = ["pacSugars", "pac", "pod"];
const compShown = ["sugars", "fat", "msnf", "solids", "water", "pac", "pod"];
// Cabeceras cortas para que la tabla quepa; el nombre entero está en «Ver todo».
const compShort = { msnf: "Lácteos sin grasa", solids: "Sólidos", pac: "PAC" };
const ingFold = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const compValue = (c, k) =>
  c?.[k] === undefined ? "—" : num(c[k]) + (compIndex.includes(k) ? "" : " %");
/** El producto del inventario que se llama igual que la fila, si lo hay. */
const ingProduct = (e) =>
  state.products.find((p) => ingFold(p.name) === ingFold(e.name));
const ingSame = (e, p) =>
  compKeys.every(([k]) => p.composition?.[k] === e.composition[k]);

function ingredientsView() {
  const table = state.ingredientTable || [];
  ingredientsPicked = new Set(
    [...ingredientsPicked].filter((id) => table.some((e) => e.id === id)),
  );
  const head =
    header(
      "Tabla de ingredientes",
      "La composición de cada ingrediente, por 100 g, tal como viene en tu tabla.",
      btn("← Inventario", "ingredientsBack", "secondary") +
        btn(
          icon("plus") + " Subir tabla",
          "ingredientsUpload",
          table.length ? "secondary" : "primary",
        ),
    ) + "";
  if (!table.length)
    return (
      head +
      `<div class="empty">${icon("box")}<h3>Todavía no hay ninguna tabla.</h3><p>Sube el PDF con la composición de tus ingredientes (azúcar, grasas, sólidos, PAC, POD…). Se lee tal cual: no se rellena ni se corrige nada.</p></div>`
    );
  const sources = [...new Set(table.map((e) => e.source))];
  const flagged = table.filter((e) => e.issues.length).length;
  const inStock = table.filter((e) => ingProduct(e)).length;
  const rows = [...table]
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((e) => {
      const p = ingProduct(e);
      const same = p && ingSame(e, p);
      const status = !p
        ? `<label class="check-label ing-pick"><input type="checkbox" data-ing-pick="${esc(e.id)}" ${ingredientsPicked.has(e.id) ? "checked" : ""} aria-label="Marcar ${esc(e.name)} para añadirlo al inventario"> Añadir</label>`
        : same
          ? pill("En el inventario", "sage")
          : `${pill("En el inventario, con otra composición", "sand")} ${btn("Usar la de la tabla", "ingredientsApply", "text-link", `data-entry="${esc(e.id)}" data-product="${esc(p.id)}"`)}`;
      return `<tr data-ing-row data-name="${esc(ingFold(e.name))}" data-in="${p ? "1" : "0"}" data-flag="${e.issues.length ? "1" : "0"}"><td><strong>${esc(e.name)}</strong>${e.issues.length ? `<small class="ing-issue">${e.issues.map(esc).join(" ")}</small>` : ""}</td><td class="ing-status">${status}</td>${compShown.map((k) => `<td class="num">${compValue(e.composition, k)}</td>`).join("")}<td class="row-tools"><button class="text-link" data-action="ingredientsDetail" data-entry="${esc(e.id)}">Ver todo</button></td></tr>`;
    })
    .join("");
  const label = Object.fromEntries(compKeys);
  return (
    head +
    `<section class="panel ing-panel"><div class="toolbar"><div class="tabs">${[
      ["all", `Todos <span>${table.length}</span>`],
      ["out", `Fuera del inventario <span>${table.length - inStock}</span>`],
      ["in", `En el inventario <span>${inStock}</span>`],
      ["flag", `Con aviso <span>${flagged}</span>`],
    ]
      .map(
        ([v, t], i) =>
          `<button type="button" class="tab ${i ? "" : "selected"}" data-ing-filter="${v}">${t}</button>`,
      )
      .join(
        "",
      )}</div><label class="search">${icon("search")}<input id="ing-search" placeholder="Buscar ingrediente…" aria-label="Buscar ingrediente"></label></div><div class="ing-bar"><span id="ing-count">${ingredientsPicked.size} marcados</span>${btn("Marcar los que se ven", "ingredientsPickAll", "secondary")}${btn("Quitar marcas", "ingredientsPickNone", "secondary")}${btn(icon("plus") + " Añadir los marcados al inventario", "ingredientsAdd", "primary")}</div><div class="table-wrap"><table class="ing-table"><thead><tr><th>Ingrediente</th><th>Inventario</th>${compShown.map((k) => `<th class="num">${esc(compShort[k] || label[k])}</th>`).join("")}<th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${table.length} ingredientes · de ${sources.map((s) => "«" + esc(s) + "»").join(", ")} ${btn("Vaciar la tabla", "ingredientsClear", "text-link")}</div></section>`
  );
}

/** Enseña u oculta filas según la pestaña y la búsqueda, sin redibujar (no se pierden las marcas). */
function ingredientsFilter() {
  const q = ingFold($("#ing-search")?.value || "");
  const tab =
    document.querySelector("[data-ing-filter].selected")?.dataset.ingFilter ||
    "all";
  for (const tr of document.querySelectorAll("[data-ing-row]")) {
    const show =
      tr.dataset.name.includes(q) &&
      (tab === "all" ||
        (tab === "in" && tr.dataset.in === "1") ||
        (tab === "out" && tr.dataset.in === "0") ||
        (tab === "flag" && tr.dataset.flag === "1"));
    tr.classList.toggle("quick-off", !show);
  }
}
const ingredientsCount = () => {
  const el = $("#ing-count");
  if (el)
    el.textContent = `${ingredientsPicked.size} ${ingredientsPicked.size === 1 ? "marcado" : "marcados"}`;
};

/** Subir el PDF: la app enseña lo que ha leído y lo dudoso; se guarda solo al confirmar. */
function ingredientsUploadModal() {
  let reading = null,
    data = "",
    name = "";
  modal(
    "Subir la tabla de ingredientes",
    "Un PDF con una fila por ingrediente y sus columnas. Se lee en este equipo; no se guarda nada hasta que pulses el botón.",
    `<label class="upload-zone">${icon("photo")}<strong>Elige el PDF</strong><span>Hasta 10 MB</span><input name="pdf" type="file" accept="application/pdf,.pdf" required></label><div id="ing-proposal" role="status"></div>`,
    async () => {
      if (!reading?.rows.length)
        throw Error("Elige un PDF con una tabla de ingredientes.");
      const saved = await request("/api/ingredients/table", {
        data,
        name,
        confirm: true,
        revision: state.revision,
      });
      state = saved.state;
      ingredientsOpen = true;
      render();
      toast(state.activity[0]?.text || "Tabla guardada.");
      return true;
    },
    "Guardar la tabla",
  );
  $("#modal").classList.add("wide");
  const box = $("#ing-proposal");
  $('#modal [name="pdf"]').addEventListener("change", (e) => {
    const file = e.target.files[0];
    reading = null;
    if (!file) return;
    if (file.size > 10_000_000) {
      box.innerHTML = '<p class="ai-warning">El PDF supera 10 MB.</p>';
      return;
    }
    box.textContent = "Leyendo la tabla…";
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        data = String(reader.result);
        name = file.name;
        const r = await request("/api/ingredients/table", { data, name });
        reading = r.table;
        const t = r.table;
        if (!t.rows.length) {
          box.innerHTML = `<p class="ai-warning">${esc(t.reason || "No se ha podido leer ninguna fila.")}</p>`;
          return;
        }
        const flagged = t.rows.filter((x) => x.issues.length);
        const known = t.rows.filter((x) => ingProduct(x)).length;
        box.innerHTML = `<p><strong>${t.rows.length} ingredientes</strong> en ${r.pages} ${r.pages === 1 ? "página" : "páginas"}, con ${t.columns.length} columnas. ${known ? `${known} ${known === 1 ? "se llama" : "se llaman"} igual que un producto de tu inventario. ` : ""}Guardar la tabla no cambia el inventario ni el stock.</p>${flagged.length ? `<div class="ai-warning"><p>${flagged.length} con aviso (se guardan tal cual, sin corregir):</p><ul>${flagged.map((x) => `<li><strong>${esc(x.name)}</strong>: ${x.issues.map(esc).join(" ")}</li>`).join("")}</ul></div>` : ""}${t.skipped.length ? `<div class="ai-warning"><p>No se guarda:</p><ul>${t.skipped.map((x) => `<li>Página ${x.page}: ${esc(x.text)}. ${esc(x.reason)}</li>`).join("")}</ul></div>` : ""}${r.truncated ? '<p class="ai-warning">El PDF tiene más de 50 páginas: solo se leen las 50 primeras.</p>' : ""}<details><summary>Ver las ${t.rows.length} filas leídas</summary><div class="table-wrap"><table class="ing-table"><thead><tr><th>Ingrediente</th>${compKeys.map(([, l]) => `<th class="num">${esc(l)}</th>`).join("")}</tr></thead><tbody>${t.rows.map((x) => `<tr><td>${esc(x.name)}</td>${compKeys.map(([k]) => `<td class="num">${compValue(x.composition, k)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
      } catch (err) {
        box.innerHTML = `<p class="ai-warning">${esc(err.message)}</p>`;
      }
    };
    reader.readAsDataURL(file);
  });
}

// Botones de la tabla de ingredientes. Devuelve true si la acción era suya.
function ingredientsAction(name, el) {
  if (name === "ingredientsShow" || name === "ingredientsBack") {
    ingredientsOpen = name === "ingredientsShow";
    render();
    window.scrollTo(0, 0);
    return true;
  }
  if (name === "ingredientsUpload") {
    ingredientsUploadModal();
    return true;
  }
  if (name === "ingredientsPickAll" || name === "ingredientsPickNone") {
    for (const box of document.querySelectorAll("[data-ing-pick]")) {
      const visible = !box.closest("tr").classList.contains("quick-off");
      if (name === "ingredientsPickNone") box.checked = false;
      else if (visible) box.checked = true;
      if (box.checked) ingredientsPicked.add(box.dataset.ingPick);
      else ingredientsPicked.delete(box.dataset.ingPick);
    }
    ingredientsCount();
    return true;
  }
  if (name === "ingredientsDetail") {
    const e = state.ingredientTable.find((x) => x.id === el.dataset.entry);
    modal(
      e.name,
      `Por 100 g, según «${e.source}», página ${e.page}.`,
      `${e.issues.length ? `<p class="ai-warning">${e.issues.map(esc).join(" ")}</p>` : ""}<dl class="ing-detail">${compKeys.map(([k, l]) => `<div><dt>${esc(l)}</dt><dd>${e.composition[k] === undefined ? "No disponible" : compValue(e.composition, k)}</dd></div>`).join("")}</dl>${select(
        "Poner esta composición en un producto del inventario",
        "product",
        [
          ["", "No, solo mirar"],
          ...state.products
            .filter((p) => p.unit !== "ud")
            .map((p) => [p.id, p.name]),
        ],
        "",
      )}<p class="fineprint">Sustituye la composición que tenga ese producto. No cambia su stock ni su precio.</p>`,
      async (f) =>
        f.get("product")
          ? mutate(
              {
                type: "applyTableComposition",
                entry: e.id,
                product: f.get("product"),
              },
              "Composición puesta en el producto.",
            )
          : true,
      "Aceptar",
    );
    return true;
  }
  if (name === "ingredientsApply") {
    const e = state.ingredientTable.find((x) => x.id === el.dataset.entry);
    const p = product(el.dataset.product);
    modal(
      "Usar la composición de la tabla",
      `«${p.name}» ya está en el inventario con otra composición. Se sustituye por la de la tabla; el stock y el precio no cambian.`,
      `<div class="table-wrap"><table class="ing-table"><thead><tr><th></th><th class="num">Ahora</th><th class="num">Tabla</th></tr></thead><tbody>${compKeys
        .filter(
          ([k]) =>
            p.composition?.[k] !== undefined || e.composition[k] !== undefined,
        )
        .map(
          ([k, l]) =>
            `<tr class="${p.composition?.[k] === e.composition[k] ? "" : "ing-diff"}"><th>${esc(l)}</th><td class="num">${compValue(p.composition, k)}</td><td class="num">${compValue(e.composition, k)}</td></tr>`,
        )
        .join("")}</tbody></table></div>`,
      async () =>
        mutate(
          { type: "applyTableComposition", entry: e.id, product: p.id },
          "Composición puesta en el producto.",
        ),
      "Usar la de la tabla",
    );
    return true;
  }
  if (name === "ingredientsAdd") {
    const picked = state.ingredientTable.filter(
      (e) => ingredientsPicked.has(e.id) && !ingProduct(e),
    );
    if (!picked.length) {
      toast("Marca primero los ingredientes que quieres añadir.");
      return true;
    }
    if (!state.suppliers.length) {
      toast("Crea antes un proveedor: cada producto necesita uno.");
      return true;
    }
    modal(
      `Añadir ${picked.length} ${picked.length === 1 ? "ingrediente" : "ingredientes"} al inventario`,
      "Entran con su composición, stock 0 y sin precio. La tabla no dice proveedor, categoría, unidad ni zona: elígelos tú. Valen para todos los marcados; si no son iguales, añádelos por tandas.",
      `<p class="ing-names">${picked
        .slice(0, 12)
        .map((e) => esc(e.name))
        .join(
          " · ",
        )}${picked.length > 12 ? ` · y ${picked.length - 12} más` : ""}</p><div class="form-grid">${[
        ["Proveedor", "supplier", state.suppliers.map((x) => [x.id, x.name])],
        [
          "Categoría",
          "category",
          ["Gelatería", "Cafetería", "Postres", "Envases"].map((c) => [c, c]),
        ],
        [
          "Se mide en",
          "unit",
          [
            ["kg", "Kilos"],
            ["L", "Litros"],
          ],
        ],
        ["Zona de conteo", "zone", Object.entries(zoneLabel)],
      ]
        .map(
          ([l, n, items]) =>
            `<label class="field">${l}<select name="${n}" required>${options([["", "Elige…"], ...items], "")}</select></label>`,
        )
        .join("")}</div>`,
      async (f) => {
        const saved = await mutate(
          {
            type: "addTableProducts",
            entries: picked.map((e) => e.id),
            supplier: f.get("supplier"),
            category: f.get("category"),
            unit: f.get("unit"),
            zone: f.get("zone"),
          },
          "",
        );
        if (!saved) return false;
        ingredientsPicked = new Set();
        toast(state.activity[0]?.text || "Ingredientes añadidos.");
        return true;
      },
      "Añadir al inventario",
    );
    return true;
  }
  if (name === "ingredientsClear") {
    modal(
      "Vaciar la tabla de ingredientes",
      "Se quitan las filas de la tabla. Los productos del inventario conservan su composición.",
      "",
      async () => {
        const saved = await mutate(
          { type: "clearIngredientTable" },
          "Tabla vaciada.",
        );
        if (saved) ingredientsPicked = new Set();
        return saved;
      },
      "Vaciar",
    );
    return true;
  }
  return false;
}

document.addEventListener("input", (e) => {
  if (e.target.id === "ing-search") ingredientsFilter();
});
document.addEventListener("change", (e) => {
  const id = e.target.dataset?.ingPick;
  if (!id) return;
  if (e.target.checked) ingredientsPicked.add(id);
  else ingredientsPicked.delete(id);
  ingredientsCount();
});
document.addEventListener("click", (e) => {
  const tab = e.target.closest?.("[data-ing-filter]");
  if (!tab) return;
  for (const t of document.querySelectorAll("[data-ing-filter]"))
    t.classList.toggle("selected", t === tab);
  ingredientsFilter();
});
