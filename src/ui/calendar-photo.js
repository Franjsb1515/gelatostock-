// Fotos del Calendario (core/dayphoto.ts, servidor /api/calendar/photo): la foto se lee en este
// equipo y la app propone a qué día y a qué apartado va (horario, ventas, documento o nota). Nada
// se guarda hasta que la persona revisa la propuesta y pulsa el botón. Lo que no se lee no se
// rellena: la foto se queda en su día y se escribe a mano.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
const calKindLabel = {
  schedule: "Horario de la semana",
  sales: "Ventas del día",
  document: "Factura o albarán (va a Documentos)",
  note: "Nota del día",
};
const calWeekdayName = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

function calNotesPanel(d) {
  const items = d.notes
    .map(
      (n) =>
        `<li class="cal-note">${n.photo ? `<img src="/api/photos/${esc(n.photo)}" alt="Foto del día" loading="lazy">` : ""}<div><p>${n.text ? esc(n.text) : '<span class="muted">Foto sin texto: escribe lo que dice cuando quieras.</span>'}</p><small>Apuntada el ${esc(date(n.at))}</small> ${n.photo && !n.text ? btn("Escribir lo que dice", "calNoteText", "text-link", `data-date="${esc(d.date)}"`) : ""}${n.text ? btn(n.photo ? "Quitar el texto" : "Quitar", "calRemoveNote", "text-link", `data-id="${esc(n.id)}"`) : ""}</div></li>`,
    )
    .join("");
  return `<section class="panel"><h2>Notas y fotos</h2>${items ? `<ul class="cal-notes">${items}</ul>` : '<p class="muted">Ninguna.</p>'}<div class="setting-actions">${btn("Escribir una nota", "calAddNote", "secondary", `data-date="${esc(d.date)}"`)}${btn("Subir foto de este día", "calPhoto", "secondary", `data-date="${esc(d.date)}"`)}</div></section>`;
}

