// Ficha de producción del día (core/sheet.ts), como la hoja «Producción gelato Artello»: pesada de
// la mañana (medido), producción, ventas y mermas apuntadas (confirmado) y lo calculado
// (estimado). Pesar no cambia stock ni ventas; apuntar la venta estimada pasa por el cierre del
// día de siempre, una sola vez. Los módulos de src/ui comparten el ámbito global.
const sheetKg = (n) => (n === null ? "—" : num(n));
const sheetMoney = (c) => (c === null ? "No disponible" : money(c));
const sheetDate = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
const sheetSource = (kind) =>
  `<span class="sheet-src ${kind}">${{ medido: "Medido", confirmado: "Confirmado", estimado: "Estimado" }[kind]}</span>`;

function sheetPeriodText(p) {
  if (!p) return "Sin datos todavía.";
  const parts = [
    `${calCount(p.daysProduced, "día", "días")} con producción`,
    p.daysZero
      ? `${calCount(p.daysZero, "día", "días")} con datos y sin producción`
      : "",
    p.daysNoData ? `${calCount(p.daysNoData, "día", "días")} sin datos` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}
function sheetSoldText(p) {
  if (!p || (!p.daysEstimated && !p.daysMissing)) return "No disponible";
  return p.daysMissing
    ? `${kgText(p.sold)} (faltan pesadas de ${calCount(p.daysMissing, "día", "días")})`
    : kgText(p.sold);
}

function sheetTable(rows, totals, title) {
  if (!rows.length) return "";
  const cell = (r, v, cls = "") =>
    `<td class="num ${cls}">${r.noData ? "" : v}</td>`;
  const body = rows
    .map((r) => {
      const reg =
        r.registered === null
          ? "—"
          : `${num(r.registered)}${r.difference ? ` <small class="${Math.abs(r.difference) > 0 ? "sheet-diff" : ""}">(${r.difference > 0 ? "+" : "−"}${num(Math.abs(r.difference))})</small>` : ""}`;
      return `<tr class="${r.noData ? "sheet-nodata" : ""} ${r.impossible ? "sheet-bad" : ""}"><td>${esc(r.name)}${r.noData ? ' <small class="cal-none">Sin datos</small>' : ""}${r.counted ? ' <small class="cal-none" title="Un conteo corrige el libro, no la cubeta: no entra en la cuenta">· conteo</small>' : ""}</td>${cell(r, sheetKg(r.start))}${cell(r, num(r.produced))}${cell(r, sheetKg(r.end))}${cell(r, num(r.waste))}${cell(r, num(r.gift))}${cell(r, num(r.moved))}${cell(r, r.sold === null ? '<span class="cal-none">No disp.</span>' : num(r.sold), "sheet-sold")}${cell(r, reg)}${cell(r, r.sold === null ? "" : sheetMoney(r.soldCents))}</tr>`;
    })
    .join("");
  const t = totals;
  return `<div class="table-scroll"><table class="report-table cal-table sheet-table"><caption>${title}</caption><thead><tr><th>Sabor</th><th class="num sheet-h medido">Al empezar</th><th class="num sheet-h confirmado">Producido</th><th class="num sheet-h medido">Al terminar</th><th class="num sheet-h confirmado">Merma</th><th class="num sheet-h confirmado">Invitación</th><th class="num sheet-h confirmado">Entr./sal.</th><th class="num sheet-h estimado">Vendido</th><th class="num sheet-h confirmado">Apuntado</th><th class="num sheet-h estimado">Factur.</th></tr></thead><tbody>${body}</tbody>${t.empty ? `<tfoot><tr><th>Total (kg)</th><th class="num" colspan="9">Sin datos este día</th></tr></tfoot>` : `<tfoot><tr><th>Total (kg)</th><th class="num">${sheetKg(t.start)}</th><th class="num">${num(t.produced)}</th><th class="num">${sheetKg(t.end)}</th><th class="num">${num(t.waste)}</th><th class="num">${num(t.gift)}</th><th class="num">${num(t.moved)}</th><th class="num">${t.sold === null ? "No disp." : num(t.sold)}</th><th class="num">${t.registered === null ? "—" : num(t.registered)}</th><th class="num">${sheetMoney(t.soldCents)}</th></tr></tfoot>`}</table></div>`;
}

/** Mínimos de la mañana: lo pesado (más lo producido ese día) frente al mínimo de cada sabor. */
function sheetMinBlock(sh) {
  const mi = sh.minimum;
  const edit = btn("Mínimos por sabor", "sheetMins", "text-link");
  if (!mi.configured)
    return `<div class="sheet-min quiet"><p>Pon unos kilos mínimos por sabor y la pesada de la mañana avisará de los que se quedan cortos.</p>${edit}</div>`;
  const skipBtn = (p, skip, label) =>
    btn(
      label,
      "sheetSkip",
      "text-link",
      `data-date="${esc(mi.date)}" data-product="${esc(p)}" data-skip="${skip ? "1" : ""}"`,
    );
  const below = mi.below.length
    ? `<ul class="sheet-min-list">${mi.below
        .map(
          (b) =>
            `<li><div><strong>${esc(b.name)}</strong><small>${num(b.start)} kg pesados${b.produced ? ` + ${num(b.produced)} kg producidos` : ""} · mínimo ${num(b.min)} kg</small></div><span class="sheet-min-miss">Faltan ${num(b.missing)} kg</span>${skipBtn(b.product, true, "Hoy no se hace")}</li>`,
        )
        .join("")}</ul>`
    : mi.checked
      ? `<p class="sheet-min-ok">Los sabores pesados llegan a su mínimo.</p>`
      : "";
  const extra = [
    mi.skipped.length
      ? `<p class="cal-none">No se hacen este día: ${mi.skipped
          .map(
            (x) =>
              `${esc(x.name)} ${skipBtn(x.product, false, "volver a avisar")}`,
          )
          .join(" · ")}</p>`
      : "",
    mi.unweighed.length
      ? `<p class="cal-none">Con mínimo y sin pesar esta mañana (no se sabe): ${esc(mi.unweighed.join(", "))}.</p>`
      : "",
    mi.paused
      ? `<p class="cal-none">${calCount(mi.paused, "sabor en pausa", "sabores en pausa")}: no avisan.</p>`
      : "",
  ].join("");
  return `<div class="sheet-min ${mi.below.length ? "warn" : ""}"><div class="sheet-min-head"><strong>Mínimos de la mañana</strong>${edit}</div>${below}${extra}</div>`;
}

function calSheetPanel(d) {
  const sh = d.sheet;
  if (!sh) return "";
  const date = d.date;
  if (!sh.rows.length)
    return calCard(
      "Producción del día",
      "Para pesar cada mañana, primero da de alta tus sabores de gelato y sorbetto.",
      `<div class="setting-actions">${btn("Dar de alta sabores", "sheetFlavors", "primary")}</div>`,
    );
  const t = sh.totals.all;
  const used = sh.rows.filter((r) => !r.noData);
  const next = shiftDay(date, 1);
  const missingEnd = used.filter((r) => r.end === null).length;
  const missingStart = used.filter((r) => r.start === null).length;
  const bad = sh.rows.filter((r) => r.impossible);
  const diffBook = sh.rows.filter(
    (r) => r.start !== null && Math.abs(r.start - r.book) >= 0.001,
  );
  const notes = [
    missingStart
      ? `Falta la pesada de la mañana del ${sheetDate(date)} en ${calCount(missingStart, "sabor", "sabores")}.`
      : "",
    missingEnd
      ? next > sh.today
        ? `Lo vendido hoy se sabrá con la pesada de mañana (${sheetDate(next)}).`
        : `Falta la pesada de la mañana del ${sheetDate(next)} en ${calCount(missingEnd, "sabor", "sabores")}: sin ella no se puede estimar lo vendido.`
      : "",
  ].filter(Boolean);
  const canRecord =
    !sh.closed &&
    used.length &&
    t.sold !== null &&
    !bad.length &&
    used.every((r) => r.registered === null) &&
    used.some((r) => r.sold > 0) &&
    !diffBook.length;
  const stats = [
    calStat("Producido este día", kgText(t.produced), "producción aprobada"),
    calStat(
      "Día anterior",
      kgText(sh.previous.produced),
      `vendido ${sheetSoldText(sh.previous).toLowerCase()}`,
    ),
    calStat(
      `Semana ${sheetDate(sh.week.from)} – ${sheetDate(shiftDay(sh.week.from, 6))}`,
      kgText(sh.week.produced),
      `vendido ${sheetSoldText(sh.week).toLowerCase()}`,
    ),
    calStat(
      sh.history
        ? `Histórico desde el ${sheetDate(sh.history.from)}`
        : "Histórico",
      sh.history ? kgText(sh.history.produced) : "Sin datos",
      sh.history ? `vendido ${sheetSoldText(sh.history).toLowerCase()}` : "",
    ),
  ].join("");
  const moneyBlock = `<div class="sheet-money"><div class="sheet-money-row"><span>Vendido ${sheetSource("estimado")}</span><strong>${t.sold === null ? "No disponible" : kgText(t.sold)}</strong></div><div class="sheet-money-row main"><span>Facturación con el precio de cada sabor ${sheetSource("estimado")}</span><strong>${sheetMoney(t.soldCents)}</strong></div><div class="sheet-money-row"><span>Facturación con tu precio de referencia${sh.referencePrice === null ? "" : ` (${money(sh.referencePrice)} el kilo)`} ${sheetSource("estimado")}</span><strong>${sh.referencePrice === null ? "Sin precio de referencia" : sheetMoney(t.referenceCents)}</strong>${btn(sh.referencePrice === null ? "Poner precio" : "Cambiar", "sheetRefPrice", "text-link", `data-date="${esc(date)}"`)}</div><div class="sheet-money-row"><span>Venta real de caja ${sheetSource("confirmado")}</span><strong>${sh.realSaleCents === null ? (sh.closed ? "No escrita" : "Se escribe al confirmar el cierre") : money(sh.realSaleCents)}</strong></div>${t.soldCents === null && t.sold !== null ? `<p class="cal-none">Falta el valor de venta por kilo de algún sabor (Recetario): el total no está disponible.</p>` : ""}</div>`;
  const actions = [
    btn(
      "Pesar esta mañana",
      "sheetWeigh",
      "primary",
      `data-date="${esc(date)}"`,
    ),
    canRecord
      ? btn(
          "Apuntar lo vendido estimado en el cierre",
          "sheetRecord",
          "secondary",
          `data-date="${esc(date)}"`,
        )
      : "",
    date === sh.today && diffBook.length
      ? btn(
          "Igualar el stock de la app a la pesada",
          "sheetCount",
          "secondary",
          `data-date="${esc(date)}"`,
        )
      : "",
    btn("Dar de alta sabores", "sheetFlavors", "secondary"),
  ].join("");
  const gel = sh.rows.filter((r) => r.family === "gelato");
  const sor = sh.rows.filter((r) => r.family === "sorbetto");
  return calCard(
    "Producción del día",
    "Vendido = al empezar + producido − al terminar − merma − invitación + entradas y salidas. «Al terminar» es la pesada de la mañana siguiente. Pesar no cambia el stock ni las ventas.",
    `<div class="cal-stats">${stats}</div>${moneyBlock}${
      notes.length || bad.length || diffBook.length
        ? `<ul class="sheet-notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}${bad.map((r) => `<li class="bad">${esc(r.name)}: la cuenta da ${num(r.sold)} kg (menos de cero). Revisa las pesadas o lo apuntado.</li>`).join("")}${
            diffBook.length
              ? `<li>La pesada no coincide con el stock de la app en ${calCount(diffBook.length, "sabor", "sabores")} (${diffBook
                  .slice(0, 4)
                  .map(
                    (r) =>
                      `${esc(r.name)}: pesada ${num(r.start)} kg, app ${num(r.book)} kg`,
                  )
                  .join(
                    "; ",
                  )}${diffBook.length > 4 ? "…" : ""}). Para apuntar lo vendido en el cierre tienen que coincidir.${date === sh.today ? " Usa «Igualar el stock de la app a la pesada»." : " Solo la pesada de hoy puede igualar el stock: apunta ese cierre en Producción."}</li>`
              : ""
          }</ul>`
        : ""
    }${sheetMinBlock(sh)}<p class="sheet-legend">${sheetSource("medido")} lo que pesas tú ${sheetSource("confirmado")} lo apuntado en la app ${sheetSource("estimado")} lo calculado</p>${sheetTable(gel, sh.totals.gelato, "Gelatos")}${sheetTable(sor, sh.totals.sorbetto, "Sorbettos")}<p class="cal-source">Medido: lo que pesas tú. Confirmado: producción aprobada, ventas, mermas, invitaciones y entradas o salidas apuntadas. Estimado: lo calculado. Un conteo de Inventario no entra en la cuenta: corrige el stock de la app, no la cubeta.</p><div class="setting-actions">${actions}</div>`,
    { cls: "sheet-card" },
  );
}

