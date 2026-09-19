// Cierre del día: ventas y mermas de producto terminado, con motivo de merma e historial.
// Dos formas de apuntar: lo vendido, o lo que queda en la cubeta (la app calcula lo vendido).
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
let salesUnit = "kg",
  salesMode = "sold",
  salesData = null,
  salesBusy = false,
  salesDays = 30;
try {
  salesMode =
    localStorage.getItem("gelato-sales-mode") === "remaining"
      ? "remaining"
      : "sold";
  salesUnit = localStorage.getItem("gelato-sales-unit") === "g" ? "g" : "kg";
} catch {
  // Without storage the default mode is used.
}
// Weights are typed as the scale shows them (425 g) and stored in kg.
const toKg = (value) =>
  salesUnit === "g"
    ? Math.round(value) / 1000
    : Math.round(value * 1000) / 1000;
const unitAttrs = () =>
  salesUnit === "g"
    ? 'min="0" max="1000000" step="1"'
    : 'min="0" max="1000" step="0.001"';
async function loadSales() {
  if (salesBusy) return;
  salesBusy = true;
  try {
    salesData = await request("/api/sales?days=" + salesDays);
  } catch (e) {
    toast(e.message);
  } finally {
    salesBusy = false;
    if (page === "production") render();
  }
}
const finishedProducts = () =>
  // Only what a recipe produces counts as finished product; ingredients never appear here.
  state.products.filter(
    (p) => p.unit === "kg" && state.recipes.some((r) => r.product === p.id),
  );
