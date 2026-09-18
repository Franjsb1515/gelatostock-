// Cruceros en el puerto de Palma: herramienta de planificación, no solo una lista de barcos.
// Todo llega calculado del servidor local (core/cruises.ts). Reglas de esta pantalla:
//  - un dato que la fuente no da se muestra como «No disponible», nunca se rellena;
//  - «pasajeros declarados» y «capacidad del barco» son cosas distintas y se rotulan distinto;
//  - el impacto es carga portuaria potencial calculada, no clientes esperados;
//  - las horas son las del puerto (Europe/Madrid), vengan de donde vengan.
// Origen de los datos: Autoridad Portuaria de Baleares. Sin estilos en línea (la CSP los bloquea).
let cruiseDash = null,
  cruiseRange = null,
  cruiseDetail = null,
  cruiseFound = null,
  cruiseContext = {},
  cruiseContextStatus = null,
  cruiseSales = null,
  cruiseBusy = false,
  cruiseSyncing = false,
  cruiseTab = "week",
  cruiseDay = "",
  cruiseMonth = "",
  cruiseQuery = "",
  cruiseStatus = "",
  cruiseImpactOnly = false;
// Thousands separator always (es-ES omits it for four digits): 7.684, not 7684.
const cnum = (n) =>
  new Intl.NumberFormat("es-ES", {
    useGrouping: "always",
    maximumFractionDigits: 2,
  }).format(n);
const NA = '<span class="na">No disponible</span>';
const cruiseShift = (day, n) => {
  const [y, m, d] = day.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return x.toISOString().slice(0, 10);
};
// Dates are port dates: formatted in UTC so the computer's zone can never move them a day.
const cruiseDate = (day, options) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("es-ES", {
    timeZone: "UTC",
    ...options,
  });
const cruiseLong = (day) =>
  cruiseDate(day, { weekday: "long", day: "numeric", month: "long" });
const cruiseShort = (day) =>
  cruiseDate(day, { weekday: "short", day: "numeric", month: "short" });
// Sync stamps are instants: shown in port time, not in the computer's.
const cruiseStamp = (iso) =>
  new Date(iso).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const cruiseWall = (wall) =>
  `${cruiseShort(wall.slice(0, 10))} · ${wall.slice(11, 16)}`;
const paxText = (n) => (n === null || n === undefined ? NA : cnum(n));
const stayText = (minutes) =>
  `${Math.floor(minutes / 60)} h${minutes % 60 ? " " + (minutes % 60) + " min" : ""}`;
const impactPill = (s) =>
  `<span class="impact impact-${esc(s.impact)}">${esc(s.impactLabel)}</span>`;

function cruiseRangeBounds() {
  const today = cruiseDash.today;
  if (cruiseTab === "calendar") {
    const month = cruiseMonth || today.slice(0, 7);
    const first = month + "-01";
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return [first, last];
  }
  return [today, cruiseShift(today, cruiseTab === "month" ? 29 : 6)];
}
async function loadCruises({ sync = false } = {}) {
  if (cruiseBusy) return;
  cruiseBusy = true;
  cruiseSyncing = sync;
  if (page === "cruises") render();
  try {
    cruiseDash = sync
      ? await request("/api/cruises", { type: "sync" })
      : await request("/api/cruises");
    // First visit with nothing stored yet: ask the port once (never in tests or when disabled).
    if (
      !sync &&
      cruiseDash.enabled &&
      cruiseDash.auto &&
      cruiseDash.status.state === "never"
    ) {
      cruiseSyncing = true;
      if (page === "cruises") render();
      cruiseDash = await request("/api/cruises", { type: "sync" });
    }
    if (cruiseDash.enabled) {
      const [from, to] = cruiseRangeBounds();
      cruiseRange = await request(`/api/cruises/range?from=${from}&to=${to}`);
      cruiseDetail = await request(
        "/api/cruises/day?day=" + (cruiseDay || cruiseDash.today),
      );
      if (cruiseTab === "registry") await searchCruises();
      if (cruiseTab === "sales")
        cruiseSales = await request("/api/cruises/sales");
      // Day context (weather forecast, official holidays, own events) for what is on screen.
      const selected = cruiseDay || cruiseDash.today;
      const lo = [from, selected, cruiseDash.today].sort()[0];
      const hi = [to, selected, cruiseShift(cruiseDash.today, 1)].sort().at(-1);
      cruiseContext = {};
      if (cruiseShift(lo, 100) >= hi) {
        const ctx = await request(`/api/cruises/context?from=${lo}&to=${hi}`);
        cruiseContext = ctx.days;
        cruiseContextStatus = ctx.status;
      } else
        for (const [a, b] of [
          [from, to],
          [selected, selected],
        ]) {
          const ctx = await request(`/api/cruises/context?from=${a}&to=${b}`);
          Object.assign(cruiseContext, ctx.days);
          cruiseContextStatus = ctx.status;
        }
    }
    if (sync) reloadState().catch(() => {});
  } catch (e) {
    toast(e.message);
  } finally {
    cruiseBusy = false;
    cruiseSyncing = false;
    if (page === "cruises") render();
  }
}
async function searchCruises(offset = 0) {
  const params = new URLSearchParams({
    q: cruiseQuery.trim(),
    status: cruiseStatus,
    offset: String(offset),
  });
  const found = await request("/api/cruises/search?" + params);
  cruiseFound =
    offset && cruiseFound
      ? { total: found.total, items: [...cruiseFound.items, ...found.items] }
      : found;
}