function sheetWeighModal(date) {
  const sh = calData?.sheet;
  if (!sh) return;
  let unit = "g";
  try {
    unit = localStorage.getItem("gelato-weigh-unit") === "kg" ? "kg" : "g";
  } catch {}
  const shown = (kg) =>
    kg === null
      ? ""
      : unit === "g"
        ? String(Math.round(kg * 1000))
        : String(kg);
  const group = (family, title) => {
    const rows = sh.rows.filter((r) => r.family === family);
    return rows.length
      ? `<fieldset class="sheet-weigh"><legend>${title}</legend>${rows
          .map(
            (r) =>
              `<label class="sheet-weigh-row"><span>${esc(r.name)}</span><input type="text" inputmode="decimal" autocomplete="off" name="w:${esc(r.product)}" value="${esc(shown(r.start))}" data-kg="${r.start === null ? "" : r.start}"></label>`,
          )
          .join("")}</fieldset>`
      : "";
  };
  modal(
    "Pesada de la mañana · " + calLong(date),
    "Peso del gelato de cada cubeta (sin la cubeta). Deja en blanco lo que no pesas; un 0 es una cubeta vacía. Es una medición: no cambia el stock ni las ventas.",
    `<label class="field">Unidad<select name="unit" id="sheet-unit">${options(
      [
        ["g", "Gramos (como en la hoja: 8000 = 8 kg)"],
        ["kg", "Kilos (8 = 8 kg)"],
      ],
      unit,
    )}</select></label>${group("gelato", "Gelatos")}${group("sorbetto", "Sorbettos")}`,
    async (f) => {
      const u = f.get("unit") === "kg" ? "kg" : "g";
      const lines = sh.rows.map((r) => {
        const raw = String(f.get("w:" + r.product) ?? "")
          .trim()
          .replace(",", ".");
        if (raw === "") return { product: r.product, value: null };
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0)
          throw Error(`${r.name}: escribe un número (o déjalo en blanco).`);
        return { product: r.product, value: n };
      });
      // Solo lo que cambia; si no hay nada, no se guarda.
      const changed = lines.filter((l) => {
        const before = sh.rows.find((r) => r.product === l.product).start;
        const kgNow =
          l.value === null ? null : u === "g" ? l.value / 1000 : l.value;
        return before === null
          ? kgNow !== null
          : kgNow === null || Math.abs(kgNow - before) >= 0.0005;
      });
      if (!changed.length) return true;
      try {
        localStorage.setItem("gelato-weigh-unit", u);
      } catch {}
      const saved = await mutate(
        { type: "setWeighings", date, unit: u, lines: changed },
        "Pesada apuntada.",
      );
      if (!saved) return false;
      calData = null;
      render();
      return true;
    },
    "Guardar la pesada",
  );
  // Al cambiar de unidad se convierten los números ya escritos, sin perderlos.
  $("#sheet-unit").addEventListener("change", (e) => {
    const to = e.target.value;
    for (const input of document.querySelectorAll(".sheet-weigh-row input")) {
      const v = input.value.trim().replace(",", ".");
      if (v !== "" && Number.isFinite(Number(v))) {
        const kgv = unit === "g" ? Number(v) / 1000 : Number(v);
        input.value =
          to === "g"
            ? String(Math.round(kgv * 1000))
            : String(Math.round(kgv * 1000) / 1000);
      }
    }
    unit = to;
  });
}

