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
function calShiftDay(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
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
/** Lunes de la semana de un día. */
const calMonday = (day) =>
  calShiftDay(day, -((new Date(day + "T12:00:00").getDay() + 6) % 7));
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

function calendarPage() {
  if (!calMonth) {
    calDay = businessToday();
    calMonth = calDay.slice(0, 7);
    calYear = Number(calDay.slice(0, 4));
  }
  // El horario de la semana se escribe con lo que ya tiene la pantalla: no pide nada al servidor.
  const ready = calView === "week" || (calData && calData.url === calUrl());
  if (!ready && !calBusy) loadCalendar();
  const crumbs = `<div class="cal-crumbs" role="navigation" aria-label="Dónde estás">${btn(String(calYear), "calYear", "text-link", `data-year="${calYear}"`)}${calView !== "year" ? ` <span>/</span> ${btn(esc(calMonthName(calMonth)), "calMonth", "text-link", `data-month="${esc(calMonth)}"`)}` : ""}${calView === "day" ? ` <span>/</span> <strong>${Number(calDay.slice(8))}</strong>` : ""}${calView === "week" ? ` <span>/</span> <strong>Horario de la semana del ${Number(calWeek.slice(8))}</strong>` : ""}</div>`;
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
      "Elige un año, un mes y un día para ver lo que se apuntó ese día: gelato hecho, vendido y mermado, cierre, stock, horario y turnos, vacaciones, compras, mensajes, cruceros, clima y festivos. Lo que no está apuntado sale como «No disponible».",
      btn("Hoy", "calToday", "secondary") +
        btn(
          "Horario de la semana",
          "calWeek",
          "secondary",
          `data-week="${esc(calMonday(calDay || businessToday()))}"`,
        ),
    ) +
    crumbs +
    body
  );
}

function calYearView(y) {
  const cards = y.months
    .map(
      (m) =>
        `<button class="cal-month-card ${m.daysWithSales || m.produced ? "has-data" : ""}" data-action="calMonth" data-month="${esc(m.month)}"><strong>${esc(calMonthName(m.month).split(" ")[0])}</strong>${
          m.daysWithSales || m.produced || m.notOpened
            ? `<span>Vendido ${kgText(m.sold)} · ${m.daysWithSales} ${m.daysWithSales === 1 ? "día" : "días"} con ventas</span><span>Hecho ${kgText(m.produced)} · merma ${kgText(m.waste)}</span><span>${m.confirmed} ${m.confirmed === 1 ? "cierre confirmado" : "cierres confirmados"}${m.notOpened ? ` · ${m.notOpened} sin abrir` : ""}</span>`
            : "<span>Sin gelato apuntado</span>"
        }${
          m.orders || m.receipts || m.messages
            ? `<span>${calCount(m.orders, "pedido", "pedidos")} · ${calCount(m.receipts, "entrega", "entregas")} · ${calCount(m.messages, "mensaje", "mensajes")}</span>`
            : ""
        }</button>`,
    )
    .join("");
  return `<section class="panel"><div class="cal-nav">${btn("← " + (y.year - 1), "calYear", "secondary", `data-year="${y.year - 1}"`)}<h3>${y.year}</h3>${btn(y.year + 1 + " →", "calYear", "secondary", `data-year="${y.year + 1}"`)}</div><div class="cal-year-grid">${cards}</div></section>`;
}

