// Vistas de Producción y Recetario (comparten el bloqueo por contraseña).
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
// Shared gate for Producción and Recetario when the recipe lock is enabled.
function lockGate() {
  if (!(lockInfo?.enabled && !lockInfo.unlocked)) return "";
  return (
    header(
      "Recetario protegido",
      "Las recetas y la producción se abren con tu contraseña durante 30 minutos.",
    ) +
    `<section class="panel settings-card lock-panel"><span class="stat-icon sage">${icon("shield")}</span><h2>Introduce la contraseña</h2><label class="field">Contraseña del recetario<input type="password" id="lock-password" autocomplete="current-password" maxlength="100"></label><div class="setting-actions">${btn("Desbloquear", "unlockRecipes", "primary")}</div><p class="fineprint">Protege la pantalla dentro de la app. Los movimientos de stock siguen visibles en Actividad. Si la olvidas, se puede quitar con la app cerrada borrando la clave recipes_lock de la tabla settings de gelatostock.sqlite.</p></section>`
  );
}
const familyLabel = {
  crema: "Crema",
  sorbete: "Sorbete",
  postre: "Postre",
  base: "Base o pasta",
  otro: "Otro",
};
// Ingredients as share of the mass: kg and L count as 1:1, units are left out of the total.
function recipeShares(r) {
  const mass = r.ingredients.reduce((n, i) => {
    const p = product(i.product);
    return p.unit === "ud" ? n : n + i.quantity;
  }, 0);
  return r.ingredients.map((i) => {
    const p = product(i.product);
    return {
      product: p,
      quantity: i.quantity,
      share: mass && p.unit !== "ud" ? (i.quantity / mass) * 100 : null,
    };
  });
}
function recipeBook() {
  const gate = lockGate();
  if (gate) return gate;
  const fold = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const list = state.recipes.filter(
    (r) =>
      (recipeFamily === "all" || (r.family || "crema") === recipeFamily) &&
      fold(r.name + " " + (r.allergens || "")).includes(fold(recipeQuery)),
  );
  return (
    header(
      "El recetario de la casa.",
      "Cada receta con su familia, sus proporciones, la elaboración y los alérgenos. Desde aquí se produce y se escala.",
      btn(icon("plus") + " Nueva receta", "recipeEditor", "primary"),
    ) +
    `<div class="message-filters"><label class="field">Buscar receta<input id="recipe-search" type="search" value="${esc(recipeQuery)}" placeholder="Nombre o alérgeno"></label><label class="field">Familia<select id="recipe-family"><option value="all">Todas las familias</option>${Object.entries(
      familyLabel,
    )
      .map(
        ([v, l]) =>
          `<option value="${v}" ${recipeFamily === v ? "selected" : ""}>${l}</option>`,
      )
      .join("")}</select></label></div><div class="recipe-book">${
      list
        .map((r) => {
          const shares = recipeShares(r);
          return `<article class="panel recipe-sheet" data-recipe="${esc(r.id)}"><header class="recipe-sheet-head"><div><h2>${esc(r.name)}</h2><p>${pill(familyLabel[r.family || "crema"], "sage")} Rinde ${num(r.yield)} kg${r.product ? " · terminado: " + esc(product(r.product).name) : ""}</p></div><label class="field recipe-scale">Calcular para<span class="stepper"><button type="button" class="step" data-step="-1" aria-label="Menos kilos">−</button><input class="quantity" type="number" min="0.1" max="1000000" step="0.5" value="${r.yield}" data-scale="${esc(r.id)}" aria-label="Kilos para escalar ${esc(r.name)}"><button type="button" class="step" data-step="1" aria-label="Más kilos">+</button></span> kg</label></header><div class="table-scroll"><table class="delivery-table recipe-table"><thead><tr><th>Ingrediente</th><th>Para ${num(r.yield)} kg</th><th>%</th><th>Para <span data-scale-label="${esc(r.id)}">${num(r.yield)}</span> kg</th></tr></thead><tbody>${shares
            .map(
              (s) =>
                `<tr><td><strong>${esc(s.product.name)}</strong></td><td>${num(s.quantity)} ${esc(s.product.unit)}</td><td>${s.share === null ? "—" : num(Math.round(s.share * 10) / 10) + " %"}</td><td><strong data-scaled="${esc(r.id)}" data-base="${s.quantity}" data-unit="${esc(s.product.unit)}">${num(s.quantity)} ${esc(s.product.unit)}</strong></td></tr>`,
            )
            .join(
              "",
            )}</tbody></table></div>${r.steps ? `<div class="recipe-block"><div class="message-label">ELABORACIÓN</div><p class="recipe-steps">${esc(r.steps)}</p></div>` : ""}${r.allergens ? `<div class="recipe-block"><div class="message-label">ALÉRGENOS</div><p>${esc(r.allergens)}</p></div>` : ""}${r.note ? `<p class="muted">${esc(r.note)}</p>` : ""}<div class="row-actions">${btn(icon("plus") + " Producir", "produce", "primary", `data-recipe="${esc(r.id)}"`)}${btn("Editar", "recipeEditor", "secondary", `data-id="${esc(r.id)}"`)}${btn("Duplicar", "duplicateRecipe", "secondary", `data-id="${esc(r.id)}"`)}${btn("Eliminar", "deleteRecipe", "danger", `data-id="${esc(r.id)}"`)}</div></article>`;
        })
        .join("") ||
      `<div class="empty">${icon("cake")}<h3>${state.recipes.length ? "Ninguna receta coincide con el filtro." : "Tu recetario está vacío."}</h3><p>${state.recipes.length ? "Cambia la familia o borra la búsqueda." : "Crea la primera receta con su familia, ingredientes, elaboración y alérgenos."}</p></div>`
    }</div>`
  );
}
function production() {
  const gate = lockGate();
  if (gate) return gate;
  const proposed = proposedProductions();
  const applied = state.productions.filter((p) => p.status === "applied");
  const byDate = {};
  for (const p of applied) (byDate[p.date] ||= []).push(p);
  const dates = Object.keys(byDate).sort().reverse().slice(0, 30);
  const lineText = (l) => {
    const p = product(l.product);
    return `${esc(p.name)} ${num(l.quantity)} ${esc(p.unit)}`;
  };
  return (
    header(
      "Producción y recetas",
      "Cada kilo de gelato descuenta sus ingredientes, solo cuando tú lo apruebas.",
      btn(icon("plus") + " Nueva receta", "recipeEditor") +
        btn(icon("plus") + " Registrar producción", "produce", "primary"),
    ) +
    `<div class="notice subtle">${icon("shield")}<div><strong>Cálculo por reglas con tu receta, no por IA</strong><span>La app propone el consumo y el producto terminado. Puedes corregir cada cantidad antes de aprobar. El stock resultante es una estimación hasta el próximo conteo.</span></div></div><section class="panel"><div class="panel-heading"><div><h2>Producciones por aprobar</h2><p>Revisa el consumo estimado. Aprobar crea movimientos de salida por producción y la entrada del producto terminado.</p></div></div>${
      proposed.length
        ? proposed
            .map(
              (p) =>
                `<article class="production-card" data-production="${esc(p.id)}"><header><div><strong>${esc(p.name)}</strong><small>${num(p.quantity)} kg · ${date(p.date + "T12:00:00Z")}</small></div>${pill("Por aprobar", "sand")}</header><div class="table-scroll"><table class="delivery-table"><thead><tr><th>Ingrediente</th><th>Estimado por receta</th><th>Consumo real</th><th>Stock actual</th></tr></thead><tbody>${p.lines
                  .map((l) => {
                    const pr = product(l.product);
                    return `<tr><td><strong>${esc(pr.name)}</strong></td><td>${num(l.quantity)} ${esc(pr.unit)}</td><td><input type="number" class="inline-input" data-prod-line="${esc(l.product)}" value="${l.quantity}" min="0" max="1000000" step="${pr.unit === "ud" ? "1" : "0.001"}" aria-label="Consumo real de ${esc(pr.name)}"> ${esc(pr.unit)}</td><td>${num(pr.stock)} ${esc(pr.unit)}${pr.stock < l.quantity ? " " + pill("Insuficiente", "peach") : ""}</td></tr>`;
                  })
                  .join(
                    "",
                  )}</tbody></table></div>${p.output ? `<p><strong>Producto terminado:</strong> ${esc(product(p.output.product).name)} <input type="number" class="inline-input" data-prod-output value="${p.output.quantity}" min="0" max="1000000" step="0.001" aria-label="Kilos de producto terminado"> kg</p>` : '<p class="muted">Esta receta no tiene producto terminado asociado; solo se descuentan ingredientes.</p>'}<label class="field">Nota (opcional)<input type="text" class="inline-input wide" data-prod-note maxlength="500" placeholder="Ejemplo: se usó más leche"></label><div class="row-actions">${btn(icon("check") + " Aprobar y descontar", "applyProduction", "primary", `data-id="${esc(p.id)}"`)}${btn("Descartar", "discardProduction", "secondary", `data-id="${esc(p.id)}"`)}</div></article>`,
            )
            .join("")
        : '<div class="empty compact">No hay producciones pendientes. Registra una producción para ver el consumo estimado.</div>'
    }</section><section class="panel"><div class="panel-heading"><div><h2>Hoja diaria de producción</h2><p>Kilos producidos por día y por gelato, con el consumo aprobado.</p></div></div>${
      dates.length
        ? `<div class="table-scroll"><table class="delivery-table"><thead><tr><th>Día</th><th>Gelato</th><th>Kilos</th><th>Consumo aprobado</th></tr></thead><tbody>${dates
            .map((d) =>
              byDate[d]
                .map(
                  (p, i) =>
                    `<tr>${i === 0 ? `<td rowspan="${byDate[d].length}"><strong>${date(d + "T12:00:00Z")}</strong><small>${num(byDate[d].reduce((n, x) => n + x.quantity, 0))} kg en total</small></td>` : ""}<td>${esc(p.name)}${p.note ? `<small>${esc(p.note)}</small>` : ""}</td><td>${num(p.output?.quantity ?? p.quantity)} kg</td><td>${
                      p.lines
                        .filter((l) => l.quantity)
                        .map(lineText)
                        .join(", ") || "Sin consumo"
                    }</td></tr>`,
                )
                .join(""),
            )
            .join("")}</tbody></table></div>`
        : '<div class="empty compact">Todavía no hay producciones aprobadas.</div>'
    }</section><section class="panel"><div class="panel-heading"><div><h2>Recetas</h2><p>${state.recipes.length} receta${state.recipes.length === 1 ? "" : "s"} en el recetario, con proporciones, elaboración y alérgenos.</p></div>${btn("Abrir recetario", "openRecipes", "secondary")}</div><div class="recipe-grid">${
      state.recipes
        .slice(0, 6)
        .map(
          (r) =>
            `<article class="recipe-card"><h3>${esc(r.name)}</h3><small>${familyLabel[r.family || "crema"]} · rinde ${num(r.yield)} kg</small><div class="row-actions">${btn("Producir", "produce", "secondary", `data-recipe="${esc(r.id)}"`)}</div></article>`,
        )
        .join("") ||
      '<div class="empty compact">Sin recetas. Crea la primera con «Nueva receta».</div>'
    }</div></section>${salesSection()}`
  );
}
function salesSection() {
  // Only what a recipe produces counts as finished product; ingredients never appear here.
  const finished = state.products.filter(
    (p) => p.unit === "kg" && state.recipes.some((r) => r.product === p.id),
  );
  const today = todayLocal();
  return `<section class="panel" data-sales><div class="panel-heading"><div><h2>Ventas y mermas del día</h2><p>Kilos vendidos o desechados de producto terminado. Cada cantidad crea una salida o una merma trazable y reversible.</p></div></div><label class="field short">Día<input type="date" class="inline-input" data-sales-date value="${today}" max="${today}"></label><div class="table-scroll"><table class="delivery-table"><thead><tr><th>Producto terminado</th><th>Stock</th><th>Vendido (kg)</th><th>Merma (kg)</th></tr></thead><tbody>${finished
    .map(
      (p) =>
        `<tr><td><strong>${esc(p.name)}</strong></td><td>${num(p.stock)} kg</td><td><input type="number" class="inline-input" data-sold="${esc(p.id)}" min="0" max="1000000" step="0.001" placeholder="0" aria-label="Vendido de ${esc(p.name)}"></td><td><input type="number" class="inline-input" data-waste="${esc(p.id)}" min="0" max="1000000" step="0.001" placeholder="0" aria-label="Merma de ${esc(p.name)}"></td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div>${finished.length ? `<div class="row-actions">${btn(icon("check") + " Registrar ventas y mermas", "dailySales", "primary")}</div>` : '<p class="muted">No hay productos terminados: asigna un producto terminado (en kg) a una receta del recetario.</p>'}</section>`;
}
function ingredientRow(productId = "", qty = "") {
  return `<div class="ingredient-row"><select name="ing-product" aria-label="Ingrediente">${options([["", "Elegir ingrediente"], ...state.products.map((p) => [p.id, `${p.name} (${p.unit})`])], productId)}</select><input name="ing-qty" type="number" min="0.001" max="1000000" step="0.001" value="${esc(qty)}" aria-label="Cantidad"><button type="button" class="icon-button" data-action="removeIngredient" aria-label="Quitar ingrediente">${icon("close")}</button></div>`;
}
