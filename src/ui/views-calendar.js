// Calendario: años → meses → días → ficha del día (core/calendar.ts, servidor /api/calendar).
// Solo enseña lo que ya está guardado; un día sin datos lo dice. Lo que escribe la persona: la
// marca «La tienda no abrió», el horario de cada semana (apertura y turnos) y las vacaciones.
// Los avisos del día y del mes salen de reglas del núcleo y solo avisan.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
let calView = "month",
  calYear = 0,
  calMonth = "",
  calDay = "",
  calWeek = "",
  calWeekDraft = null,
  calData = null,
  calBusy = false;
const calWeekdays = ["L", "M", "X", "J", "V", "S", "D"];
const calLong = (day) =>
  new Date(day + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const calMonthName = (month) =>
  new Date(month + "-01T12:00:00").toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
function calShiftMonth(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function calUrl() {
  if (calView === "year") return "/api/calendar?year=" + calYear;
  if (calView === "day") return "/api/calendar/day?date=" + calDay;
  return "/api/calendar?month=" + calMonth;
}
async function loadCalendar() {
  if (calBusy) return;
  calBusy = true;
  const url = calUrl();
  try {
    const data = await request(url);
    // Si mientras tanto se cambió de vista, esta respuesta ya no vale.
    if (url === calUrl()) calData = { url, ...data };
  } catch (e) {
    toast(e.message);
    calData = { url, error: e.message };
  } finally {
    calBusy = false;
    if (page === "calendar") render();
  }
}
/** Un turno «Libre» no es trabajo (como isOff en core/util.ts). */
const calIsOff = (t) =>
  /^(libre|descanso|d[ií]a libre)$/i.test((t.label || "").trim());
/** «Apertura · 10:00–17:00», «Cierre», «11:00–16:00». */
const calShiftText = (t) =>
  [t.label, t.from ? `${t.from}–${t.to}` : ""].filter(Boolean).join(" · ");
/** Tipos de turno para elegir: los habituales y los que ya se han escrito. */
const calShiftTypes = () => [
  ...new Set([
    "Apertura",
    "Cierre",
    "Partido",
    "Producción",
    "Mise en place",
    "Logística",
    "Libre",
    ...state.schedule.flatMap((d) =>
      d.shifts.map((x) => x.label).filter(Boolean),
    ),
  ]),
];
/** Lunes de la semana de un día. */
const calMonday = (day) =>
  shiftDay(day, -((new Date(day + "T12:00:00").getDay() + 6) % 7));
const calShortDay = (day) =>
  new Date(day + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
const calAway = (date) =>
  state.vacations.filter((v) => v.from <= date && date <= v.to);
const calHoursText = (h) =>
  h.closed
    ? "Cerrado según el horario"
    : h.open
      ? `Abre ${h.open} · cierra ${h.close}`
      : "Sin hora de apertura apuntada";
function calGo(view, value) {
  calView = view;
  if (view === "week") {
    calWeek = value;
    calWeekDraft = null;
    calMonth = value.slice(0, 7);
    calYear = Number(value.slice(0, 4));
  }
  if (view === "year") calYear = value;
  if (view === "month") {
    calMonth = value;
    calYear = Number(value.slice(0, 4));
  }
  if (view === "day") {
    calDay = value;
    calMonth = value.slice(0, 7);
    calYear = Number(value.slice(0, 4));
  }
  calData = null;
  render();
}
const kgText = (n) => num(n) + " kg";
const calCount = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Piezas de presentación del Calendario. Todo vive dentro de <div class="cal">, para que sus
// estilos no toquen la pantalla de Cruceros, que reutiliza algunas clases cal-*.
const calTag = (text, kind = "") =>
  `<span class="cal-tag ${kind}">${text}</span>`;
/** Tarjeta: cabecera (título, explicación y algo a la derecha) y cuerpo con margen. */
const calCard = (title, sub, body, { cls = "", aside = "", attrs = "" } = {}) =>
  `<section class="panel cal-card ${cls}" ${attrs}><header class="cal-card-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${aside}</header><div class="cal-card-body">${body}</div></section>`;
const calNone = (text) => `<p class="cal-none">${text}</p>`;
// Filas de «nombre … cifra».
function calList(items, empty) {
  return items.length
    ? `<ul class="cal-rows">${items.join("")}</ul>`
    : empty
      ? calNone(empty)
      : "";
}
const calRow = (left, right) =>
  `<li><span>${left}</span><span class="cal-row-value">${right}</span></li>`;
const calSection = (title, body) =>
  `<div class="cal-section"><h3>${title}</h3>${body}</div>`;
/** Barra de navegación: flecha, título (con algo debajo) y flecha. */
const calNav = (prev, title, next, below = "") =>
  `<div class="cal-bar">${prev}<div class="cal-bar-title"><h2>${title}</h2>${below}</div>${next}</div>`;
const calArrow = (dir, label, action, attrs) =>
  btn(
    dir < 0 ? "←" : "→",
    action,
    "secondary cal-arrow",
    `${attrs} aria-label="${esc(label)}" title="${esc(label)}"`,
  );
const calStat = (label, value, note = "") =>
  `<div class="cal-stat"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</div>`;
const calOrderStatus = (o) =>
  o.status === "sent" && o.sent
    ? "Enviado por WhatsApp"
    : statusLabel[o.status] || o.status;
const calProductionLabel = {
  applied: "aprobada",
  proposed: "propuesta sin aprobar",
  discarded: "descartada",
};

function calendarPage() {
  if (!calMonth) {
    calDay = businessToday();
    calMonth = calDay.slice(0, 7);
    calYear = Number(calDay.slice(0, 4));
  }
  // El horario de la semana se escribe con lo que ya tiene la pantalla: no pide nada al servidor.
  const ready = calView === "week" || (calData && calData.url === calUrl());
  if (!ready && !calBusy) loadCalendar();
  const step = (html) => `<li>${html}</li>`;
  const crumbs = [
    step(
      btn(String(calYear), "calYear", "text-link", `data-year="${calYear}"`),
    ),
    calView !== "year"
      ? step(
          btn(
            esc(calMonthName(calMonth).split(" ")[0]),
            "calMonth",
            "text-link",
            `data-month="${esc(calMonth)}"`,
          ),
        )
      : "",
    calView === "day"
      ? step(`<span aria-current="page">${Number(calDay.slice(8))}</span>`)
      : "",
    calView === "week"
      ? step(
          `<span aria-current="page">Horario de la semana del ${Number(calWeek.slice(8))}</span>`,
        )
      : "",
  ].join("");
  const body =
    calView === "week"
      ? calWeekView()
      : !ready
        ? '<div class="empty"><h3>Cargando el calendario…</h3></div>'
        : calData.error
          ? `<div class="empty"><h3>No se pudo cargar</h3><p>${esc(calData.error)}</p></div>`
          : calView === "year"
            ? calYearView(calData)
            : calView === "day"
              ? calDayView(calData)
              : calMonthView(calData);
  return (
    header(
      "Cada día, en su sitio.",
      "Elige un año, un mes y un día para ver lo que se apuntó: gelato, cierre, stock, horario, vacaciones, compras, notas, cruceros, clima y festivos. Lo que no está apuntado sale como «No disponible».",
      btn("Hoy", "calToday", "secondary") +
        btn(
          "Horario de la semana",
          "calWeek",
          "secondary",
          `data-week="${esc(calMonday(calDay || businessToday()))}"`,
        ) +
        btn(
          "Subir foto",
          "calPhoto",
          "primary",
          calView === "day" ? `data-date="${esc(calDay)}"` : "",
        ),
    ) +
    `<div class="cal"><nav class="cal-crumbs" aria-label="Dónde estás"><ol>${crumbs}</ol></nav>${body}</div>`
  );
}

function calYearView(y) {
  const cards = y.months
    .map((m) => {
      const used = m.daysWithSales || m.produced || m.notOpened;
      const buys = m.orders || m.receipts || m.messages;
      const rows = [
        used ? calRow("Vendido", kgText(m.sold)) : "",
        used ? calRow("Días con ventas", m.daysWithSales) : "",
        used ? calRow("Hecho", kgText(m.produced)) : "",
        used ? calRow("Cierres confirmados", m.confirmed) : "",
        m.notOpened ? calRow("Días sin abrir", m.notOpened) : "",
        buys ? calRow("Pedidos", m.orders) : "",
      ].join("");
      return `<button class="cal-month-card ${used ? "has-data" : ""}" data-action="calMonth" data-month="${esc(m.month)}"><strong>${esc(calMonthName(m.month).split(" ")[0])}</strong>${rows ? `<ul class="cal-rows">${rows}</ul>` : '<span class="cal-none">Sin nada apuntado</span>'}</button>`;
    })
    .join("");
  return `<section class="panel cal-card">${calNav(
    calArrow(-1, "Año " + (y.year - 1), "calYear", `data-year="${y.year - 1}"`),
    String(y.year),
    calArrow(1, "Año " + (y.year + 1), "calYear", `data-year="${y.year + 1}"`),
  )}<div class="cal-card-body"><div class="cal-year-grid">${cards}</div></div></section>`;
}

function calMonthView(m) {
  const today = businessToday();
  const cruiseOf = Object.fromEntries((m.cruises || []).map((c) => [c.day, c]));
  const ctx = m.context || {};
  const lead = (new Date(m.month + "-01T12:00:00").getDay() + 6) % 7;
  const cells = [
    ...Array.from(
      { length: lead },
      () => '<div class="cal-cell cal-empty" aria-hidden="true"></div>',
    ),
    ...m.days.map((d) => {
      const c = cruiseOf[d.date];
      const x = ctx[d.date];
      const weekday = (new Date(d.date + "T12:00:00").getDay() + 6) % 7;
      const tags = [
        d.notOpened ? calTag("No abrió", "closed") : "",
        d.sold ? calTag(kgText(d.sold) + " vendidos", "sales") : "",
        d.produced ? calTag("Hecho " + kgText(d.produced), "made") : "",
        d.hours
          ? calTag(
              d.hours.closed
                ? "Horario: cerrado"
                : d.hours.open
                  ? `${esc(d.hours.open)}–${esc(d.hours.close)}`
                  : "Turnos sin horario",
              "hours",
            )
          : "",
        d.away.length
          ? calTag("Vacaciones: " + d.away.map(esc).join(", "), "away")
          : "",
        d.notes ? calTag(calCount(d.notes, "nota", "notas"), "note") : "",
        d.orders ? calTag(calCount(d.orders, "pedido", "pedidos"), "buy") : "",
        d.receipts
          ? calTag(calCount(d.receipts, "entrega", "entregas"), "buy")
          : "",
        x?.holidays?.length ? calTag("Festivo", "holiday") : "",
        c?.ships
          ? calTag(calCount(c.ships, "crucero", "cruceros"), "cruise")
          : "",
      ].join("");
      const badges = [
        d.confirmed
          ? '<span class="cal-badge ok" title="Cierre confirmado">✓</span>'
          : "",
        d.alerts
          ? `<span class="cal-badge warn" title="${esc(calCount(d.alerts, "aviso", "avisos"))}">${d.alerts}</span>`
          : "",
      ].join("");
      const kind = d.notOpened ? "not-opened" : d.sold ? "has-sales" : "";
      return `<button class="cal-cell ${kind} ${d.date === today ? "today" : ""} ${weekday >= 5 ? "weekend" : ""}" data-action="calDay" data-date="${esc(d.date)}" aria-label="${esc(calLong(d.date))}${d.notOpened ? ", la tienda no abrió" : ""}${d.alerts ? ", " + calCount(d.alerts, "aviso", "avisos") : ""}"><span class="cal-cell-top"><span class="cal-num">${Number(d.date.slice(8))}</span>${badges}</span>${tags ? `<span class="cal-tags">${tags}</span>` : ""}</button>`;
    }),
  ].join("");
  const t = m.totals;
  const stats = [
    calStat(
      "Vendido",
      kgText(t.sold),
      `en ${calCount(t.daysWithSales, "día", "días")}`,
    ),
    calStat("Hecho", kgText(t.produced)),
    calStat("Merma", kgText(t.waste)),
    calStat(
      "Cierres confirmados",
      t.confirmed,
      t.notOpened
        ? calCount(t.notOpened, "día sin abrir", "días sin abrir")
        : "",
    ),
    calStat(
      "Compras",
      calCount(t.orders, "pedido", "pedidos"),
      `${calCount(t.receipts, "entrega", "entregas")} · ${calCount(t.messages, "mensaje", "mensajes")}`,
    ),
  ].join("");
  return `<section class="panel cal-card">${calNav(
    calArrow(
      -1,
      "Mes anterior",
      "calMonth",
      `data-month="${calShiftMonth(m.month, -1)}"`,
    ),
    esc(calMonthName(m.month)),
    calArrow(
      1,
      "Mes siguiente",
      "calMonth",
      `data-month="${calShiftMonth(m.month, 1)}"`,
    ),
  )}<div class="cal-card-body"><div class="cal-stats">${stats}</div><div class="cal-grid cal-month">${calWeekdays.map((w, i) => `<div class="cal-head ${i >= 5 ? "weekend" : ""}">${w}</div>`).join("")}${cells}</div><div class="cal-legend"><span class="cal-key has-sales">Con ventas</span><span class="cal-key not-opened">La tienda no abrió</span><span class="cal-key today">Hoy</span><span class="cal-key"><span class="cal-badge ok">✓</span> Cierre confirmado</span><span class="cal-key"><span class="cal-badge warn">1</span> Avisos</span></div>${m.cruises === null ? '<p class="cal-none">Cruceros, clima y festivos están desactivados en Configuración.</p>' : ""}</div></section>${calAlertsPanel(m.alerts, true)}`;
}

/** Avisos de las reglas: solo avisan; con days, cada aviso lleva a su día. */
function calAlertsPanel(alerts, days) {
  if (!alerts.length)
    return days
      ? `<section class="panel cal-card cal-all-good"><div class="cal-card-body"><p><strong>Avisos del mes:</strong> ninguno. Las reglas no encuentran nada que revisar.</p></div></section>`
      : "";
  const items = alerts
    .map(
      (a) =>
        `<li>${days ? btn(esc(calShortDay(a.date)), "calDay", "text-link", `data-date="${esc(a.date)}"`) : ""}<span>${esc(a.text)}</span></li>`,
    )
    .join("");
  return calCard(
    days ? "Avisos del mes" : "Avisos de este día",
    "Reglas fijas que miran lo apuntado: solo avisan, no cambian nada. La venta real se avisa si se aparta más de un 10 % de la estimada.",
    `<ul class="cal-alert-list">${items}</ul>`,
    { cls: "cal-alerts" },
  );
}

function calDayView(d) {
  const s = d.summary;
  const shown = s.closed && s.close ? s.close.snapshot : s.live;
  const t = shown.totals;
  const status = s.closed
    ? pill("Cierre confirmado", "sage")
    : s.close
      ? pill("Reabierto", "sand")
      : pill("Sin cierre confirmado", "neutral");
  const hours = d.schedule
    ? pill(
        d.schedule.closed
          ? "Horario: cerrado"
          : d.schedule.open
            ? `Abre ${esc(d.schedule.open)}–${esc(d.schedule.close)}`
            : "Turnos sin horario",
        "neutral",
      )
    : "";
  const mark = d.notOpened
    ? `<div class="cal-closed-note"><div><strong>La tienda no abrió este día.</strong>${d.notOpened.reason ? `<p>Motivo: ${esc(d.notOpened.reason)}</p>` : ""}</div>${btn("Quitar la marca", "calOpenedAgain", "secondary", `data-date="${esc(d.date)}"`)}</div>`
    : `<div class="cal-closed-note quiet"><p>¿La tienda cerró este día? Márcalo y no contará como un día sin ventas.</p>${btn("Marcar: la tienda no abrió", "calNotOpened", "secondary", `data-date="${esc(d.date)}"`)}</div>`;
  const top = `<section class="panel cal-card cal-day-top">${calNav(
    calArrow(
      -1,
      "Día anterior",
      "calDay",
      `data-date="${shiftDay(d.date, -1)}"`,
    ),
    esc(calLong(d.date)),
    calArrow(
      1,
      "Día siguiente",
      "calDay",
      `data-date="${shiftDay(d.date, 1)}"`,
    ),
    `<div class="cal-bar-pills">${status}${hours}${d.notOpened ? pill("No abrió", "sand") : ""}</div>`,
  )}<div class="cal-card-body">${mark}</div></section>`;
  const gelato = shown.rows.length
    ? `<div class="table-scroll"><table class="report-table cal-table"><thead><tr><th>Gelato</th><th class="num">Al empezar</th><th class="num">Hecho</th><th class="num">Vendido</th><th class="num">Merma</th><th class="num">Invitación</th><th class="num">Ajustes</th><th class="num">Queda</th></tr></thead><tbody>${shown.rows
        .map(
          (r) =>
            `<tr><td>${esc(r.name)}</td><td class="num">${num(r.opening)}</td><td class="num">${num(r.produced)}</td><td class="num">${num(r.sold)}</td><td class="num">${num(r.waste)}</td><td class="num">${num(r.gift)}</td><td class="num">${num(r.adjust)}</td><td class="num">${num(r.remaining)}</td></tr>`,
        )
        .join(
          "",
        )}</tbody><tfoot><tr><th>Total (kg)</th><th class="num">${num(t.opening)}</th><th class="num">${num(t.produced)}</th><th class="num">${num(t.sold)}</th><th class="num">${num(t.waste)}</th><th class="num">${num(t.gift)}</th><th class="num">${num(t.adjust)}</th><th class="num">${num(t.remaining)}</th></tr></tfoot></table></div><div class="cal-money"><span>Venta estimada <strong>${t.soldCents === null ? "No disponible" : money(t.soldCents)}</strong></span>${s.closed && s.close?.realSaleCents !== undefined ? `<span>Venta real <strong>${money(s.close.realSaleCents)}</strong></span>` : ""}${s.difference !== null ? `<span>Diferencia <strong>${s.difference < 0 ? "−" : "+"}${money(Math.abs(s.difference))}</strong></span>` : ""}</div>${t.soldCents === null ? '<p class="cal-none">Falta el valor de venta de algún gelato.</p>' : ""}${s.drift ? '<p class="ai-warning">El día está cerrado pero lo apuntado ya no coincide con lo que se guardó al cerrarlo.</p>' : ""}`
    : calNone("Sin gelato hecho, vendido ni mermado este día.");
  const made = [
    d.productions.length
      ? calSection(
          "Producciones",
          calList(
            d.productions.map((p) =>
              calRow(
                `${esc(p.name)} <small>${calProductionLabel[p.status]}</small>`,
                kgText(p.quantity),
              ),
            ),
          ),
        )
      : "",
    d.waste.length
      ? calSection(
          "Mermas por motivo",
          calList(
            d.waste.map((w) =>
              calRow(
                `${esc(w.name)} <small>${esc(w.reason)}</small>`,
                `${num(w.quantity)} ${esc(w.unit)}`,
              ),
            ),
          ),
        )
      : "",
  ].join("");
  const buys = [
    [
      "Pedidos hechos",
      d.orders,
      (o) =>
        calRow(
          `${esc(o.number)} <small>${esc(o.supplier)}</small>`,
          esc(calOrderStatus(o)),
        ),
    ],
    [
      "Entregas previstas",
      d.expected,
      (o) =>
        calRow(
          `${esc(o.number)} <small>${esc(o.supplier)}</small>`,
          esc(calOrderStatus(o)),
        ),
    ],
    [
      "Entregas recibidas",
      d.receipts,
      (r) => calRow(esc(r.name), `${num(r.quantity)} ${esc(r.unit)}`),
    ],
    [
      "Mensajes de proveedores",
      d.messages,
      (m) => calRow(esc(m.supplier), calCount(m.count, "mensaje", "mensajes")),
    ],
  ]
    .filter(([, list]) => list.length)
    .map(([title, list, row]) => calSection(title, calList(list.map(row))))
    .join("");
  const x = d.context;
  const c = d.cruise;
  const outside =
    d.cruise === null && d.context === null
      ? calNone(
          "Cruceros, clima y festivos: desactivados en Configuración o no disponibles.",
        )
      : `${calList(
          [
            calRow(
              "Festivo",
              x?.holidays?.length
                ? x.holidays.map((h) => esc(h.name)).join(", ")
                : "No",
            ),
            x?.events?.length
              ? calRow("Evento", x.events.map((e) => esc(e.name)).join(", "))
              : "",
            calRow(
              "Clima",
              x?.weather
                ? `${esc(x.weather.label || "—")} · ${num(x.weather.tMin)}–${num(x.weather.tMax)} °C · ${esc(x.weather.kind)}`
                : "No disponible",
            ),
            calRow(
              "Cruceros",
              c
                ? c.ships
                  ? `${c.ships} · ${esc(c.names.join(", "))} · impacto ${esc(c.impactLabel.toLowerCase())}`
                  : "Ninguno registrado"
                : "No disponible",
            ),
          ].filter(Boolean),
        )}<p class="cal-source">Fuentes: festivos del Govern balear, clima de MET Norway, cruceros de la Autoridad Portuaria de Baleares.</p>`;
  const gelatoCard = calCard(
    "Cuenta del día según la app",
    "Lo que dice el stock de la app, sin pesadas: al empezar + hecho − vendido − merma − invitación + ajustes = queda. Los ajustes son conteos y entradas o salidas a mano.",
    gelato +
      `<div class="setting-actions">${btn("Ir al cierre del día", "calToClose", "secondary", `data-date="${esc(d.date)}"`)}</div>`,
  );
  const left = [
    calCard(
      "Producción y mermas",
      "",
      made || calNone("Sin producciones ni mermas este día."),
    ),
    calCard(
      "Compras",
      "",
      buys ||
        calNone("Sin pedidos, entregas ni mensajes de proveedores este día."),
    ),
  ].join("");
  const right = [
    calSchedulePanel(d),
    calNotesPanel(d),
    calStockPanel(d),
    calCard("Fuera de la tienda", "", outside),
  ].join("");
  return `${top}${calAlertsPanel(d.alerts, false)}${calSheetPanel(d)}${gelatoCard}<div class="cal-day-cols"><div class="cal-col">${left}</div><div class="cal-col">${right}</div></div>`;
}

function calSchedulePanel(d) {
  const h = d.schedule;
  const body = [
    h
      ? `<p class="cal-lead">${esc(calHoursText(h))}</p>`
      : calNone("No disponible: el horario de esta semana no está apuntado."),
    h?.shifts.some((t) => !calIsOff(t))
      ? calSection(
          "Turnos",
          calList(
            h.shifts
              .filter((t) => !calIsOff(t))
              .map((t) => calRow(esc(t.person), esc(calShiftText(t)))),
          ),
        )
      : "",
    h?.shifts.some(calIsOff)
      ? `<p class="cal-none">Libran: ${h.shifts
          .filter(calIsOff)
          .map((t) => esc(t.person))
          .join(", ")}.</p>`
      : "",
    d.vacations.length
      ? calSection(
          "De vacaciones",
          calList(
            d.vacations.map((v) =>
              calRow(
                `${esc(v.person)}${v.note ? ` <small>${esc(v.note)}</small>` : ""}`,
                `del ${esc(calShortDay(v.from))} al ${esc(calShortDay(v.to))}`,
              ),
            ),
          ),
        )
      : "",
    `<div class="setting-actions">${btn("Horario de esta semana", "calWeek", "secondary", `data-week="${esc(calMonday(d.date))}"`)}${btn("Apuntar vacaciones", "calAddVacation", "secondary", `data-date="${esc(d.date)}"`)}</div>`,
  ].join("");
  return calCard("Horario y turnos", "", body);
}

function calStockPanel(d) {
  if (!d.stock)
    return calCard(
      "Stock al terminar el día",
      "",
      calNone("No disponible: este día todavía no ha llegado."),
    );
  const rows = (list) =>
    list.map((p) => calRow(esc(p.name), `${num(p.quantity)} ${esc(p.unit)}`));
  const gelatos = d.stock.filter((p) => p.gelato);
  const others = d.stock.filter((p) => !p.gelato);
  return calCard(
    "Stock al terminar el día",
    d.date === businessToday()
      ? "Hoy todavía no ha terminado: es lo que hay ahora."
      : "El stock de ahora menos lo que se movió los días siguientes.",
    calSection("Gelato", calList(rows(gelatos), "Ningún gelato.")) +
      (others.length
        ? `<details class="cal-more"><summary>Ingredientes y otros <span>${others.length}</span></summary>${calList(rows(others))}</details>`
        : ""),
  );
}

/** Formulario del horario de una semana: apertura por día (o cerrado) y turnos. */
function calWeekView() {
  const dates = Array.from({ length: 7 }, (_, i) => shiftDay(calWeek, i));
  const source =
    calWeekDraft ||
    dates.map(
      (date) =>
        state.schedule.find((x) => x.date === date) || {
          date,
          closed: false,
          shifts: [],
        },
    );
  const time = (k, value, label) =>
    `<input type="time" data-k="${k}" value="${esc(value || "")}" aria-label="${esc(label)}">`;
  const rows = source
    .map((d, i) => {
      const date = dates[i];
      const day = calShortDay(date);
      const [weekday, ...rest] = day.split(", ");
      const away = calAway(date).map((v) => v.person);
      const slots = Array.from(
        { length: Math.max(3, d.shifts.length + 1) },
        (_, j) => d.shifts[j] || { person: "", from: "", to: "" },
      );
      return `<div class="cal-week-row ${d.closed ? "is-closed" : ""}" data-week-day="${esc(date)}"><div class="cal-week-date"><strong>${esc(weekday)}</strong><span>${esc(rest.join(", "))}</span>${away.length ? `<small>De vacaciones: ${away.map(esc).join(", ")}</small>` : ""}</div><div class="cal-week-hours"><label class="check"><input type="checkbox" data-k="closed" ${d.closed ? "checked" : ""}> Cerrado</label><div class="cal-time-range"><label>Abre${time("open", d.open, "Abre el " + day)}</label><label>Cierra${time("close", d.close, "Cierra el " + day)}</label></div></div><div class="cal-shifts"><span class="cal-shifts-label">Turnos</span>${slots
        .map(
          (t, j) =>
            `<div class="cal-shift" data-shift><input type="text" data-k="person" maxlength="60" value="${esc(t.person)}" placeholder="Persona" aria-label="Turno ${j + 1} del ${esc(day)}: persona"><input type="text" data-k="label" maxlength="40" list="cal-shift-types" value="${esc(t.label || "")}" placeholder="Turno (Apertura…)" aria-label="Turno ${j + 1} del ${esc(day)}: tipo">${time("from", t.from, `Turno ${j + 1} del ${day}: desde`)}<span aria-hidden="true">–</span>${time("to", t.to, `Turno ${j + 1} del ${day}: hasta`)}</div>`,
        )
        .join("")}</div></div>`;
    })
    .join("");
  const vacations = state.vacations.filter(
    (v) => v.from <= dates[6] && dates[0] <= v.to,
  );
  return `<section class="panel cal-card" data-week="${esc(calWeek)}">${calNav(
    calArrow(
      -1,
      "Semana anterior",
      "calWeek",
      `data-week="${shiftDay(calWeek, -7)}"`,
    ),
    `Semana del ${esc(calShortDay(dates[0]))} al ${esc(calShortDay(dates[6]))}`,
    calArrow(
      1,
      "Semana siguiente",
      "calWeek",
      `data-week="${shiftDay(calWeek, 7)}"`,
    ),
  )}<div class="cal-card-body"><p class="cal-help">Escribe la hora de abrir y la de cerrar de cada día, o marca «Cerrado». En cada turno, la persona y su tipo (Apertura, Cierre, Libre…), sus horas o las dos cosas; si acaba después de medianoche, pon la hora tal cual. Un día sin nada escrito queda «sin horario apuntado». No cambia el stock ni las ventas.</p>${calWeekDraft ? '<p class="ai-warning">Copiado de la semana anterior: revísalo y pulsa «Guardar la semana». Aún no está guardado.</p>' : ""}<div class="cal-week-list">${rows}</div><datalist id="cal-shift-types">${calShiftTypes()
    .map((x) => `<option value="${esc(x)}">`)
    .join(
      "",
    )}</datalist><div class="setting-actions cal-week-actions">${btn("Guardar la semana", "calSaveWeek", "primary")}${btn("Copiar la semana anterior", "calCopyWeek", "secondary")}</div></div></section>${calCard(
    "Vacaciones de esta semana",
    "Van por persona: esos días no lleva turno. Si alguien de vacaciones tiene turno, el Calendario lo avisa.",
    calList(
      vacations.map((v) =>
        calRow(
          `${esc(v.person)} <small>del ${esc(calShortDay(v.from))} al ${esc(calShortDay(v.to))}${v.note ? " · " + esc(v.note) : ""}</small>`,
          btn(
            "Quitar",
            "calRemoveVacation",
            "text-link",
            `data-id="${esc(v.id)}"`,
          ),
        ),
      ),
      "Nadie de vacaciones esta semana.",
    ) +
      `<div class="setting-actions">${btn("Apuntar vacaciones", "calAddVacation", "secondary", `data-date="${esc(calWeek)}"`)}</div>`,
  )}`;
}

/** Lee el formulario de la semana; un turno a medias se dice, no se adivina. */
function calReadWeek(panel) {
  const k = (el, name) => el.querySelector(`[data-k="${name}"]`);
  return [...panel.querySelectorAll("[data-week-day]")].map((row) => {
    const date = row.dataset.weekDay;
    const shifts = [];
    for (const sh of row.querySelectorAll("[data-shift]")) {
      const person = k(sh, "person").value.trim();
      const label = k(sh, "label").value.trim();
      const from = k(sh, "from").value;
      const to = k(sh, "to").value;
      if (!person && !label && !from && !to) continue;
      if (!person)
        throw new Error(
          `${calShortDay(date)}: a un turno le falta la persona.`,
        );
      if (!from !== !to)
        throw new Error(
          `${calShortDay(date)}: el turno de ${person} lleva hora de empezar y de acabar, o ninguna.`,
        );
      if (!label && !from)
        throw new Error(
          `${calShortDay(date)}: al turno de ${person} le falta el tipo (Apertura, Cierre…) o las horas.`,
        );
      shifts.push({
        person,
        ...(label ? { label } : {}),
        ...(from ? { from, to } : {}),
      });
    }
    const open = k(row, "open").value;
    const close = k(row, "close").value;
    return {
      date,
      closed: k(row, "closed").checked,
      ...(open ? { open } : {}),
      ...(close ? { close } : {}),
      shifts,
    };
  });
}

// Botones del Calendario. Devuelve true si la acción era suya.
async function calendarAction(name, el) {
  if (name === "calOpenDay") {
    // Desde el Resumen: la ficha de ese día en el Calendario.
    calGo("day", el.dataset.date);
    nav("calendar");
    return true;
  }
  if (name === "calToday") {
    calGo("day", businessToday());
    return true;
  }
  if (name === "calYear") {
    calGo("year", Number(el.dataset.year));
    return true;
  }
  if (name === "calMonth") {
    calGo("month", el.dataset.month);
    return true;
  }
  if (name === "calDay") {
    calGo("day", el.dataset.date);
    return true;
  }
  if (name === "calWeek") {
    calGo("week", calMonday(el.dataset.week));
    return true;
  }
  if (name === "calCopyWeek") {
    // Trae la semana anterior al formulario, sin guardar; no copia el turno de quien está de
    // vacaciones ese día y lo dice.
    const skipped = [];
    calWeekDraft = Array.from({ length: 7 }, (_, i) => {
      const date = shiftDay(calWeek, i);
      const before = state.schedule.find((x) => x.date === shiftDay(date, -7));
      if (!before) return { date, closed: false, shifts: [] };
      const away = calAway(date).map((v) => v.person.toLocaleLowerCase("es"));
      const shifts = before.shifts.filter((t) => {
        const out = away.includes(t.person.trim().toLocaleLowerCase("es"));
        if (out) skipped.push(`${t.person} (${calShortDay(date)})`);
        return !out;
      });
      return { ...before, date, shifts };
    });
    if (!calWeekDraft.some((d) => d.closed || d.open || d.shifts.length)) {
      calWeekDraft = null;
      toast("La semana anterior no tiene horario apuntado.");
      return true;
    }
    render();
    toast(
      skipped.length
        ? `Copiada. No se copiaron turnos de quien está de vacaciones: ${skipped.join(", ")}.`
        : "Copiada la semana anterior. Revísala y guárdala.",
    );
    return true;
  }
  if (name === "calSaveWeek") {
    const panel = el.closest("[data-week]");
    let days;
    try {
      days = calReadWeek(panel);
    } catch (e) {
      toast(e.message);
      return true;
    }
    const saved = await mutate(
      { type: "setWeekSchedule", week: panel.dataset.week, days },
      "Horario de la semana guardado.",
    );
    if (saved) {
      calWeekDraft = null;
      calData = null;
      render();
    }
    return true;
  }
  if (name === "calAddVacation") {
    const from = el.dataset.date;
    const people = [
      ...new Set(
        [
          ...state.schedule.flatMap((d) => d.shifts.map((t) => t.person)),
          ...state.vacations.map((v) => v.person),
        ].map((p) => p.trim()),
      ),
    ].sort((a, b) => a.localeCompare(b, "es"));
    modal(
      "Apuntar vacaciones",
      "Por persona, de un día a otro (los dos incluidos). Esos días no lleva turno: si lo tiene, el Calendario lo avisa. No cambia nada más.",
      field(
        "Persona",
        "person",
        "",
        "text",
        'required maxlength="60" list="cal-people" autocomplete="off"',
      ) +
        `<datalist id="cal-people">${people.map((p) => `<option value="${esc(p)}">`).join("")}</datalist>` +
        field("Desde", "from", from, "date", "required") +
        field("Hasta", "to", from, "date", "required") +
        field("Nota (opcional)", "note", "", "text", 'maxlength="200"'),
      async (f) => {
        const saved = await mutate(
          {
            type: "addVacation",
            person: f.get("person") || "",
            from: f.get("from") || "",
            to: f.get("to") || "",
            note: f.get("note") || "",
          },
          "Vacaciones apuntadas.",
        );
        if (!saved) return false;
        calData = null;
        render();
        return true;
      },
      "Apuntar",
    );
    return true;
  }
  if (name === "calRemoveVacation") {
    const saved = await mutate(
      { type: "removeVacation", id: el.dataset.id },
      "Vacaciones quitadas.",
    );
    if (saved) {
      calData = null;
      render();
    }
    return true;
  }
  if (name === "calToClose") {
    dayDate = el.dataset.date;
    dayData = null;
    salesData = null;
    nav("production");
    return true;
  }
  if (name === "calNotOpened") {
    const day = el.dataset.date;
    modal(
      "La tienda no abrió el " + calLong(day),
      "El día queda marcado en el calendario. No cambia el stock ni ninguna cifra; solo evita que cuente como un día sin ventas. Se puede quitar cuando quieras.",
      field(
        "Motivo (opcional)",
        "reason",
        "",
        "text",
        'maxlength="200" placeholder="Festivo, vacaciones, avería…"',
      ),
      async (f) => {
        const saved = await mutate(
          { type: "markNotOpened", date: day, reason: f.get("reason") || "" },
          "Día marcado: la tienda no abrió.",
        );
        if (!saved) return false;
        calData = null;
        render();
        return true;
      },
      "Marcar el día",
    );
    return true;
  }
  if (name === "calOpenedAgain") {
    const saved = await mutate(
      { type: "unmarkNotOpened", date: el.dataset.date },
      "Marca quitada.",
    );
    if (saved) {
      calData = null;
      render();
    }
    return true;
  }
  return calendarPhotoAction(name, el);
}
