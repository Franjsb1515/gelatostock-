// Precios por proveedor (Compras): la lista de precios de la persona, leída de su PDF y ordenada
// para comparar a quién sale más barato cada ingrediente. La app solo ordena lo que dice la
// lista: no sabe de marcas, formatos ni calidades, y no cambia ningún precio sin confirmación.
// La comparación la hace el núcleo (core/pricelist.ts) y viaja en el sobre de estado.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
let priceListOpen = false,
  priceCompare = null,
  priceTab = "all",
  priceQuery = "",
  pricePicked = new Set();
const PRICE_UNIT = "por litro, kilo o unidad";
const priceFold = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const pricePct = (n) => String(n).replace(".", ",") + " %";
const priceText = (r) =>
  r.cents === null
    ? "No disponible"
    : money(r.cents) + (r.cents === 0 ? " · dudoso" : "");
const priceGroupMatches = (g) =>
  (priceTab === "all" ||
    (priceTab === "star" && g.star) ||
    (priceTab === "multi" && g.suppliers > 1)) &&
  g.rows.some((r) =>
    priceFold(r.name + " " + (r.supplier || "")).includes(
      priceFold(priceQuery),
    ),
  );

function priceRecommendation(g) {
  if (!g.cheapest) {
    const priced = g.rows.filter((r) => r.compared).length;
    return `<p class="price-rec muted">${priced ? "Solo hay un proveedor con precio: no hay nada que comparar." : "Sin precio de ningún proveedor en la lista."}</p>`;
  }
  return `<p class="price-rec"><strong>Más barato: ${esc(g.cheapest.supplier)} a ${money(g.cheapest.cents)}</strong> ${PRICE_UNIT}${g.next ? `; el siguiente (${esc(g.next.supplier)}, ${money(g.next.cents)}) cuesta un ${pricePct(g.next.pct)} más` : ""}.</p><p class="fineprint">Diferencia entre el más caro y el más barato: ${money(g.saving.dearest)} − ${money(g.cheapest.cents)} = ${money(g.saving.cents)}, un ${pricePct(g.saving.pct)} del más caro.</p>`;
}
function priceGroupCard(g) {
  const first = g.rows[0];
  const rows = g.rows
    .map(
      (r) =>
        `<tr class="${r.cheapest ? "price-best" : ""}"><td class="price-pick"><input type="checkbox" data-price-pick="${esc(r.id)}" ${pricePicked.has(r.id) ? "checked" : ""} aria-label="Marcar ${esc(r.name)}${r.supplier ? " de " + esc(r.supplier) : ""} para juntar"></td><td><strong>${esc(r.supplier || "Proveedor: No disponible")}</strong><small>${esc(r.name)} · página ${r.page}</small></td><td class="num"><strong>${priceText(r)}</strong>${r.cheapest ? pill("Más barato", "sage") : ""}${r.issues.length ? `<small class="price-issue">${r.issues.map(esc).join(" ")}</small>` : ""}</td><td class="row-tools">${r.compared ? btn("Usar este precio…", "priceUse", "secondary", `data-row="${esc(r.id)}"`) : ""}${g.joined.length ? btn("Separar", "priceUnlink", "secondary", `data-row="${esc(r.id)}"`) : ""}</td></tr>`,
    )
    .join("");
  return `<article class="panel price-group" data-price-group="${esc(g.key)}" ${priceGroupMatches(g) ? "" : "hidden"}><header><div><h3>${esc(g.name)}</h3>${g.suppliers > 1 ? pill(g.suppliers + " proveedores con precio", "lavender") : ""}</div><button type="button" class="btn ${g.star ? "primary" : "secondary"} price-star" data-action="priceStar" data-row="${esc(first.id)}" data-star="${g.star ? "0" : "1"}" aria-pressed="${g.star}">${g.star ? "★ Ingrediente estrella" : "☆ Marcar como estrella"}</button></header>${g.joined.length ? `<p class="ai-warning">Juntados por ti: ${g.joined.map(esc).join(" · ")}. La lista no dice que sean lo mismo: comprueba que la marca y el formato te valen.</p>` : ""}${priceRecommendation(g)}<div class="table-wrap"><table class="price-table"><thead><tr><th><span class="sr-only">Juntar</span></th><th>Proveedor</th><th class="num">Precio ${PRICE_UNIT}</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}
function priceListView() {
  const c = priceCompare || {
    groups: [],
    house: [],
    totals: {
      rows: 0,
      suppliers: 0,
      groups: 0,
      comparable: 0,
      stars: 0,
      sources: [],
    },
  };
  const has = c.totals.rows > 0;
  const live = new Set(c.groups.flatMap((g) => g.rows.map((r) => r.id)));
  pricePicked = new Set([...pricePicked].filter((id) => live.has(id)));
  const head = header(
    "Precios por proveedor",
    "Lo que cuesta cada ingrediente con cada proveedor, tal como viene en tu lista.",
    btn("← Compras", "priceBack", "secondary") +
      btn(
        icon("plus") + (has ? " Subir otra lista" : " Subir lista de precios"),
        "priceUpload",
        has ? "secondary" : "primary",
      ),
  );
  if (!has)
    return `<div class="price">${head}<div class="empty">${icon("cart")}<h3>Todavía no hay ninguna lista de precios.</h3><p>Sube el PDF con tus ingredientes, a qué proveedor se compra cada uno y lo que cuesta. Se lee tal cual: lo que la lista no trae se queda en «No disponible».</p></div></div>`;
  const shown = c.groups.filter(priceGroupMatches).length;
  const tabs = [
    ["all", `Todos <span>${c.totals.groups}</span>`],
    ["star", `Solo estrella <span>${c.totals.stars}</span>`],
    ["multi", `Con varios proveedores <span>${c.totals.comparable}</span>`],
  ]
    .map(
      ([v, t]) =>
        `<button type="button" class="tab ${priceTab === v ? "selected" : ""}" data-action="priceTab" data-tab="${v}">${t}</button>`,
    )
    .join("");
  return `<div class="price">${head}<div class="notice">${icon("shield")}<div><strong>${c.totals.rows} filas de ${c.totals.suppliers} proveedores · ${c.totals.sources.map((x) => "«" + esc(x) + "»").join(", ")}</strong><span>El precio es ${PRICE_UNIT}, como lo escribe la lista (no dice cuál). Aquí solo se ordenan esos precios: la lista no dice nada de marcas, formatos ni calidad. Ningún precio de tus productos cambia hasta que tú lo confirmas.</span></div></div><section class="panel price-panel"><div class="toolbar"><div class="tabs">${tabs}</div><label class="search">${icon("search")}<input id="price-search" placeholder="Buscar ingrediente o proveedor…" aria-label="Buscar ingrediente o proveedor" value="${esc(priceQuery)}"></label></div><div class="price-bar"><span id="price-count">${pricePicked.size} marcadas</span>${btn("Es el mismo ingrediente: juntar las marcadas", "priceJoin", "secondary")}<small>Solo se juntan solos los nombres idénticos. Lo demás lo decides tú marcando las filas.</small>${btn("Vaciar la lista", "priceClear", "secondary")}</div><p class="fineprint" id="price-shown">${shown} de ${c.totals.groups} ingredientes a la vista. Primero los que marcaste con estrella, luego donde más diferencia hay entre proveedores y después por nombre.</p></section><div class="price-groups">${c.groups.map(priceGroupCard).join("")}</div><p class="panel empty compact" id="price-none" ${shown ? "hidden" : ""}>Ningún ingrediente con esa búsqueda.</p>${
    c.house.length
      ? `<details class="panel price-house"><summary>Hecho en casa · ${c.house.length}</summary><p class="fineprint">No son compras: es lo que cuesta cada elaboración de la casa según tu lista. No se comparan con ningún proveedor.</p><div class="table-wrap"><table class="price-table"><thead><tr><th>Elaboración</th><th class="num">Coste ${PRICE_UNIT}</th></tr></thead><tbody>${c.house.map((r) => `<tr><td><strong>${esc(r.name)}</strong><small>página ${r.page}</small></td><td class="num"><strong>${priceText(r)}</strong>${r.issues.length ? `<small class="price-issue">${r.issues.map(esc).join(" ")}</small>` : ""}</td></tr>`).join("")}</tbody></table></div></details>`
      : ""
  }</div>`;
}
/** Enseña u oculta ingredientes según la búsqueda, sin redibujar (no se pierde lo escrito). */
function priceFilter() {
  if (!priceCompare) return;
  let shown = 0;
  for (const g of priceCompare.groups) {
    const el = document.querySelector(
      `[data-price-group="${CSS.escape(g.key)}"]`,
    );
    if (!el) continue;
    el.hidden = !priceGroupMatches(g);
    if (!el.hidden) shown++;
  }
  const none = $("#price-none");
  if (none) none.hidden = shown > 0;
  const label = $("#price-shown");
  if (label)
    label.textContent = `${shown} de ${priceCompare.groups.length} ingredientes a la vista.`;
}
document.addEventListener("input", (e) => {
  if (e.target.id !== "price-search") return;
  priceQuery = e.target.value;
  priceFilter();
});
document.addEventListener("change", (e) => {
  const id = e.target.dataset?.pricePick;
  if (!id) return;
  if (e.target.checked) pricePicked.add(id);
  else pricePicked.delete(id);
  const el = $("#price-count");
  if (el)
    el.textContent = `${pricePicked.size} ${pricePicked.size === 1 ? "marcada" : "marcadas"}`;
});
const priceRowOf = (id) => {
  for (const g of priceCompare?.groups || []) {
    const row = g.rows.find((r) => r.id === id);
    if (row) return { row, group: g };
  }
  return null;
};
/** Cambia algo de la lista sin que la pantalla salte arriba. */
async function priceMutate(a, msg) {
  const y = window.scrollY;
  const inner = $("main")?.scrollTop || 0;
  const ok = await mutate(a, msg);
  window.scrollTo(0, y);
  if ($("main")) $("main").scrollTop = inner;
  return ok;
}

/** Subir el PDF: la app enseña lo que ha leído y lo dudoso; se guarda solo al confirmar. */
function priceUploadModal() {
  let reading = null,
    data = "",
    name = "";
  modal(
    "Subir la lista de precios",
    "Un PDF con una fila por ingrediente: nombre, proveedor y lo que cuesta. Se lee en este equipo; no se guarda nada hasta que pulses el botón.",
    `<label class="upload-zone">${icon("photo")}<strong>Elige el PDF</strong><span>Hasta 10 MB</span><input name="pdf" type="file" accept="application/pdf,.pdf" required></label>${(state.priceList || []).length ? `<label class="check-label"><input type="checkbox" name="replace" checked> Sustituir la lista guardada (${[...new Set(state.priceList.map((x) => x.source))].map((x) => "«" + esc(x) + "»").join(", ")}). Sin marcar, las filas de las dos listas se comparan juntas.</label>` : ""}<div id="price-proposal" role="status"></div>`,
    async (f) => {
      if (!reading?.rows.length)
        throw Error("Elige un PDF con una lista de precios.");
      const saved = await request("/api/pricelist", {
        data,
        name,
        replace: f.get("replace") === "on",
        confirm: true,
        revision: state.revision,
      });
      applyEnvelope(saved);
      priceListOpen = true;
      render();
      toast(state.activity[0]?.text || "Lista guardada.");
      return true;
    },
    "Guardar la lista",
  );
  $("#modal").classList.add("wide");
  const box = $("#price-proposal");
  $('#modal [name="pdf"]').addEventListener("change", (e) => {
    const file = e.target.files[0];
    reading = null;
    if (!file) return;
    if (file.size > 10_000_000) {
      box.innerHTML = '<p class="ai-warning">El PDF supera 10 MB.</p>';
      return;
    }
    box.textContent = "Leyendo la lista…";
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        data = String(reader.result);
        name = file.name;
        const r = await request("/api/pricelist", { data, name });
        reading = r.reading;
        const t = r.reading,
          n = r.summary;
        if (!t.rows.length) {
          box.innerHTML = `<p class="ai-warning">${esc(t.reason || "No se ha podido leer ninguna fila.")}</p>`;
          return;
        }
        const doubtful = t.rows.filter((x) => x.issues.length);
        const fact = (value, label) =>
          `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
        box.innerHTML = `<p><strong>${n.rows} filas</strong> en ${r.pages} ${r.pages === 1 ? "página" : "páginas"}. Guardar la lista no cambia tus productos, sus precios ni el stock.</p><dl class="ing-detail price-facts">${fact(n.rows, "Filas leídas")}${fact(n.suppliers, "Proveedores")}${fact(n.house, "Hechas en casa")}${fact(n.noPrice, "Sin precio")}${fact(n.noSupplier, "Sin proveedor")}${fact(n.doubtful, "Dudosas")}</dl><p class="fineprint">Sin precio o sin proveedor quiere decir que la lista no lo trae: se guarda como «No disponible», nunca como 0.</p>${doubtful.length ? `<div class="ai-warning"><p>${doubtful.length === 1 ? "Una fila dudosa" : doubtful.length + " filas dudosas"} (se ${doubtful.length === 1 ? "guarda" : "guardan"} tal cual, sin corregir, y no ${doubtful.length === 1 ? "cuenta" : "cuentan"} como «más barato»):</p><ul>${doubtful.map((x) => `<li><strong>${esc(x.name)}</strong>${x.supplier ? " · " + esc(x.supplier) : ""}: ${x.issues.map(esc).join(" ")}</li>`).join("")}</ul></div>` : ""}${t.skipped.length ? `<div class="ai-warning"><p>No se guarda:</p><ul>${t.skipped.map((x) => `<li>Página ${x.page}: ${esc(x.text)}. ${esc(x.reason)}</li>`).join("")}</ul></div>` : ""}${r.truncated ? '<p class="ai-warning">El PDF tiene más de 50 páginas: solo se leen las 50 primeras.</p>' : ""}<details><summary>Ver las ${n.rows} filas leídas</summary><div class="table-wrap"><table class="price-table"><thead><tr><th>Ingrediente</th><th>Proveedor</th><th class="num">Precio ${PRICE_UNIT}</th></tr></thead><tbody>${t.rows.map((x) => `<tr><td>${esc(x.name)}<small>página ${x.page}</small></td><td>${esc(x.supplier || "No disponible")}</td><td class="num">${priceText(x)}</td></tr>`).join("")}</tbody></table></div></details>`;
      } catch (err) {
        box.innerHTML = `<p class="ai-warning">${esc(err.message)}</p>`;
      }
    };
    reader.readAsDataURL(file);
  });
}