function calMonthView(m) {
  const today = businessToday();
  const cruiseOf = Object.fromEntries((m.cruises || []).map((c) => [c.day, c]));
  const ctx = m.context || {};
  const lead = (new Date(m.month + "-01T12:00:00").getDay() + 6) % 7;
  const cells = [
    ...Array.from(
      { length: lead },
      () => '<div class="cal-cell cal-empty"></div>',
    ),
    ...m.days.map((d) => {
      const c = cruiseOf[d.date];
      const x = ctx[d.date];
      const lines = [];
      if (d.notOpened) lines.push("<span>No abrió</span>");
      if (d.sold) lines.push(`<span>Vendido ${kgText(d.sold)}</span>`);
      if (d.produced) lines.push(`<span>Hecho ${kgText(d.produced)}</span>`);
      if (d.orders)
        lines.push(`<span>${calCount(d.orders, "pedido", "pedidos")}</span>`);
      if (d.receipts)
        lines.push(
          `<span>${calCount(d.receipts, "entrega", "entregas")}</span>`,
        );
      if (d.hours)
        lines.push(
          `<span>${d.hours.closed ? "Horario: cerrado" : d.hours.open ? `${esc(d.hours.open)}–${esc(d.hours.close)}` : "Turnos sin horario"}</span>`,
        );
      if (d.away.length)
        lines.push(`<span>Vacaciones: ${d.away.map(esc).join(", ")}</span>`);
      if (!lines.length) lines.push("<span>—</span>");
      const marks = [
        d.alerts
          ? `<i class="cal-mark warn">${calCount(d.alerts, "aviso", "avisos")}</i>`
          : "",
        d.confirmed ? '<i class="cal-mark">Cerrado</i>' : "",
        x?.holidays?.length ? '<i class="cal-mark">Festivo</i>' : "",
        c?.ships
          ? `<i class="cal-mark">${c.ships} ${c.ships === 1 ? "crucero" : "cruceros"}</i>`
          : "",
      ].join("");
      return `<button class="cal-cell ${d.notOpened ? "not-opened" : d.sold ? "has-sales" : ""} ${d.date === today ? "today" : ""}" data-action="calDay" data-date="${esc(d.date)}" aria-label="${esc(calLong(d.date))}${d.notOpened ? ", la tienda no abrió" : ""}"><b>${Number(d.date.slice(8))}</b>${lines.join("")}${marks}</button>`;
    }),
  ].join("");
  const t = m.totals;
  return `<section class="panel"><div class="cal-nav">${btn("← Mes anterior", "calMonth", "secondary", `data-month="${calShiftMonth(m.month, -1)}"`)}<h3>${esc(calMonthName(m.month))}</h3>${btn("Mes siguiente →", "calMonth", "secondary", `data-month="${calShiftMonth(m.month, 1)}"`)}</div><p class="cal-summary">Gelato vendido ${kgText(t.sold)} en ${t.daysWithSales} ${t.daysWithSales === 1 ? "día" : "días"} · hecho ${kgText(t.produced)} · merma ${kgText(t.waste)} · ${t.confirmed} ${t.confirmed === 1 ? "cierre confirmado" : "cierres confirmados"}${t.notOpened ? ` · ${t.notOpened} ${t.notOpened === 1 ? "día" : "días"} sin abrir` : ""} · ${calCount(t.orders, "pedido", "pedidos")} · ${calCount(t.receipts, "entrega recibida", "entregas recibidas")} · ${calCount(t.messages, "mensaje", "mensajes")} de proveedores</p><div class="cal-grid">${calWeekdays.map((w) => `<div class="cal-head">${w}</div>`).join("")}${cells}</div><p class="cal-legend"><span class="cal-key has-sales">Con ventas</span><span class="cal-key not-opened">La tienda no abrió</span><span class="cal-key">Sin ventas apuntadas</span></p>${m.cruises === null ? '<p class="muted">Cruceros, clima y festivos están desactivados en Configuración.</p>' : ""}</section>${calAlertsPanel(m.alerts, true)}`;
}

/** Avisos de las reglas: solo avisan; con days, cada aviso lleva a su día. */
function calAlertsPanel(alerts, days) {
  if (!alerts.length)
    return days
      ? '<section class="panel"><h2>Avisos del mes</h2><p class="muted">Ningún aviso: las reglas no encuentran nada que revisar.</p></section>'
      : "";
  const items = alerts
    .map(
      (a) =>
        `<li>${days ? btn(esc(calShortDay(a.date)), "calDay", "text-link", `data-date="${esc(a.date)}"`) + " · " : ""}${esc(a.text)}</li>`,
    )
    .join("");
  return `<section class="panel cal-alerts"><h2>${days ? "Avisos del mes" : "Avisos de este día"}</h2><p>Reglas fijas que miran lo apuntado: solo avisan, no cambian nada. Una venta real se avisa si se aparta más de un 10 % de la estimada.</p><ul>${items}</ul></section>`;
}

function calList(items, empty) {
  return items.length
    ? `<table class="report-table"><tbody>${items.join("")}</tbody></table>`
    : `<p class="muted">${empty}</p>`;
}
const calRow = (left, right) =>
  `<tr><td>${left}</td><td class="num">${right}</td></tr>`;
const calOrderStatus = (o) =>
  o.status === "sent" && o.sent
    ? "Enviado por WhatsApp"
    : statusLabel[o.status] || o.status;
const calProductionLabel = {
  applied: "aprobada",
  proposed: "propuesta sin aprobar",
  discarded: "descartada",
};