// Botones de la ficha de producción. Devuelve true si la acción era suya.
async function calendarSheetAction(name, el) {
  if (name === "sheetWeigh") {
    sheetWeighModal(el.dataset.date);
    return true;
  }
  if (name === "sheetFlavors") {
    modal(
      "Dar de alta sabores",
      "Solo el nombre y el tipo. Un sabor por línea. Los ingredientes se añaden después en el Recetario; mientras no los tenga, producir suma gelato pero no descuenta ingredientes y su coste sale «No disponible».",
      `${select(
        "Tipo",
        "family",
        [
          ["crema", "Gelato"],
          ["sorbete", "Sorbetto"],
        ],
        "crema",
      )}<label class="field">Sabores (uno por línea)<textarea name="names" rows="10" required placeholder="Fior di panna&#10;Stracciatella&#10;Yogurt"></textarea></label>`,
      async (f) => {
        const names = String(f.get("names") || "")
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter(Boolean);
        if (!names.length) throw Error("Escribe al menos un sabor.");
        const saved = await mutate(
          { type: "quickFlavors", family: f.get("family"), names },
          "Sabores dados de alta.",
        );
        if (!saved) return false;
        calData = null;
        render();
        return true;
      },
      "Dar de alta",
    );
    return true;
  }
  if (name === "sheetRefPrice") {
    const current = calData?.sheet?.referencePrice;
    modal(
      "Precio de referencia por kilo",
      "Tu precio de kilo (el del gelato más caro). Sirve solo para la segunda estimación de facturación; no cambia el valor de cada sabor.",
      field(
        "Euros por kilo",
        "euros",
        current ? (current / 100).toFixed(2) : "",
        "number",
        'min="0.01" max="100000" step="0.01" required',
      ) + field("Vale desde", "from", el.dataset.date, "date", "required"),
      async (f) => {
        const cents = Math.round(Number(f.get("euros")) * 100);
        if (!(cents > 0)) throw Error("Escribe un precio mayor que cero.");
        const saved = await mutate(
          { type: "setReferencePrice", cents, from: f.get("from") },
          "Precio de referencia guardado.",
        );
        if (!saved) return false;
        calData = null;
        render();
        return true;
      },
    );
    return true;
  }
  if (name === "sheetRecord") {
    const sh = calData?.sheet;
    const lines = sh.rows
      .filter((r) => !r.noData && r.sold > 0)
      .map((r) => ({ product: r.product, sold: r.sold, waste: 0, gift: 0 }));
    modal(
      "Apuntar lo vendido estimado",
      "Se apunta como venta del cierre de ese día, igual que en Producción. Las mermas y las invitaciones ya apuntadas no cambian. Se puede deshacer desde el cierre del día.",
      `<ul class="cal-rows">${lines
        .map((l) =>
          calRow(
            esc(sh.rows.find((r) => r.product === l.product).name),
            kgText(l.sold),
          ),
        )
        .join("")}</ul>`,
      async () => {
        const saved = await mutate(
          { type: "dailySales", date: el.dataset.date, lines },
          "Venta del día apuntada desde la pesada.",
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
  if (name === "sheetSkip") {
    const saved = await mutate(
      {
        type: "skipFlavor",
        date: el.dataset.date,
        product: el.dataset.product,
        skip: el.dataset.skip === "1",
      },
      el.dataset.skip === "1"
        ? "Ese día no se hace: no avisará."
        : "Vuelve a avisar ese día.",
    );
    if (saved) {
      calData = null;
      render();
    }
    return true;
  }
  if (name === "sheetMins") {
    const sh = calData?.sheet;
    if (!sh) return true;
    const rows = sh.rows.map((r) => ({
      ...r,
      p: state.products.find((x) => x.id === r.product),
    }));
    const group = (family, title) => {
      const list = rows.filter((r) => r.family === family);
      return list.length
        ? `<fieldset class="sheet-weigh sheet-mins"><legend>${title}</legend>${list
            .map(
              (r) =>
                `<div class="sheet-weigh-row"><span>${esc(r.name)}</span><input type="text" inputmode="decimal" autocomplete="off" name="m:${esc(r.product)}" value="${r.p?.minKg ?? ""}" aria-label="Mínimo de ${esc(r.name)} en kilos"><label class="check"><input type="checkbox" name="p:${esc(r.product)}" ${r.p?.paused ? "checked" : ""}> En pausa</label></div>`,
            )
            .join("")}</fieldset>`
        : "";
    };
    modal(
      "Mínimos por sabor",
      "Kilos que debería tener cada cubeta al pesarla por la mañana. Si lo pesado más lo producido ese día no llega, la ficha y el Resumen avisan. En blanco: sin mínimo. «En pausa»: fuera de temporada, no avisa. Solo avisa: no produce ni cambia nada.",
      group("gelato", "Gelatos (kg)") + group("sorbetto", "Sorbettos (kg)"),
      async (f) => {
        const lines = [];
        for (const r of rows) {
          const raw = String(f.get("m:" + r.product) ?? "")
            .trim()
            .replace(",", ".");
          const minKg = raw === "" ? null : Number(raw);
          if (minKg !== null && !(Number.isFinite(minKg) && minKg > 0))
            throw Error(
              `${r.name}: escribe un número mayor que 0 o déjalo en blanco.`,
            );
          const paused = f.get("p:" + r.product) === "on";
          if ((r.p?.minKg ?? null) === minKg && !!r.p?.paused === paused)
            continue;
          lines.push({ product: r.product, minKg, paused });
        }
        if (!lines.length) return true;
        const saved = await mutate(
          { type: "setFlavorMins", lines },
          "Mínimos guardados.",
        );
        if (!saved) return false;
        calData = null;
        render();
        return true;
      },
      "Guardar mínimos",
    );
    return true;
  }
  if (name === "sheetCount") {
    modal(
      "Igualar el stock de la app a la pesada",
      "Para cada sabor pesado hoy que todavía no ha tenido movimientos hoy, el stock de la app pasa a ser lo pesado (un conteo, como en Inventario). Un conteo corrige el stock; nunca es una venta.",
      "",
      async () => {
        const saved = await mutate(
          { type: "weighingCounts", date: el.dataset.date },
          "Stock igualado a la pesada.",
        );
        if (!saved) return false;
        calData = null;
        render();
        return true;
      },
      "Igualar",
    );
    return true;
  }
  return false;
}
