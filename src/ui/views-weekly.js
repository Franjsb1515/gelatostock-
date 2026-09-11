// Resumen semanal imprimible (datos calculados en el servidor con el estado completo).
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
async function loadWeekly(week) {
  if (weeklyBusy) return;
  weeklyBusy = true;
  try {
    weeklyData = await request("/api/report" + (week ? "?week=" + week : ""));
    weeklyWeek = weeklyData.start;
  } catch (e) {
    toast(e.message);
  } finally {
    weeklyBusy = false;
    if (page === "weekly") render();
  }
}
function shiftWeek(start, days) {
  const [y, m, d] = start.split("-").map(Number);
  const x = new Date(y, m - 1, d + days);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function weeklyPage() {
  if (!weeklyData && !weeklyBusy) loadWeekly(weeklyWeek);
  const r = weeklyData;
  const dayName = (iso) =>
    new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
    });
  const lines = (items, empty) =>
    items.length
      ? `<table class="report-table"><tbody>${items.map((l) => `<tr><td>${esc(l.name)}</td><td class="num">${num(l.quantity)} ${esc(l.unit || "kg")}</td></tr>`).join("")}</tbody></table>`
      : `<p class="muted">${empty}</p>`;
  return (
    header(
      "La semana, en una página.",
      "Ventas, mermas, producción, compras y avisos de la semana. Imprímela o guárdala en PDF desde el diálogo de impresión.",
      btn("← Semana anterior", "weeklyPrev", "secondary") +
        btn("Semana siguiente →", "weeklyNext", "secondary") +
        btn(icon("download") + " Imprimir", "printPage", "primary"),
    ) +
    (r
      ? `<article class="report panel"><header class="report-head"><div><span class="eyebrow">RESUMEN SEMANAL · ${esc(businessName())}</span><h2>Del ${date(r.start + "T12:00:00")} al ${date(r.end + "T12:00:00")}</h2></div><small>Generado el ${date(new Date().toISOString())} ${time(new Date().toISOString())}</small></header><div class="report-kpis"><div><strong>${num(r.totals.production)} kg</strong><span>producidos</span></div><div><strong>${num(r.totals.sales)} kg</strong><span>vendidos</span></div><div><strong>${num(r.totals.waste)} kg</strong><span>mermas</span></div><div><strong>${r.orders.created}</strong><span>pedidos creados · ${money(r.orders.spent)}</span></div><div><strong>${r.messages.received}</strong><span>mensajes · ${r.messages.pending} por leer</span></div></div><div class="table-scroll"><table class="report-table days"><thead><tr><th>Día</th><th>Producción</th><th>Ventas</th><th>Mermas</th></tr></thead><tbody>${r.days.map((d) => `<tr><td>${esc(dayName(d.date))}</td><td class="num">${num(d.production)} kg</td><td class="num">${num(d.sales)} kg</td><td class="num">${num(d.waste)} kg</td></tr>`).join("")}</tbody></table></div><div class="report-grid"><section><h3>Ventas por producto</h3>${lines(r.sales, "Sin ventas registradas esta semana.")}</section><section><h3>Mermas por producto</h3>${lines(r.waste, "Sin mermas registradas.")}</section><section><h3>Recepciones de proveedores</h3>${lines(r.receipts, "No llegó mercancía esta semana.")}</section><section><h3>Producciones aprobadas</h3>${r.production.length ? `<table class="report-table"><tbody>${r.production.map((p) => `<tr><td>${esc(dayName(p.date))} · ${esc(p.name)}</td><td class="num">${num(p.quantity)} kg</td></tr>`).join("")}</tbody></table>` : '<p class="muted">Sin producciones aprobadas.</p>'}</section><section><h3>Compras</h3><p>${r.orders.created} pedidos creados (${money(r.orders.spent)} estimados) · ${r.orders.sent} enviados por WhatsApp · ${r.orders.received} recibidos por completo.</p></section><section><h3>Avisos al cierre de la semana</h3>${r.lowStock.length ? `<table class="report-table"><tbody>${r.lowStock.map((p) => `<tr><td>${esc(p.name)}</td><td class="num">${num(p.stock)} de ${num(p.min)} ${esc(p.unit)} mínimo</td></tr>`).join("")}</tbody></table>` : '<p class="muted">Ningún producto bajo mínimo.</p>'}</section></div><p class="fineprint">${r.totals.movements} movimientos de inventario en la semana. Las cifras salen de los movimientos registrados en la app; lo que no se registró no aparece.</p></article>`
      : '<div class="empty"><h3>Calculando la semana…</h3></div>')
  );
}