/** Apuntar un precio de la lista en un producto: se ve la cuenta y a qué proveedor va. */
function priceUseModal(id) {
  const found = priceRowOf(id);
  if (!found) return;
  const r = found.row;
  const made = new Set(state.recipes.map((x) => x.product));
  const choices = state.products
    .filter((p) => !made.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const names = [r.name, ...found.group.rows.map((x) => x.name)].map(priceFold);
  const guess = choices.find((p) => names.includes(priceFold(p.name)));
  const sup = state.suppliers.find(
    (s) => priceFold(s.name) === priceFold(r.supplier),
  );
  modal(
    "Usar este precio en un producto",
    `«${r.name}» de ${r.supplier}: ${money(r.cents)} ${PRICE_UNIT}, según «${r.source}», página ${r.page}.`,
    `${select(
      "Producto de tu inventario",
      "product",
      [["", "Elige un producto…"], ...choices.map((p) => [p.id, p.name])],
      guess ? guess.id : "",
    )}<div id="price-use" role="status"></div>${sup ? "" : `<label class="check-label price-confirm"><input type="checkbox" name="addSupplier" required> ${esc(r.supplier)} no está en tus proveedores: crearlo con ese nombre. El teléfono y lo demás lo completas tú en Proveedores.</label>`}`,
    async (f) => {
      if (!f.get("product")) throw Error("Elige un producto.");
      return priceMutate(
        {
          type: "usePriceRow",
          row: r.id,
          product: f.get("product"),
          addSupplier: f.get("addSupplier") === "on",
        },
        "Precio apuntado con su origen.",
      );
    },
    "Apuntar el precio",
  );
  const box = $("#price-use");
  const pick = $('#modal [name="product"]');
  const explain = () => {
    const p = product(pick.value);
    if (!p) {
      box.innerHTML = "";
      return;
    }
    const usual = sup && sup.id === p.supplier;
    const alt = sup && p.alternates.find((x) => x.supplier === sup.id);
    const pack = usual ? p.pack : alt ? alt.pack : p.pack;
    const now = usual ? p.price : alt ? alt.price : 0;
    const total = Math.round(r.cents * pack);
    box.innerHTML = `<p><strong>${money(r.cents)} por ${esc(p.unit)} × ${num(pack)} ${esc(p.unit)} por paquete = ${money(total)} el paquete.</strong></p><p>${
      usual
        ? `${esc(r.supplier)} es el proveedor habitual de ${esc(p.name)}: cambia el precio de su ficha (ahora ${now ? money(now) : "No disponible"}).`
        : `${esc(r.supplier)} queda apuntado como otro proveedor de ${esc(p.name)}${alt ? ` (ahora ${alt.price ? money(alt.price) : "No disponible"})` : ""}. Su proveedor habitual, ${esc(supplier(p.supplier)?.name || "")}, no cambia.`
    }</p><p class="fineprint">La lista no dice si el precio es por litro, por kilo o por unidad: comprueba que es por ${esc(p.unit)}, que es como se mide ${esc(p.name)}. En el historial quedará de qué archivo, página y fila sale.</p>`;
  };
  pick.addEventListener("change", explain);
  explain();
}

// Botones de «Precios por proveedor». Devuelve true si la acción era suya.
async function priceListAction(name, el) {
  if (name === "priceShow" || name === "priceBack") {
    priceListOpen = name === "priceShow";
    render();
    window.scrollTo(0, 0);
    return true;
  }
  if (name === "priceUpload") {
    priceUploadModal();
    return true;
  }
  if (name === "priceTab") {
    priceTab = el.dataset.tab;
    for (const b of document.querySelectorAll('[data-action="priceTab"]'))
      b.classList.toggle("selected", b.dataset.tab === priceTab);
    priceFilter();
    return true;
  }
  if (name === "priceStar") {
    await priceMutate(
      {
        type: "starPriceRow",
        row: el.dataset.row,
        star: el.dataset.star === "1",
      },
      el.dataset.star === "1"
        ? "Marcado como ingrediente estrella."
        : "Estrella quitada.",
    );
    return true;
  }
  if (name === "priceJoin") {
    const rows = [...pricePicked].map(priceRowOf).filter(Boolean);
    const names = [...new Set(rows.map((x) => x.row.name))];
    if (new Set(rows.map((x) => x.group.key)).size < 2) {
      toast(
        "Marca filas de al menos dos ingredientes distintos para juntarlos.",
      );
      return true;
    }
    modal(
      "¿Es el mismo ingrediente?",
      "Se compararán juntos, como si fueran el mismo. La lista no dice que lo sean: lo decides tú, y se puede separar después.",
      `<ul class="price-join">${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul><p class="fineprint">Comprueba que la marca y el formato te valen igual: la app solo compara el precio.</p>`,
      async () => {
        const ok = await priceMutate(
          { type: "linkPriceRows", rows: rows.map((x) => x.row.id) },
          "Juntados como el mismo ingrediente.",
        );
        if (ok) pricePicked = new Set();
        if (ok) render();
        return ok;
      },
      "Sí, juntarlos",
    );
    return true;
  }
  if (name === "priceUnlink") {
    await priceMutate(
      { type: "unlinkPriceRow", row: el.dataset.row },
      "Vuelve a compararse por separado.",
    );
    return true;
  }
  if (name === "priceUse") {
    priceUseModal(el.dataset.row);
    return true;
  }
  if (name === "priceClear") {
    modal(
      "Vaciar la lista de precios",
      "Se quitan las filas guardadas, lo que juntaste y las estrellas. Los precios ya apuntados en tus productos no cambian.",
      "",
      async () =>
        mutate({ type: "clearPriceList" }, "Lista de precios vaciada."),
      "Vaciar la lista",
    );
    return true;
  }
  return false;
}