function calDayView(d) {
  const s = d.summary;
  const shown = s.closed && s.close ? s.close.snapshot : s.live;
  const t = shown.totals;
  const status = s.closed
    ? pill("Cierre confirmado", "sage")
    : s.close
      ? pill("Reabierto", "sand")
      : pill("Sin cierre confirmado", "neutral");
  const mark = d.notOpened
    ? `<div class="cal-closed-note"><strong>La tienda no abrió este día.</strong>${d.notOpened.reason ? `<p>Motivo: ${esc(d.notOpened.reason)}</p>` : ""}${btn("Quitar la marca", "calOpenedAgain", "secondary", `data-date="${esc(d.date)}"`)}</div>`
    : `<div class="cal-closed-note quiet"><p>¿La tienda cerró este día? Márcalo y no contará como un día sin ventas.</p>${btn("Marcar: la tienda no abrió", "calNotOpened", "secondary", `data-date="${esc(d.date)}"`)}</div>`;
  const gelato = shown.rows.length
    ? `<div class="table-scroll"><table class="report-table"><thead><tr><th>Gelato</th><th class="num">Al empezar</th><th class="num">Hecho</th><th class="num">Vendido</th><th class="num">Merma</th><th class="num">Invitación</th><th class="num">Ajustes</th><th class="num">Queda</th></tr></thead><tbody>${shown.rows
        .map(
          (r) =>
            `<tr><td>${esc(r.name)}</td><td class="num">${num(r.opening)}</td><td class="num">${num(r.produced)}</td><td class="num">${num(r.sold)}</td><td class="num">${num(r.waste)}</td><td class="num">${num(r.gift)}</td><td class="num">${num(r.adjust)}</td><td class="num">${num(r.remaining)}</td></tr>`,
        )
        .join(
          "",
        )}</tbody><tfoot><tr><th>Total (kg)</th><th class="num">${num(t.opening)}</th><th class="num">${num(t.produced)}</th><th class="num">${num(t.sold)}</th><th class="num">${num(t.waste)}</th><th class="num">${num(t.gift)}</th><th class="num">${num(t.adjust)}</th><th class="num">${num(t.remaining)}</th></tr></tfoot></table></div><p>Venta estimada: ${t.soldCents === null ? "No disponible (falta el valor de venta de algún gelato)" : money(t.soldCents)}${s.closed && s.close?.realSaleCents !== undefined ? ` · venta real ${money(s.close.realSaleCents)}` : ""}${s.difference !== null ? ` · diferencia ${s.difference < 0 ? "−" : "+"}${money(Math.abs(s.difference))}` : ""}</p>${s.drift ? '<p class="ai-warning">El día está cerrado pero lo apuntado ya no coincide con lo que se guardó al cerrarlo.</p>' : ""}`
    : '<p class="muted">Sin gelato hecho, vendido ni mermado este día.</p>';
  const x = d.context;
  const c = d.cruise;
  const outside =
    d.cruise === null && d.context === null
      ? '<p class="muted">Cruceros, clima y festivos: desactivados en Configuración o no disponibles.</p>'
      : `<table class="report-table"><tbody>${calRow("Festivo", x?.holidays?.length ? x.holidays.map((h) => esc(h.name)).join(", ") : "No")}${x?.events?.length ? calRow("Evento", x.events.map((e) => esc(e.name)).join(", ")) : ""}${calRow("Clima", x?.weather ? `${esc(x.weather.label || "—")} · ${num(x.weather.tMin)}–${num(x.weather.tMax)} °C · ${esc(x.weather.kind)}` : "No disponible")}${calRow("Cruceros", c ? (c.ships ? `${c.ships} · ${esc(c.names.join(", "))} · impacto ${esc(c.impactLabel.toLowerCase())}` : "Ninguno registrado") : "No disponible")}</tbody></table><small>Fuentes: festivos del Govern balear, clima de MET Norway, cruceros de la Autoridad Portuaria de Baleares.</small>`;
  return `<section class="panel"><div class="cal-nav">${btn("← Día anterior", "calDay", "secondary", `data-date="${calShiftDay(d.date, -1)}"`)}<h3>${esc(calLong(d.date))}</h3>${btn("Día siguiente →", "calDay", "secondary", `data-date="${calShiftDay(d.date, 1)}"`)}</div>${mark}</section>${calAlertsPanel(d.alerts, false)}<div class="cal-day-grid"><section class="panel"><div class="panel-heading"><div><h2>Gelato del día</h2><p>Al empezar + hecho − vendido − merma − invitación + ajustes = queda. Los ajustes son conteos y entradas o salidas a mano.</p></div>${status}</div>${gelato}${btn("Ir al cierre del día", "calToClose", "secondary", `data-date="${esc(d.date)}"`)}</section><section class="panel"><h2>Mermas por motivo</h2>${calList(
    d.waste.map((w) =>
      calRow(
        `${esc(w.name)} · ${esc(w.reason)}`,
        `${num(w.quantity)} ${esc(w.unit)}`,
      ),
    ),
    "Sin mermas apuntadas.",
  )}<h2>Producciones</h2>${calList(
    d.productions.map((p) =>
      calRow(
        `${esc(p.name)} · ${calProductionLabel[p.status]}`,
        kgText(p.quantity),
      ),
    ),
    "Sin producciones este día.",
  )}</section><section class="panel"><h2>Compras</h2><h3>Pedidos hechos</h3>${calList(
    d.orders.map((o) =>
      calRow(`${esc(o.number)} · ${esc(o.supplier)}`, esc(calOrderStatus(o))),
    ),
    "Ninguno.",
  )}<h3>Entregas previstas</h3>${calList(
    d.expected.map((o) =>
      calRow(`${esc(o.number)} · ${esc(o.supplier)}`, esc(calOrderStatus(o))),
    ),
    "Ninguna.",
  )}<h3>Entregas recibidas</h3>${calList(
    d.receipts.map((r) =>
      calRow(esc(r.name), `${num(r.quantity)} ${esc(r.unit)}`),
    ),
    "Ninguna.",
  )}<h3>Mensajes de proveedores</h3>${calList(
    d.messages.map((m) =>
      calRow(
        esc(m.supplier),
        `${m.count} ${m.count === 1 ? "mensaje" : "mensajes"}`,
      ),
    ),
    "Ninguno.",
  )}</section>${calSchedulePanel(d)}${calStockPanel(d)}<section class="panel"><h2>Fuera de la tienda</h2>${outside}</section></div>`;
}