// Context of a day in one short line: forecast, official holiday, own events. Missing = nothing.
const tempText = (w) => `${Math.round(w.tMax)}° / ${Math.round(w.tMin)}°`;
function cruiseContextLine(day) {
  const c = cruiseContext[day];
  if (!c) return "";
  const parts = [];
  if (c.weather)
    parts.push(
      `<span class="ctx ctx-weather">${esc(tempText(c.weather))}${c.weather.label ? " · " + esc(c.weather.label) : ""}${c.weather.precipMm ? " · " + cnum(c.weather.precipMm) + " mm" : ""}</span>`,
    );
  for (const h of c.holidays)
    parts.push(`<span class="ctx ctx-holiday">Festivo: ${esc(h.name)}</span>`);
  for (const e of c.events)
    parts.push(`<span class="ctx ctx-event">Evento: ${esc(e.name)}</span>`);
  return parts.length ? `<span class="ctx-line">${parts.join("")}</span>` : "";
}
function cruiseContextBlock(day) {
  const c = cruiseContext[day] || { weather: null, holidays: [], events: [] };
  const w = c.weather;
  const weather = w
    ? `<strong class="kpi-text">${esc(tempText(w))}${w.label ? " · " + esc(w.label) : ""}</strong><small>${w.precipMm === null ? "Lluvia: no disponible" : "Lluvia prevista: " + cnum(w.precipMm) + " mm"} · ${esc(w.kind)}${w.approximate ? ", orientativa" : ""} · consultada el ${esc(cruiseStamp(w.fetchedAt))}</small>`
    : `<strong class="kpi-text">${NA}</strong><small>La previsión cubre unos 9 días desde hoy. No hay observaciones de días pasados.</small>`;
  const holidays = c.holidays.length
    ? c.holidays
        .map(
          (h) =>
            `<strong class="kpi-text">${esc(h.name)}</strong><small>${h.scope === "local" ? "Fiesta local de Palma" : "Festivo en las Illes Balears"} · calendario oficial</small>`,
        )
        .join("")
    : `<strong class="kpi-text">${cruiseContextStatus && !cruiseContextStatus.holidays.loaded && day.slice(0, 4) === String(cruiseContextStatus.holidays.year) ? NA : "No es festivo"}</strong><small>${cruiseContextStatus && !cruiseContextStatus.holidays.loaded ? "Calendario oficial todavía sin cargar" + (cruiseContextStatus.holidays.note ? ": " + esc(cruiseContextStatus.holidays.note) : "") : "Según el calendario laboral oficial"}</small>`;
  const events = c.events.length
    ? c.events
        .map(
          (e) =>
            `<strong class="kpi-text">${esc(e.name)}</strong><small>${e.from === e.to ? "" : esc(cruiseShort(e.from)) + " – " + esc(cruiseShort(e.to)) + " · "}${esc(e.note || "anotado por ti")} <button class="text-link" data-action="cruiseEventDelete" data-id="${esc(e.id)}">Quitar</button></small>`,
        )
        .join("")
    : `<strong class="kpi-text"><span class="na">Ninguno anotado</span></strong><small>Los eventos los anotas tú: Palma no publica una agenda reutilizable.</small>`;
  return `<h3 class="cruise-sub">Contexto del día</h3><div class="cruise-kpis"><div><span>Clima previsto</span>${weather}</div><div><span>Festivo</span>${holidays}</div><div><span>Eventos</span>${events}<span>${btn("Añadir evento", "cruiseEventAdd", "secondary", `data-day="${esc(day)}"`)}</span></div></div>`;
}
function cruiseSalesView() {
  const s = cruiseSales;
  if (!s) return '<p class="muted">Calculando…</p>';
  const labels = {
    none: "Sin cruceros",
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
    veryHigh: "Muy alto",
    unknown: "No calculable",
  };
  return `<p>Kilos vendidos en los días con ventas registradas, agrupados por el impacto potencial de ese día. Son hechos puestos lado a lado: la app no calcula correlaciones ni predice ventas.</p>${
    s.daysWithSales
      ? `<div class="table-scroll"><table class="report-table cruise-table"><thead><tr><th>Impacto del día</th><th>Días con ventas</th><th>Media vendida</th><th>Mínimo – máximo</th><th>Lectura</th></tr></thead><tbody>${s.levels
          .map(
            (l) =>
              `<tr><td><span class="impact impact-${esc(l.impact)}">${labels[l.impact]}</span></td><td>${l.days}</td><td>${l.days ? cnum(l.meanKg) + " kg" : "—"}</td><td>${l.days ? cnum(l.minKg) + " – " + cnum(l.maxKg) + " kg" : "—"}</td><td>${l.enough ? "Media con días suficientes" : l.days ? `Pocos días: faltan ${s.minDays - l.days} para que la media diga algo` : "Sin días todavía"}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table></div><p class="fineprint">${s.daysWithSales} días con ventas, del ${esc(cruiseDate(s.first, { day: "numeric", month: "long", year: "numeric" }))} al ${esc(cruiseDate(s.last, { day: "numeric", month: "long", year: "numeric" }))}. Solo cuentan los días con «Ventas y mermas del día» registradas: un día sin registro no distingue cerrado de no apuntado. Una media necesita al menos ${s.minDays} días de ese nivel.</p>`
      : '<div class="empty compact">Todavía no hay ventas registradas. Apunta las ventas del día en Producción y aquí irán apareciendo junto al impacto de cada día.</div>'
  }`;
}
function cruiseStatusStrip(d) {
  const s = d.status;
  const kind = cruiseSyncing ? "syncing" : s.state;
  const label = cruiseSyncing ? "Actualizando…" : s.label;
  const when = s.updatedAt
    ? `Última actualización: ${esc(cruiseStamp(s.updatedAt))} (hora de Palma)`
    : "Todavía no se han obtenido datos";
  const source = s.sourceUpdatedAt
    ? ` · el puerto actualizó su previsión el ${esc(cruiseWall(s.sourceUpdatedAt))}`
    : "";
  const problem =
    kind === "error"
      ? ` · ${esc(s.error)}${s.updatedAt ? " Se muestran los últimos datos disponibles." : ""}`
      : kind === "stale"
        ? " · Se muestran los últimos datos disponibles."
        : "";
  return `<div class="cruise-sync sync-${esc(kind)}" role="status"><strong>${esc(label)}</strong><span>${when}${source}${problem}</span></div>`;
}
function cruiseDashboard(d) {
  const t = d.todaySummary;
  const m = d.tomorrowSummary;
  const peak = t.peak
    ? `${t.peak.from} – ${t.peak.to}<small>${t.peak.ships} ${t.peak.ships === 1 ? "crucero" : "cruceros a la vez"}</small>`
    : `<span class="na">Sin cruceros</span>`;
  const next = d.nextArrival
    ? `${esc(d.nextArrival.ship)}<small>${esc(cruiseWall(d.nextArrival.arrival))}${d.nextArrival.from ? " · desde " + esc(d.nextArrival.from) : ""}</small>`
    : NA;
  const pax =
    t.passengers === null
      ? t.ships
        ? NA
        : "0"
      : cnum(t.passengers) +
        (t.undeclared ? `<small>${t.undeclared} sin declarar</small>` : "");
  return `<section class="panel cruise-today" aria-label="Resumen de hoy"><div class="panel-heading"><div><h2>Hoy · ${esc(cruiseLong(d.today))}</h2><p>${d.inPortNow.length ? "Ahora en puerto: " + esc(d.inPortNow.join(", ")) + "." : "Ahora mismo no hay cruceros en puerto."} Hora de Palma: ${esc(d.now.slice(11))}.</p>${cruiseContextLine(d.today)}</div></div><div class="cruise-kpis"><div><span>Cruceros hoy</span><strong>${t.ships}</strong><small>llegan ${t.arrivals} · parten ${t.departures}</small></div><div><span>Pasajeros declarados</span><strong>${pax}</strong><small>declarados al puerto, no clientes</small></div><div><span>Mayor concentración</span><strong class="kpi-text">${peak}</strong></div><div><span>Impacto potencial</span><strong class="kpi-text">${impactPill(t)}</strong><small>carga portuaria calculada</small></div><div><span>Próxima llegada</span><strong class="kpi-text">${next}</strong></div></div><button class="cruise-tomorrow" data-action="cruiseDay" data-day="${esc(m.day)}"><strong>Mañana</strong> · ${m.ships} ${m.ships === 1 ? "crucero" : "cruceros"}${m.ships ? " · " + (m.passengers === null ? "pasajeros no disponibles" : cnum(m.passengers) + " pasajeros declarados") + (m.firstArrival ? " · primera llegada " + m.firstArrival : "") : ""} · ${impactPill(m)} ${icon("arrow")}</button></section>`;
}
function cruiseDayCard(s, selected) {
  return `<button class="cruise-day ${s.day === selected ? "active" : ""} level-${esc(s.impact)}" data-action="cruiseDay" data-day="${esc(s.day)}" aria-label="${esc(cruiseLong(s.day))}: ${s.ships} cruceros, impacto ${esc(s.impactLabel)}"><span>${esc(cruiseShort(s.day))}</span><strong>${s.ships} ${s.ships === 1 ? "crucero" : "cruceros"}</strong>${
    s.ships
      ? `<small>${s.passengers === null ? "Pasajeros: no disponible" : cnum(s.passengers) + " pasajeros declarados"}</small><small>${s.firstArrival ? "Primera llegada " + s.firstArrival : "Ya en puerto"} · ${s.lastDeparture ? "última salida " + s.lastDeparture : "sigue en puerto"}</small>`
      : "<small>Sin escalas registradas</small>"
  }${cruiseContextLine(s.day)}${impactPill(s)}</button>`;
}
function cruiseCalendar(days, selected, today) {
  const month = days[0].day.slice(0, 7);
  const lead = (new Date(days[0].day + "T12:00:00Z").getUTCDay() + 6) % 7;
  const cells = [
    ...Array.from(
      { length: lead },
      () => '<div class="cal-cell cal-empty"></div>',
    ),
    ...days.map(
      (s) =>
        `<button class="cal-cell level-${esc(s.impact)} ${s.day === selected ? "active" : ""} ${s.day === today ? "today" : ""}" data-action="cruiseDay" data-day="${esc(s.day)}" aria-label="${esc(cruiseLong(s.day))}: ${s.ships} cruceros, impacto ${esc(s.impactLabel)}"><b>${Number(s.day.slice(8))}</b>${s.ships ? `<span>${s.ships} ${s.ships === 1 ? "crucero" : "cruceros"}</span><em>${esc(s.impactLabel)}</em>` : "<span>—</span>"}${cruiseContext[s.day]?.holidays.length ? '<i class="cal-mark">Festivo</i>' : ""}${cruiseContext[s.day]?.events.length ? '<i class="cal-mark">Evento</i>' : ""}</button>`,
    ),
  ].join("");
  return `<div class="cal-nav">${btn("← Mes anterior", "cruiseMonthPrev", "secondary")}<h3>${esc(cruiseDate(month + "-01", { month: "long", year: "numeric" }))}</h3>${btn("Mes siguiente →", "cruiseMonthNext", "secondary")}</div><div class="cal-grid"><div class="cal-head">L</div><div class="cal-head">M</div><div class="cal-head">X</div><div class="cal-head">J</div><div class="cal-head">V</div><div class="cal-head">S</div><div class="cal-head">D</div>${cells}</div><p class="cal-legend"><span class="impact impact-none">Sin cruceros</span><span class="impact impact-low">Bajo</span><span class="impact impact-medium">Medio</span><span class="impact impact-high">Alto</span><span class="impact impact-veryHigh">Muy alto</span><span class="impact impact-unknown">No calculable</span></p>`;
}
// Horizontal bars of the day as SVG: geometry goes in attributes, colours in the stylesheet.
function cruiseTimelineSvg(detail) {
  const bars = detail.bars;
  if (!bars.length) return "";
  const left = 190,
    width = 780,
    rowH = 34,
    top = 26;
  const x = (minute) => left + (minute / 1440) * width;
  const height = top + bars.length * rowH + 8;
  const grid = [0, 3, 6, 9, 12, 15, 18, 21, 24]
    .map(
      (h) =>
        `<line class="tl-grid" x1="${x(h * 60)}" y1="${top - 6}" x2="${x(h * 60)}" y2="${height - 4}"/><text class="tl-hour" x="${x(h * 60)}" y="12" text-anchor="middle">${String(h).padStart(2, "0")}:00</text>`,
    )
    .join("");
  const rows = bars
    .map((b, i) => {
      const y = top + i * rowH;
      const call = detail.calls.find((c) => c.id === b.id);
      const from = b.startsBefore ? "día anterior" : call.arrival.slice(11);
      const to = b.endsAfter ? "día siguiente" : call.departure.slice(11);
      return `<text class="tl-ship" x="${left - 10}" y="${y + 17}" text-anchor="end">${esc(b.ship.length > 22 ? b.ship.slice(0, 21) + "…" : b.ship)}</text><rect class="tl-bar" x="${x(b.startMinute)}" y="${y + 3}" width="${Math.max(3, x(b.endMinute) - x(b.startMinute))}" height="20" rx="6"><title>${esc(b.ship)}: ${esc(from)} → ${esc(to)}</title></rect><text class="tl-time" x="${Math.min(x(b.startMinute) + 8, left + width - 130)}" y="${y + 17}">${esc(from)} → ${esc(to)}</text>`;
    })
    .join("");
  return `<div class="table-scroll"><svg class="cruise-timeline" viewBox="0 0 ${left + width + 16} ${height}" role="img" aria-label="Cruceros en puerto por hora">${grid}${rows}</svg></div>`;
}
function cruiseCard(c) {
  const rowOf = (label, value) =>
    `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const text = (v) => (v ? esc(v) : NA);
  const capacity =
    c.capacityStandard || c.capacityMax
      ? `${c.capacityStandard ? cnum(c.capacityStandard) + " habitual" : ""}${c.capacityStandard && c.capacityMax ? " · " : ""}${c.capacityMax ? cnum(c.capacityMax) + " máxima" : ""}<small>Dato manual · fuente: ${esc(c.infoSource)}</small>`
      : NA;
  const pax =
    c.declared === null
      ? NA
      : `${cnum(c.declared)}<small>${[c.pax.transit !== null ? cnum(c.pax.transit) + " en tránsito" : "", c.pax.disembark !== null ? cnum(c.pax.disembark) + " desembarcan" : "", c.pax.embark !== null ? cnum(c.pax.embark) + " embarcan" : ""].filter(Boolean).join(" · ")}</small>`;
  const planned =
    c.scheduledArrival &&
    (c.scheduledArrival !== c.arrival || c.scheduledDeparture !== c.departure)
      ? `<small>Previsto: ${esc(c.scheduledArrival.slice(11))} → ${esc((c.scheduledDeparture || "").slice(11))}</small>`
      : "";
  return `<article class="cruise-card ${c.withdrawn ? "withdrawn" : ""}"><header><div><h3>${esc(c.ship)}</h3><p>${c.line ? esc(c.line) : "Naviera: " + NA}</p></div><div class="cruise-card-pills">${pill(c.statusLabel, c.status === "withdrawn" ? "peach" : c.status === "inPort" ? "green" : "neutral")}${c.modified ? pill("Modificado esta semana", "peach") : ""}</div></header><div class="cruise-times"><div><span>Llegada</span><strong>${esc(c.arrival.slice(11))}</strong><small>${esc(cruiseShort(c.arrival.slice(0, 10)))}</small></div><div><span>Salida</span><strong>${esc(c.departure.slice(11))}</strong><small>${esc(cruiseShort(c.departure.slice(0, 10)))}</small></div><div><span>Escala</span><strong>${esc(stayText(c.stayMinutes))}</strong>${planned}</div></div><dl class="cruise-facts">${rowOf("Pasajeros declarados", pax)}${rowOf("Capacidad del barco", capacity)}${rowOf("Tipo de escala", c.typeLabel ? esc(c.typeLabel) + "<small>según las operaciones declaradas</small>" : NA)}${rowOf("Muelle", text(c.berth))}${rowOf("Terminal", NA)}${rowOf("Puerto anterior", text(c.from) + (c.fromCountry ? `<small>${esc(c.fromCountry)}</small>` : ""))}${rowOf("Siguiente puerto", text(c.to) + (c.toCountry ? `<small>${esc(c.toCountry)}</small>` : ""))}${rowOf("Consignatario", text(c.agent))}${rowOf("Bandera", text(c.flag))}${rowOf("Eslora · arqueo", (c.length ? cnum(c.length) + " m" : "—") + " · " + (c.gt ? cnum(c.gt) + " GT" : "—"))}${rowOf("IMO", text(c.imo))}</dl><footer><small>Fuente: ${esc(c.source)} · verificado el ${esc(cruiseStamp(c.lastVerifiedAt))}</small><span>${btn("Historial y origen", "cruiseCall", "secondary", `data-id="${esc(c.id)}"`)}${btn("Ficha del barco", "cruiseShip", "secondary", `data-id="${esc(c.id)}"`)}</span></footer></article>`;
}
function cruiseDayDetail(detail, today) {
  const s = detail.summary;
  const fact = (label, value, note = "") =>
    `<div><span>${label}</span><strong class="kpi-text">${value}</strong>${note ? `<small>${note}</small>` : ""}</div>`;
  const empty =
    cruiseDash.status.state === "never"
      ? "Información pendiente de sincronización."
      : "No hay escalas de cruceros registradas para este día.";
  return `<section class="panel" id="cruise-detail"><div class="panel-heading"><div><h2>${esc(cruiseLong(s.day))}${s.day === today ? " · hoy" : ""}</h2><p>Detalle del día con horas del puerto de Palma.</p></div><div class="heading-actions">${btn("← Día anterior", "cruisePrev", "secondary")}${btn("Hoy", "cruiseToday", "secondary", s.day === today ? "disabled" : "")}${btn("Día siguiente →", "cruiseNext", "secondary")}</div></div><div class="cruise-body">${cruiseContextBlock(s.day)}<h3 class="cruise-sub">Cruceros</h3>${
    s.ships
      ? `<div class="cruise-kpis">${fact("Cruceros", s.ships, `llegan ${s.arrivals} · parten ${s.departures}`)}${fact("Pasajeros declarados", paxText(s.passengers), s.undeclared ? s.undeclared + " barcos sin declarar" : "suma del día")}${fact("Primera llegada", s.firstArrival || "—")}${fact("Última salida", s.lastDeparture || "—")}${fact("Máxima coincidencia", `${s.peak.ships} ${s.peak.ships === 1 ? "crucero" : "cruceros"}`, `${s.peak.from} – ${s.peak.to}`)}${fact("Pasajeros a la vez", paxText(s.peakPassengers), s.peakPassengers === null ? "" : `${s.peakPassengersFrom} – ${s.peakPassengersTo}`)}${fact("Impacto potencial", impactPill(s), "no son clientes esperados")}</div><h3 class="cruise-sub">Cruceros en puerto por hora</h3>${cruiseTimelineSvg(detail)}<ol class="cruise-steps">${detail.timeline.map((t) => `<li><b>${esc(t.time)}</b> ${t.ships.length ? esc(t.ships.join(" + ")) : "puerto sin cruceros"}</li>`).join("")}</ol><h3 class="cruise-sub">Barcos</h3><div class="cruise-cards">${detail.calls.map(cruiseCard).join("")}</div>`
      : `<div class="empty compact">${empty}</div>`
  }${detail.withdrawn.length ? `<h3 class="cruise-sub">Retiradas de la previsión</h3><p class="fineprint">Estaban anunciadas y el puerto dejó de publicarlas. La fuente no indica el motivo; no cuentan en los cálculos.</p><div class="cruise-cards">${detail.withdrawn.map(cruiseCard).join("")}</div>` : ""}</div></section>`;
}
function cruiseRegistry() {
  const f = cruiseFound;
  return `<div class="message-filters"><label class="field">Buscar<input id="cruise-search" type="search" value="${esc(cruiseQuery)}" placeholder="Barco, naviera, puerto o IMO"></label><label class="field">Estado<select id="cruise-status">${[
    ["", "Todos"],
    ["Solicitado", "Programado"],
    ["Concedido", "Confirmado"],
    ["Iniciado", "En puerto"],
    ["Finalizado", "Finalizado"],
    ["withdrawn", "Retirada de la previsión"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${cruiseStatus === v ? "selected" : ""}>${l}</option>`,
    )
    .join("")}</select></label></div>${
    !f
      ? '<p class="muted">Buscando…</p>'
      : f.items.length
        ? `<p class="muted">${f.total} escalas. De la más reciente a la más antigua.</p><div class="table-scroll"><table class="report-table cruise-table"><thead><tr><th>Llegada</th><th>Salida</th><th>Barco</th><th>Ruta</th><th>Pasajeros declarados</th><th>Estado</th></tr></thead><tbody>${f.items.map((c) => `<tr><td>${esc(cruiseDate(c.arrival.slice(0, 10), { day: "numeric", month: "short", year: "numeric" }))} ${esc(c.arrival.slice(11))}</td><td>${esc(c.departure.slice(11))}</td><td><button class="text-link" data-action="cruiseDay" data-day="${esc(c.arrival.slice(0, 10))}"><strong>${esc(c.ship)}</strong></button>${c.line ? `<small class="muted">${esc(c.line)}</small>` : ""}</td><td>${esc(c.from || "—")} → Palma → ${esc(c.to || "—")}</td><td>${paxText(c.declared)}</td><td>${esc(c.statusLabel)}</td></tr>`).join("")}</tbody></table></div>${f.items.length < f.total ? `<div class="setting-actions">${btn("Mostrar más", "cruiseMore", "secondary")}</div>` : ""}`
        : '<p class="muted">Ninguna escala coincide con la búsqueda.</p>'
  }`;
}
function cruisePage() {
  if (!cruiseDash && !cruiseBusy) loadCruises();
  const d = cruiseDash;
  const head = header(
    "El puerto, para planificar el día.",
    "Cruceros en Palma con datos oficiales: cuántos hay, a qué hora coinciden y qué días vienen cargados. Es carga portuaria potencial, no clientes esperados.",
    btn(
      cruiseSyncing ? "Actualizando…" : icon("download") + " Actualizar ahora",
      "cruisesRefresh",
      "primary",
      cruiseBusy || (d && !d.enabled) ? "disabled" : "",
    ),
  );
  if (!d) return head + '<div class="empty"><h3>Cargando cruceros…</h3></div>';
  if (!d.enabled)
    return (
      head +
      `<div class="empty"><h3>La consulta de cruceros está desactivada</h3><p>Actívala en Configuración para que la app lea la previsión pública del puerto cuando haya internet.</p><button class="btn secondary" data-nav="settings">Ir a Configuración</button></div>`
    );
  const selected = cruiseDay || d.today;
  const days = cruiseRange
    ? cruiseRange.days.filter(
        (s) => !cruiseImpactOnly || ["high", "veryHigh"].includes(s.impact),
      )
    : [];
  const tabs = [
    ["week", "Próximos 7 días"],
    ["month", "Próximos 30 días"],
    ["calendar", "Calendario"],
    ["registry", "Registro y búsqueda"],
    ["sales", "Ventas e impacto"],
  ]
    .map(
      ([id, label]) =>
        `<button class="tab ${cruiseTab === id ? "active" : ""}" data-action="cruiseTab" data-tab="${id}" aria-pressed="${cruiseTab === id}">${label}</button>`,
    )
    .join("");
  const t = d.thresholds;
  const h = d.status.history;
  return (
    head +
    cruiseStatusStrip(d) +
    cruiseDashboard(d) +
    `<section class="panel"><div class="panel-heading"><div class="cruise-tabs" role="group" aria-label="Periodo">${tabs}</div>${cruiseTab === "week" || cruiseTab === "month" ? `<label class="check-row"><input type="checkbox" id="cruise-impact-only" ${cruiseImpactOnly ? "checked" : ""}> Solo impacto alto o muy alto</label>` : ""}</div><div class="cruise-body">${
      cruiseTab === "registry"
        ? cruiseRegistry()
        : cruiseTab === "sales"
          ? cruiseSalesView()
          : !cruiseRange
            ? '<p class="muted">Cargando…</p>'
            : cruiseTab === "calendar"
              ? cruiseCalendar(cruiseRange.days, selected, d.today)
              : days.length
                ? `<div class="cruise-days">${days.map((s) => cruiseDayCard(s, selected)).join("")}</div>`
                : '<p class="muted">Ningún día de este periodo alcanza impacto alto.</p>'
    }</div></section>` +
    (cruiseDetail ? cruiseDayDetail(cruiseDetail, d.today) : "") +
    `<section class="panel"><div class="panel-heading"><div><h2>Cómo leer estos datos</h2><p>Nada de esta pantalla está inventado ni estimado por la app.</p></div></div><div class="cruise-body cruise-notes"><p><strong>Impacto potencial.</strong> Es la mayor suma de pasajeros declarados que coinciden a la vez en puerto ese día. Menos de ${cnum(t.medium)}: Bajo. Menos de ${cnum(t.high)}: Medio. Menos de ${cnum(t.veryHigh)}: Alto. A partir de ahí: Muy alto. Si ningún barco declara pasajeros: No calculable. Los umbrales se cambian en Configuración.</p><p><strong>Pasajeros declarados.</strong> Es lo que cada barco declara al puerto para esa escala: en tránsito más el mayor entre los que desembarcan y los que embarcan (la fuente llama «trasbordo» al tránsito). No es la capacidad del barco ni el número de personas que bajará a la ciudad.</p><p><strong>Lo que la fuente no publica</strong> aparece como «No disponible»: naviera, capacidad y terminal. Naviera y capacidad puedes anotarlas tú en la ficha del barco, indicando de dónde sale el dato.</p><p><strong>Estados.</strong> Son los del puerto: atraque solicitado, concedido, iniciado y finalizado. El puerto no publica retrasos ni cancelaciones; si una escala anunciada desaparece, se marca «Retirada de la previsión».</p><p><strong>Clima, festivos y eventos.</strong> El clima es la previsión de MET Norway para Palma (unos 9 días); de un día pasado solo se conserva la previsión que había, nunca una observación. Los festivos salen del calendario laboral oficial del Govern de les Illes Balears. Los eventos los anotas tú.${cruiseContextStatus ? ` ${cruiseContextStatus.weather.error ? "Clima: " + esc(cruiseContextStatus.weather.error) : cruiseContextStatus.weather.updatedAt ? "Clima consultado el " + esc(cruiseStamp(cruiseContextStatus.weather.updatedAt)) + "." : "Clima todavía sin consultar."} ${cruiseContextStatus.holidays.loaded ? "Festivos de " + cruiseContextStatus.holidays.year + " cargados." : "Festivos de " + cruiseContextStatus.holidays.year + " sin cargar" + (cruiseContextStatus.holidays.note ? ": " + esc(cruiseContextStatus.holidays.note) : "") + "."}` : ""}</p><p class="fineprint">Origen de los datos: Autoridad Portuaria de Baleares (cruceros), MET Norway, CC BY 4.0 (clima) y Govern de les Illes Balears (festivos). Registro: ${cnum(d.status.totals.calls)} escalas de ${cnum(d.status.totals.ships)} barcos${d.status.totals.first ? ", desde " + esc(cruiseDate(d.status.totals.first.slice(0, 10), { month: "long", year: "numeric" })) : ""}. ${h.done ? "Histórico oficial importado." : h.running ? "Importando el histórico oficial desde 2014 (página " + h.page + ")…" : "El histórico oficial desde 2014 se importa en segundo plano."} Consulta automática cada ${d.status.intervalHours} h según la cercanía de barcos. ${d.status.integrity.length ? "Avisos de integridad: " + esc(d.status.integrity.join("; ")) + "." : ""} ${btn("Ver sincronizaciones", "cruiseSyncs", "secondary")}</p></div></section>`
  );
}