/** Detalle de la propuesta según el apartado elegido. */
function calPhotoDetail(r, kind) {
  if (kind === "schedule")
    return r.schedule.length
      ? `<table class="report-table"><tbody>${r.schedule
          .map(
            (d) =>
              `<tr><td>${calWeekdayName[d.weekday]}</td><td>${d.closed ? "Cerrado" : d.open ? `Abre ${esc(d.open)} · cierra ${esc(d.close)}` : "Sin hora de apertura"}${d.shifts.map((s) => `<br>${esc(s.person)} ${esc(s.from)}–${esc(s.to)}`).join("")}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table><p class="fineprint">Al pulsar el botón se abre el horario de esa semana con esto escrito, para que lo revises y lo guardes.</p>`
      : '<p class="muted">No se leyó ningún día: se abre el horario de esa semana vacío para escribirlo mirando la foto.</p>';
  if (kind === "sales")
    return `${
      r.sales.length
        ? r.sales
            .map(
              (l) =>
                `<fieldset class="cal-sale"><legend>${esc(l.name)}</legend><small>En la foto: «${esc(l.line)}»</small>${field("Vendido (kg)", "sold:" + l.product, l.sold, "number", 'min="0" max="100000" step="0.001"')}${field("Merma (kg)", "waste:" + l.product, l.waste, "number", 'min="0" max="100000" step="0.001"')}<label class="field">Motivo de la merma<select name="reason:${esc(l.product)}">${options([["", "Elige si hay merma"], ...Object.entries(wasteReasons)], "")}</select></label>${field("Invitación o consumo (kg)", "gift:" + l.product, l.gift, "number", 'min="0" max="100000" step="0.001"')}</fieldset>`,
            )
            .join("")
        : '<p class="muted">No se reconoció ningún gelato tuyo con cantidades. Apunta las ventas en el cierre del día.</p>'
    }${r.unknown.length ? `<p class="ai-warning">No se apuntan (no se sabe qué gelato es): ${r.unknown.map((u) => "«" + esc(u) + "»").join(", ")}</p>` : ""}<p class="fineprint">Al pulsar el botón se apunta el cierre de ese día con estas cantidades, igual que en Producción.</p>`;
  if (kind === "document")
    return (
      select(
        "Proveedor",
        "supplier",
        [
          ["", "Sin proveedor (elígelo después)"],
          ...state.suppliers.map((s) => [s.id, s.name]),
        ],
        r.document?.supplier || "",
      ) +
      '<p class="fineprint">Se guarda en Documentos con esa fecha, como cualquier factura o albarán. Las cantidades no cambian.</p>'
    );
  return `<label class="field">Lo que dice la foto (corrígelo si hace falta)<textarea name="note" maxlength="4000" rows="6">${esc(r.note)}</textarea></label>`;
}

function calPhotoModal(preset) {
  let serial = 0,
    reading = null,
    data = "",
    name = "";
  modal(
    "Subir una foto al Calendario",
    "Horario, ventas, una factura o albarán, o una nota. La foto se lee en este equipo y la app propone dónde va; no se guarda nada hasta que pulses el botón.",
    `<label class="upload-zone">${icon("photo")}<strong>Elige una foto</strong><span>JPG, PNG o WebP hasta 5 MB</span><input name="photo" type="file" accept="image/png,image/jpeg,image/webp" required></label><p class="detection-status" role="status">Lo escrito a mano se lee peor que lo impreso: revisa siempre la propuesta.</p><div id="cal-photo-proposal"></div>`,
    async (f) => {
      if (!reading) throw Error("Espera a que termine la lectura de la foto.");
      const day = f.get("date");
      if (!day) throw Error("Elige el día de la foto.");
      const kind = f.get("kind");
      if (kind === "document")
        return mutate(
          {
            type: "photo",
            name,
            data,
            ocrText: reading.text,
            supplier: f.get("supplier") || undefined,
            documentDate: day,
            note: "Subida desde el Calendario",
          },
          "Guardada en Documentos.",
        );
      if (kind === "sales") {
        const lines = reading.reading.sales
          .map((l) => {
            const num = (k) => Number(f.get(k + ":" + l.product) || 0);
            const waste = num("waste");
            const reason = f.get("reason:" + l.product);
            if (waste > 0 && !reason)
              throw Error(`Elige el motivo de la merma de ${l.name}.`);
            return {
              product: l.product,
              sold: num("sold"),
              waste,
              gift: num("gift"),
              ...(waste > 0 ? { wasteReason: reason } : {}),
            };
          })
          .filter((l) => l.sold || l.waste || l.gift);
        if (!lines.length)
          throw Error(
            "No hay cantidades que apuntar. Cambia el apartado a «Nota del día» o apúntalas en Producción.",
          );
        const sold = await mutate(
          { type: "dailySales", date: day, lines },
          "Ventas del día apuntadas desde la foto.",
        );
        if (!sold) return false;
      }
      const saved = await mutate(
        {
          type: "calendarPhoto",
          date: day,
          name,
          data,
          ocrText: reading.text,
          note: kind === "note" ? f.get("note") || "" : "",
        },
        kind === "sales" ? "" : "Foto guardada en su día.",
      );
      if (!saved) return false;
      calData = null;
      if (kind === "schedule") {
        const week = calMonday(day);
        calGo("week", week);
        calWeekDraft = Array.from({ length: 7 }, (_, i) => {
          const r = reading.reading.schedule.find((x) => x.weekday === i);
          return {
            date: shiftDay(week, i),
            closed: !!r?.closed,
            ...(r?.open ? { open: r.open, close: r.close } : {}),
            shifts: r?.shifts || [],
          };
        });
        render();
        toast(
          "Horario leído de la foto: revísalo y pulsa «Guardar la semana».",
        );
      } else calGo("day", day);
      return true;
    },
    "Guardar",
  );
  const form = $("#modal-form");
  const box = form.querySelector("#cal-photo-proposal");
  const draw = (kind) => {
    const r = reading.reading;
    box.innerHTML = `<label class="field">Apartado<select name="kind">${options(
      Object.entries(calKindLabel),
      kind,
    )}</select></label><label class="field">Día${r.date ? "" : preset ? " (la foto no lo dice: es el día que tenías abierto)" : " (la foto no lo dice: elígelo)"}<input name="date" type="date" value="${esc(r.date || preset || "")}" required></label><ul class="cal-reasons">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${r.skipped.length ? `<div class="ai-warning"><p>No se usa (revísalo mirando la foto):</p><ul>${r.skipped.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}${calPhotoDetail(r, kind)}<img class="photo-preview" src="${esc(data)}" alt="La foto que se está leyendo"><details><summary>Texto leído de la foto</summary><textarea readonly rows="6">${esc(reading.text)}</textarea></details>`;
    box
      .querySelector("select[name=kind]")
      .addEventListener("change", (e) => draw(e.target.value));
  };
  form
    .querySelector("input[name=photo]")
    .addEventListener("change", async (e) => {
      const current = ++serial,
        file = e.target.files[0],
        button = form.querySelector("button[type=submit]"),
        status = form.querySelector(".detection-status");
      reading = null;
      box.innerHTML = "";
      if (!file) return;
      button.disabled = true;
      status.textContent = "Leyendo la foto en este equipo…";
      try {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 5000000
        )
          throw Error("Usa JPG, PNG o WebP de hasta 5 MB.");
        const read = await readFile(file);
        if (current !== serial || $("#modal-form") !== form) return;
        const result = await request("/api/calendar/photo", { data: read });
        if (current !== serial || $("#modal-form") !== form) return;
        data = read;
        name = file.name;
        reading = result;
        status.textContent = result.reading.kind
          ? "Propuesta: revisa el apartado, el día y lo leído antes de guardar."
          : "No se pudo leer: la foto se guarda en su día y puedes escribir lo que dice.";
        draw(result.reading.kind || "note");
      } catch (err) {
        if (current === serial && $("#modal-form") === form)
          status.textContent = err.message;
      } finally {
        if (current === serial && $("#modal-form") === form)
          button.disabled = false;
      }
    });
}

// Botones de fotos y notas del Calendario. Devuelve true si la acción era suya.
async function calendarPhotoAction(name, el) {
  if (name === "calPhoto") {
    calPhotoModal(el.dataset.date || "");
    return true;
  }
  if (name === "calAddNote" || name === "calNoteText") {
    const day = el.dataset.date;
    modal(
      "Nota del " + calLong(day),
      "Lo que quieras recordar de ese día. No cambia el stock ni ninguna cifra.",
      `<label class="field">Nota<textarea name="text" maxlength="4000" rows="5" required></textarea></label>`,
      async (f) => {
        const saved = await mutate(
          { type: "addDayNote", date: day, text: f.get("text") || "" },
          "Nota apuntada.",
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
  if (name === "calRemoveNote") {
    const saved = await mutate(
      { type: "removeDayNote", id: el.dataset.id },
      "Nota quitada.",
    );
    if (saved) {
      calData = null;
      render();
    }
    return true;
  }
  return false;
}