function calSchedulePanel(d) {
  const h = d.schedule;
  const shifts = h?.shifts.length
    ? calList(
        h.shifts.map((t) =>
          calRow(esc(t.person), `${esc(t.from)}–${esc(t.to)}`),
        ),
        "",
      )
    : '<p class="muted">Sin turnos apuntados.</p>';
  const away = d.vacations.length
    ? calList(
        d.vacations.map((v) =>
          calRow(
            `${esc(v.person)}${v.note ? " · " + esc(v.note) : ""}`,
            `del ${esc(v.from)} al ${esc(v.to)}`,
          ),
        ),
        "",
      )
    : '<p class="muted">Nadie de vacaciones.</p>';
  return `<section class="panel"><h2>Horario y turnos</h2><p>${h ? esc(calHoursText(h)) : "No disponible: el horario de esta semana no está apuntado."}</p>${shifts}<h3>Vacaciones</h3>${away}<div class="setting-actions">${btn("Horario de esta semana", "calWeek", "secondary", `data-week="${esc(calMonday(d.date))}"`)}${btn("Apuntar vacaciones", "calAddVacation", "secondary", `data-date="${esc(d.date)}"`)}</div></section>`;
}

function calStockPanel(d) {
  if (!d.stock)
    return '<section class="panel"><h2>Stock al terminar el día</h2><p class="muted">No disponible: este día todavía no ha llegado.</p></section>';
  const part = (rows, empty) =>
    calList(
      rows.map((p) => calRow(esc(p.name), `${num(p.quantity)} ${esc(p.unit)}`)),
      empty,
    );
  return `<section class="panel"><h2>Stock al terminar el día</h2><p>${d.date === businessToday() ? "Hoy todavía no ha terminado: es lo que hay ahora." : "El stock de ahora menos lo que se movió los días siguientes."}</p><h3>Gelato</h3>${part(
    d.stock.filter((p) => p.gelato),
    "Ningún gelato.",
  )}<h3>Ingredientes y otros</h3>${part(
    d.stock.filter((p) => !p.gelato),
    "Ninguno.",
  )}</section>`;
}

