// Cruceros en el puerto de Palma: quién llega, quién parte y el registro de rutas.
// Origen de los datos: Autoridad Portuaria de Baleares (datos abiertos). Solo lectura.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
let cruiseData = null,
  cruiseBusy = false,
  cruiseDay = "",
  cruiseQuery = "";
async function loadCruises(refresh) {
  if (cruiseBusy) return;
  cruiseBusy = true;
  if (refresh && page === "cruises") render();
  try {
    if (!refresh) {
      cruiseData = await request("/api/cruises");
      // First visit with an empty or old registry: show what is saved, then ask the port once.
      const old =
        !cruiseData.updatedAt ||
        Date.now() - Date.parse(cruiseData.updatedAt) > 6 * 3600 * 1000;
      refresh =
        cruiseData.enabled && cruiseData.auto && old && !cruiseData.error;
      if (refresh && page === "cruises") render();
    }
    if (refresh) {
      cruiseData = await request("/api/cruises", {});
      reloadState().catch(() => {});
    }
  } catch (e) {
    toast(e.message);
  } finally {
    cruiseBusy = false;
    if (page === "cruises") render();
  }
}
function shiftDay(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  const x = new Date(y, m - 1, d + n, 12);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
const cruiseAboard = (c) =>
  c.pax.transit + Math.max(c.pax.disembark, c.pax.embark);
const cruiseDayLabel = (day, long) =>
  new Date(day + "T12:00:00").toLocaleDateString(
    "es-ES",
    long
      ? { weekday: "long", day: "numeric", month: "long" }
      : { weekday: "short", day: "numeric", month: "short" },
  );
function cruisePage() {
  if (!cruiseData && !cruiseBusy) loadCruises(false);
  const d = cruiseData;
  const today = todayLocal();
  const day = cruiseDay || today;
  const head = header(
    "El puerto, de un vistazo.",
    "Cruceros que llegan y parten de Palma, con su ruta y sus pasajeros previstos. Más barcos, más gente paseando: prepara vitrina y turnos.",
    btn("← Día anterior", "cruisePrev", "secondary") +
      btn("Hoy", "cruiseToday", "secondary", day === today ? "disabled" : "") +
      btn("Día siguiente →", "cruiseNext", "secondary") +
      btn(
        cruiseBusy ? "Consultando…" : icon("download") + " Actualizar ahora",
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
  const on = (c, field) => c[field].slice(0, 10) === day;
  const arrivals = d.calls.filter((c) => on(c, "arrival"));
  const departures = d.calls
    .filter((c) => on(c, "departure"))
    .sort((a, b) => a.departure.localeCompare(b.departure));
  const inPort = d.calls.filter(
    (c) => c.arrival.slice(0, 10) <= day && c.departure.slice(0, 10) >= day,
  );
  const people = inPort.reduce((n, c) => n + cruiseAboard(c), 0);
  const hour = (s) => s.slice(11, 16);
  const paxCell = (c) =>
    `${num(cruiseAboard(c))}<small class="muted">${num(c.pax.transit)} en tránsito, ${num(c.pax.disembark)} bajan, ${num(c.pax.embark)} suben</small>`;
  const shipCell = (c) =>
    `<strong>${esc(c.ship)}</strong><small class="muted">${num(c.length)} m${c.status ? " · " + esc(c.status) : ""}</small>`;
  const table = (rows, cols, empty) =>
    rows.length
      ? `<div class="table-scroll"><table class="report-table cruise-table"><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${c[1](r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      : `<p class="muted">${empty}</p>`;
  const next = [];
  for (let i = 0; i < 14; i++) {
    const x = shiftDay(today, i);
    const ships = d.calls.filter(
      (c) => c.arrival.slice(0, 10) <= x && c.departure.slice(0, 10) >= x,
    );
    next.push({
      day: x,
      ships,
      people: ships.reduce((n, c) => n + cruiseAboard(c), 0),
    });
  }
  const busiest = Math.max(1, ...next.map((n) => n.people));
  const q = cruiseQuery.trim().toLowerCase();
  const registry = d.calls
    .filter(
      (c) =>
        !q ||
        [c.ship, c.from, c.to, c.fromCountry, c.toCountry]
          .join(" ")
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) => b.arrival.localeCompare(a.arrival));
  // Most repeated routes of the registry: where the ships come from and where they go next.
  const routes = {};
  for (const c of d.calls) {
    const k = `${c.from} → Palma → ${c.to}`;
    routes[k] = (routes[k] || 0) + 1;
  }
  const topRoutes = Object.entries(routes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  return (
    head +
    (d.error
      ? `<div class="notice subtle">${icon("alert")}<div><strong>${esc(d.error)}</strong><span>${d.updatedAt ? "Datos guardados el " + date(d.updatedAt) + " a las " + time(d.updatedAt) + "." : "Todavía no hay datos guardados."}</span></div></div>`
      : "") +
    `<section class="panel"><div class="panel-heading"><div><h2>${esc(cruiseDayLabel(day, true))}${day === today ? " · hoy" : ""}</h2><p>Horas del puerto de Palma. Los pasajeros son la previsión declarada por cada barco.</p></div></div><div class="report-kpis"><div><strong>${arrivals.length}</strong><span>llegan</span></div><div><strong>${departures.length}</strong><span>parten</span></div><div><strong>${inPort.length}</strong><span>en puerto</span></div><div><strong>${num(people)}</strong><span>pasajeros aprox.</span></div></div><div class="report-grid"><section><h3>Llegan</h3>${table(
      arrivals,
      [
        ["Hora", (c) => hour(c.arrival)],
        ["Barco", shipCell],
        [
          "Viene de",
          (c) =>
            esc(c.from) +
            (c.fromCountry
              ? `<small class="muted">${esc(c.fromCountry)}</small>`
              : ""),
        ],
        ["Pasajeros", paxCell],
      ],
      "Ningún crucero llega este día.",
    )}</section><section><h3>Parten</h3>${table(
      departures,
      [
        ["Hora", (c) => hour(c.departure)],
        ["Barco", shipCell],
        [
          "Va a",
          (c) =>
            esc(c.to) +
            (c.toCountry
              ? `<small class="muted">${esc(c.toCountry)}</small>`
              : ""),
        ],
        ["Muelle", (c) => esc(c.berth.split(" (del")[0])],
      ],
      "Ningún crucero parte este día.",
    )}</section></div></section>` +
    `<section class="panel"><div class="panel-heading"><div><h2>Próximos 14 días</h2><p>Toca un día para ver su detalle.</p></div></div><div class="cruise-days">${next
      .map(
        (n) =>
          `<button class="cruise-day ${n.day === day ? "active" : ""}" data-action="cruiseDay" data-day="${n.day}"><span>${esc(cruiseDayLabel(n.day))}</span><strong>${n.ships.length} ${n.ships.length === 1 ? "barco" : "barcos"}</strong><i class="cruise-bar"><b class="w${Math.round((n.people / busiest) * 10)}"></b></i><small>${n.people ? num(n.people) + " pasajeros" : "sin cruceros"}</small></button>`,
      )
      .join("")}</div></section>` +
    `<section class="panel"><div class="panel-heading"><div><h2>Registro de rutas</h2><p>${d.calls.length} escalas guardadas. Las pasadas se conservan; las futuras siguen la previsión del puerto.</p></div><label class="field">Buscar en el registro<input type="search" id="cruise-search" placeholder="Barco o puerto" value="${esc(cruiseQuery)}"></label></div>${
      topRoutes.length
        ? `<p class="cruise-routes">${topRoutes.map(([k, n]) => `<span class="pill neutral">${esc(k)} · ${n}</span>`).join(" ")}</p>`
        : ""
    }<div class="cruise-registry">${table(
      registry.slice(0, 300),
      [
        [
          "Llegada",
          (c) =>
            esc(cruiseDayLabel(c.arrival.slice(0, 10))) + " " + hour(c.arrival),
        ],
        [
          "Salida",
          (c) =>
            esc(cruiseDayLabel(c.departure.slice(0, 10))) +
            " " +
            hour(c.departure),
        ],
        ["Barco", (c) => `<strong>${esc(c.ship)}</strong>`],
        ["Ruta", (c) => `${esc(c.from)} → Palma → ${esc(c.to)}`],
        ["Pasajeros", (c) => num(cruiseAboard(c))],
      ],
      q
        ? "Nada coincide con la búsqueda."
        : "El registro está vacío. Pulsa «Actualizar ahora» con internet.",
    )}</div><p class="fineprint">Origen de los datos: Autoridad Portuaria de Baleares${d.updatedAt ? " · última actualización: " + date(d.updatedAt) + " " + time(d.updatedAt) : ""}. Previsión sujeta a cambios del puerto; la app solo la lee y no envía ningún dato tuyo.</p></section>`
  );
}