// Reads the close form. Returns lines for the action plus totals and per-row problems.
function readSalesForm(panel) {
  const lines = [];
  let sold = 0,
    waste = 0,
    gift = 0,
    problems = 0;
  for (const row of panel.querySelectorAll("[data-sale-row]")) {
    const p = product(row.dataset.saleRow);
    const raw = row.querySelector("[data-sale-input]").value;
    const w = toKg(Number(row.querySelector("[data-sale-waste]").value) || 0);
    const g = toKg(Number(row.querySelector("[data-sale-gift]").value) || 0);
    const reason = row.querySelector("[data-sale-reason]").value;
    const out = row.querySelector("[data-sale-computed]");
    const typed = raw !== "";
    const value = toKg(Number(raw) || 0);
    const rowSold =
      salesMode === "remaining"
        ? typed
          ? Math.round((p.stock - w - g - value) * 1000) / 1000
          : 0
        : value;
    let text = "";
    let bad = false;
    if (salesMode === "remaining" && typed) {
      if (rowSold < 0) {
        text = `Queda más de lo que había (${num(p.stock)} kg)`;
        bad = true;
      } else text = `Vendido: ${num(rowSold)} kg`;
    }
    if (!bad && rowSold + w + g > p.stock + 1e-9) {
      text = `Supera el stock (${num(p.stock)} kg)`;
      bad = true;
    }
    if (!bad && !text && (rowSold || w || g))
      text = `Quedan ${num(Math.round((p.stock - rowSold - w - g) * 1000) / 1000)} kg`;
    out.textContent = text;
    out.classList.toggle("bad", bad);
    row.querySelector("[data-sale-reason]").disabled = !w;
    if (bad) problems++;
    if (!typed && !w && !g) continue;
    sold += Math.max(0, rowSold);
    waste += w;
    gift += g;
    lines.push({
      product: p.id,
      ...(salesMode === "remaining" && typed
        ? { remaining: value }
        : { sold: value }),
      waste: w,
      gift: g,
      ...(w && reason ? { wasteReason: reason } : {}),
    });
  }
  return { lines, sold, waste, gift, problems };
}
function updateSalesSummary() {
  const panel = document.querySelector("[data-sales]");
  if (!panel) return;
  const r = readSalesForm(panel);
  const total = r.sold + r.waste + r.gift;
  panel.querySelector("[data-sales-summary]").textContent = total
    ? `Vendido ${num(Math.round(r.sold * 1000) / 1000)} kg · merma ${num(Math.round(r.waste * 1000) / 1000)} kg (${num(Math.round((r.waste / total) * 1000) / 10)} % de lo que salió)${r.gift ? " · invitación o consumo " + num(Math.round(r.gift * 1000) / 1000) + " kg" : ""}`
    : "Todavía sin cantidades.";
  panel.querySelector('[data-action="dailySales"]').disabled =
    !r.lines.length || r.problems > 0;
}
function salesSection() {
  if (!salesData && !salesBusy) loadSales();
  const finished = finishedProducts();
  const today = businessToday();
  const reasons = salesData?.reasons || {};
  const t = salesData?.tomorrow;
  const hint =
    t && t.ships
      ? `<p class="sales-hint">${icon("ship")} Mañana en Palma: ${t.ships} ${t.ships === 1 ? "crucero" : "cruceros"} · impacto potencial ${esc(t.impactLabel.toLowerCase())}. <button class="text-link" data-nav="cruises">Ver el día</button></p>`
      : "";
  const closedToday = salesData?.days.find((d) => d.date === today);
  return `<section class="panel" data-sales><div class="panel-heading"><div><h2>Cierre del día: ventas y mermas</h2><p>Apunta lo vendido, o pesa lo que queda y la app calcula lo vendido. Cada merma lleva su motivo; lo que invitas o consume el equipo va aparte y no cuenta como merma. Todo queda trazable y se puede deshacer.</p></div><div class="cruise-tabs" role="group" aria-label="Forma de apuntar"><button class="tab ${salesMode === "sold" ? "active" : ""}" data-action="salesMode" data-mode="sold" aria-pressed="${salesMode === "sold"}">Apunto lo vendido</button><button class="tab ${salesMode === "remaining" ? "active" : ""}" data-action="salesMode" data-mode="remaining" aria-pressed="${salesMode === "remaining"}">Peso lo que queda</button></div></div><div class="sales-body">${hint}<div class="sales-controls"><label class="field short">Día del cierre<input type="date" class="inline-input" data-sales-date value="${today}" max="${todayLocal()}"></label><label class="field short">Pesos en<select id="sales-unit" class="inline-input"><option value="kg" ${salesUnit === "kg" ? "selected" : ""}>kilos (0,425)</option><option value="g" ${salesUnit === "g" ? "selected" : ""}>gramos (425)</option></select></label></div>${closedToday ? `<p class="fineprint">Hoy ya hay un cierre registrado (${num(closedToday.sold)} kg vendidos, ${num(closedToday.waste)} kg de merma${closedToday.gift ? ", " + num(closedToday.gift) + " kg de invitación o consumo" : ""}). Lo que apuntes ahora se suma.</p>` : ""}${
    finished.length
      ? `<div class="table-scroll"><table class="delivery-table"><thead><tr><th>Producto terminado</th><th>Stock</th><th>${salesMode === "remaining" ? "Queda" : "Vendido"} (${salesUnit})</th><th>Merma (${salesUnit})</th><th>Motivo de la merma</th><th>Invitación o consumo (${salesUnit})</th><th></th></tr></thead><tbody>${finished
          .map(
            (p) =>
              `<tr data-sale-row="${esc(p.id)}"><td><strong>${esc(p.name)}</strong></td><td>${num(p.stock)} kg</td><td><input type="number" class="inline-input" data-sale-input ${unitAttrs()} placeholder="${salesMode === "remaining" ? "peso" : "0"}" aria-label="${salesMode === "remaining" ? "Queda de" : "Vendido de"} ${esc(p.name)}"></td><td><input type="number" class="inline-input" data-sale-waste ${unitAttrs()} placeholder="0" aria-label="Merma de ${esc(p.name)}"></td><td><select class="inline-input" data-sale-reason disabled aria-label="Motivo de la merma de ${esc(p.name)}"><option value="">Sin indicar</option>${Object.entries(
                reasons,
              )
                .map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`)
                .join(
                  "",
                )}</select></td><td><input type="number" class="inline-input" data-sale-gift ${unitAttrs()} placeholder="0" aria-label="Invitación o consumo de ${esc(p.name)}"></td><td><small class="sale-computed" data-sale-computed></small></td></tr>`,
          )
          .join(
            "",
          )}</tbody></table></div><div class="row-actions"><span class="sales-summary" data-sales-summary>Todavía sin cantidades.</span>${btn(icon("check") + " Registrar cierre", "dailySales", "primary", "disabled")}</div>`
      : '<p class="muted">No hay productos terminados: asigna un producto terminado (en kg) a una receta del recetario.</p>'
  }</div></section>${salesHistoryPanel()}`;
}
function salesHistoryPanel() {
  const h = salesData;
  if (!h) return "";
  const dayName = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  const pctText = (v) => (v === null ? "—" : num(v) + " %");
  return `<section class="panel"><div class="panel-heading"><div><h2>Ventas y mermas de los últimos ${salesDays} días</h2><p>Por día de negocio, sin contar lo que se deshizo. El porcentaje de merma es la merma entre todo lo que salió (vendido, merma e invitación o consumo); las invitaciones no cuentan como merma.</p></div><label class="field short">Periodo<select id="sales-days" class="inline-input">${[
    [14, "14 días"],
    [30, "30 días"],
    [90, "90 días"],
    [365, "12 meses"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${salesDays === v ? "selected" : ""}>${l}</option>`,
    )
    .join("")}</select></label></div><div class="sales-body">${
    h.days.length
      ? `<div class="report-kpis"><div><strong>${num(h.totals.sold)} kg</strong><span>vendidos</span></div><div><strong>${num(h.totals.waste)} kg</strong><span>de merma</span></div><div><strong>${num(h.totals.gift)} kg</strong><span>invitación o consumo</span></div><div><strong>${pctText(h.totals.wastePct)}</strong><span>merma sobre lo que salió</span></div><div><strong>${h.days.length}</strong><span>días con cierre</span></div></div><div class="report-grid"><section class="sales-by-day"><h3>Por día</h3><div class="table-scroll sales-scroll"><table class="report-table"><thead><tr><th>Día</th><th>Vendido</th><th>Merma</th><th>Invitación o consumo</th><th>% merma</th><th></th></tr></thead><tbody>${h.days
          .map(
            (d) =>
              `<tr><td>${esc(dayName(d.date))}</td><td class="num">${num(d.sold)} kg</td><td class="num">${num(d.waste)} kg</td><td class="num">${num(d.gift)} kg</td><td class="num">${pctText(d.wastePct)}</td><td><button class="text-link" data-action="undoDailySales" data-date="${esc(d.date)}">Deshacer</button></td></tr>${d.lines
                .map(
                  (l) =>
                    `<tr class="close-line"><td>${esc(l.name)}<small>${l.kind === "sale" ? "venta" : l.kind === "gift" ? "invitación o consumo" : "merma · " + esc(l.reason)}</small></td><td class="num">${l.kind === "sale" ? num(l.quantity) + " kg" : ""}</td><td class="num">${l.kind === "waste" ? num(l.quantity) + " kg" : ""}</td><td class="num">${l.kind === "gift" ? num(l.quantity) + " kg" : ""}</td><td></td><td class="row-tools"><button class="text-link" data-action="editCloseLine" data-id="${esc(l.id)}" data-date="${esc(d.date)}">Corregir</button> <button class="text-link" data-action="undoCloseLine" data-id="${esc(l.id)}" data-date="${esc(d.date)}">Eliminar</button></td></tr>`,
                )
                .join("")}`,
          )
          .join(
            "",
          )}</tbody></table></div></section><section><h3>Mermas por motivo</h3>${
          h.byReason.length
            ? `<table class="report-table"><tbody>${h.byReason.map((r) => `<tr><td>${esc(r.reason)}</td><td class="num">${num(r.waste)} kg</td><td class="num">${h.totals.waste ? num(Math.round((r.waste / h.totals.waste) * 1000) / 10) + " %" : "—"}</td></tr>`).join("")}</tbody></table>`
            : '<p class="muted">Sin mermas en el periodo.</p>'
        }<h3>Por producto</h3><table class="report-table"><thead><tr><th>Producto</th><th>Vendido</th><th>Merma</th><th>Invitación</th><th>% merma</th></tr></thead><tbody>${h.byProduct
          .map(
            (p) =>
              `<tr><td>${esc(p.name)}</td><td class="num">${num(p.sold)} kg</td><td class="num">${num(p.waste)} kg</td><td class="num">${num(p.gift)} kg</td><td class="num">${p.sold + p.waste + p.gift ? num(Math.round((p.waste / (p.sold + p.waste + p.gift)) * 1000) / 10) + " %" : "—"}</td></tr>`,
          )
          .join("")}</tbody></table></section></div>`
      : '<div class="empty compact">Todavía no hay cierres en este periodo. Registra el primero arriba.</div>'
  }</div></section>${valuePanels()}`;
}
// Two separate reports over the same days: sale (kilos × sale value of each day) and cost
// (kilos × cost per kilo). They are never added or subtracted; null is «No disponible».
function valuePanels() {
  const v = salesData?.value;
  if (!v || !v.rows.length) return "";
  const na = "<small>No disponible</small>";
  const cell = (n) => (n === null ? na : money(n));
  const cols = ["produced", "sold", "waste", "gift"];
  const table = (pick, perKg, label) =>
    `<div class="table-scroll"><table class="report-table"><thead><tr><th>Gelato</th><th>${label}</th><th>Producido</th><th>Vendido</th><th>Merma</th><th>Invitación o consumo</th></tr></thead><tbody>${v.rows
      .map(
        (r) =>
          `<tr><td>${esc(r.name)}<small>${num(r.kg.produced)} kg producidos · ${num(r.kg.sold)} vendidos · ${num(r.kg.waste)} de merma · ${num(r.kg.gift)} de invitación</small></td><td class="num">${perKg(r)}</td>${cols.map((k) => `<td class="num">${cell(pick(r)[k])}</td>`).join("")}</tr>`,
      )
      .join(
        "",
      )}<tr><td><strong>Total</strong></td><td></td>${cols.map((k) => `<td class="num"><strong>${cell(pick(v)[k])}</strong></td>`).join("")}</tr></tbody></table></div>`;
  const missing = (list, what) =>
    list.length
      ? `<p class="fineprint">No disponible para ${esc(list.join(", "))}: ${what} Un total incompleto no se rellena con estimaciones.</p>`
      : "";
  return `<section class="panel" data-value-report="sale"><div class="panel-heading"><div><h2>Informe de venta · últimos ${salesDays} días</h2><p>Kilos × el valor de venta por kilo que tenía cada gelato ese día (lo escribes tú en su receta). «Vendido» es lo que debió entrar; «Merma» e «Invitación» son venta que no entró. Aquí no hay costes.</p></div></div><div class="sales-body"><div class="report-kpis"><div><strong>${cell(v.sale.sold)}</strong><span>venta estimada</span></div><div><strong>${cell(v.sale.waste)}</strong><span>venta perdida por merma</span></div><div><strong>${cell(v.sale.gift)}</strong><span>valor invitado o consumido</span></div><div><strong>${cell(v.sale.produced)}</strong><span>valor de lo producido</span></div></div>${table(
    (r) => r.sale,
    (r) => (r.saleValue === null ? na : money(r.saleValue) + "/kg"),
    "Valor hoy",
  )}${missing(v.missingValue, "escribe su valor de venta por kilo en el recetario.")}</div></section><section class="panel" data-value-report="cost"><div class="panel-heading"><div><h2>Informe de coste · últimos ${salesDays} días</h2><p>Lo producido lleva el coste guardado al aprobar cada producción; lo demás, kilos × el coste por kilo de la última producción hasta ese día. Aquí no hay ventas, ni se resta de ellas.</p></div></div><div class="sales-body"><div class="report-kpis"><div><strong>${cell(v.cost.produced)}</strong><span>coste de lo producido</span></div><div><strong>${cell(v.cost.waste)}</strong><span>coste perdido por merma</span></div><div><strong>${cell(v.cost.gift)}</strong><span>coste de invitación o consumo</span></div><div><strong>${cell(v.cost.sold)}</strong><span>coste de lo vendido</span></div></div>${table(
    (r) => r.cost,
    (r) =>
      r.costPerKg === null
        ? na
        : `${money(r.costPerKg)}/kg<small>${r.costSource === "manual" ? "escrito a mano" : "calculado"}</small>`,
    "Coste hoy",
  )}${missing(v.missingCost, "falta algún precio de compra; complétalo en Inventario o escribe el coste a mano en la receta.")}</div></section>`;
}