/** Formulario del horario de una semana: apertura por día (o cerrado) y turnos. */
function calWeekView() {
  const dates = Array.from({ length: 7 }, (_, i) => calShiftDay(calWeek, i));
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
      const away = calAway(date).map((v) => v.person);
      const slots = Array.from(
        { length: Math.max(3, d.shifts.length + 1) },
        (_, j) => d.shifts[j] || { person: "", from: "", to: "" },
      );
      return `<tr data-week-day="${esc(date)}"><th><span class="cal-week-day">${esc(day)}</span>${away.length ? `<small>De vacaciones: ${away.map(esc).join(", ")}</small>` : ""}</th><td><label class="check"><input type="checkbox" data-k="closed" ${d.closed ? "checked" : ""}> Cerrado</label></td><td>${time("open", d.open, "Abre el " + day)}</td><td>${time("close", d.close, "Cierra el " + day)}</td><td class="cal-shifts">${slots
        .map(
          (t, j) =>
            `<div class="cal-shift" data-shift><input type="text" data-k="person" maxlength="60" value="${esc(t.person)}" placeholder="Persona" aria-label="Turno ${j + 1} del ${esc(day)}: persona">${time("from", t.from, `Turno ${j + 1} del ${day}: desde`)}${time("to", t.to, `Turno ${j + 1} del ${day}: hasta`)}</div>`,
        )
        .join("")}</td></tr>`;
    })
    .join("");
  const vacations = state.vacations.filter(
    (v) => v.from <= dates[6] && dates[0] <= v.to,
  );
  return `<section class="panel" data-week="${esc(calWeek)}"><div class="cal-nav">${btn("← Semana anterior", "calWeek", "secondary", `data-week="${calShiftDay(calWeek, -7)}"`)}<h3>Semana del ${esc(calShortDay(dates[0]))} al ${esc(calShortDay(dates[6]))}</h3>${btn("Semana siguiente →", "calWeek", "secondary", `data-week="${calShiftDay(calWeek, 7)}"`)}</div><p>Escribe la hora de abrir y la de cerrar de cada día, o marca «Cerrado». En cada turno: la persona y de qué hora a qué hora; si un turno acaba después de medianoche, pon la hora tal cual. Un día sin nada escrito queda «sin horario apuntado». No cambia el stock ni las ventas.</p>${calWeekDraft ? '<p class="ai-warning">Copiado de la semana anterior: revísalo y pulsa «Guardar la semana». Aún no está guardado.</p>' : ""}<div class="table-scroll"><table class="report-table cal-week"><thead><tr><th>Día</th><th></th><th>Abre</th><th>Cierra</th><th>Turnos (persona, desde, hasta)</th></tr></thead><tbody>${rows}</tbody></table></div><div class="setting-actions">${btn("Guardar la semana", "calSaveWeek", "primary")}${btn("Copiar la semana anterior", "calCopyWeek", "secondary")}</div></section><section class="panel"><h2>Vacaciones de esta semana</h2><p>Van por persona: esos días no lleva turno. Si alguien de vacaciones tiene turno, el Calendario lo avisa.</p>${calList(
    vacations.map((v) =>
      calRow(
        `${esc(v.person)} · del ${esc(v.from)} al ${esc(v.to)}${v.note ? " · " + esc(v.note) : ""}`,
        btn(
          "Quitar",
          "calRemoveVacation",
          "text-link",
          `data-id="${esc(v.id)}"`,
        ),
      ),
    ),
    "Nadie de vacaciones esta semana.",
  )}${btn("Apuntar vacaciones", "calAddVacation", "secondary", `data-date="${esc(calWeek)}"`)}</section>`;
}

/** Lee el formulario de la semana; un turno a medias se dice, no se adivina. */
function calReadWeek(panel) {
  const k = (el, name) => el.querySelector(`[data-k="${name}"]`);
  return [...panel.querySelectorAll("[data-week-day]")].map((row) => {
    const date = row.dataset.weekDay;
    const shifts = [];
    for (const sh of row.querySelectorAll("[data-shift]")) {
      const person = k(sh, "person").value.trim();
      const from = k(sh, "from").value;
      const to = k(sh, "to").value;
      if (!person && !from && !to) continue;
      if (!person || !from || !to)
        throw new Error(
          `${calShortDay(date)}: a un turno le falta la persona o una de las horas.`,
        );
      shifts.push({ person, from, to });
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
      const date = calShiftDay(calWeek, i);
      const before = state.schedule.find(
        (x) => x.date === calShiftDay(date, -7),
      );
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
  return false;
}
