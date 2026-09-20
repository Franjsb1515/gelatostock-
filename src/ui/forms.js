// Campos, modales y formularios de conteo y fotos.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
// «Cantidad que hay ahora en kg»: la unidad del producto, nunca la palabra «unidad base».
const unitName = { kg: "kilos", L: "litros", ud: "unidades" };
function unitLabel(text, p) {
  return `${text} en ${unitName[p.unit] || p.unit}`;
}
// Cambia el texto de la etiqueta de un campo ya dibujado (y el de sus botones − y +).
function retitleField(input, label) {
  const tag =
    input.closest("label") ||
    input.closest(".field")?.querySelector("label") ||
    null;
  if (tag && tag.firstChild && tag.firstChild.nodeType === 3)
    tag.firstChild.nodeValue = label;
  else if (tag) tag.textContent = label;
  const box = input.closest(".stepper");
  if (box)
    for (const b of box.querySelectorAll(".step"))
      b.setAttribute(
        "aria-label",
        (b.dataset.step === "-1" ? "Menos " : "Más ") + label,
      );
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
// Numeric field with − / + buttons. `stepBy` is the amount each press adds (default: the input step).
let stepperSeq = 0;
function stepperField(label, name, value = 1, extra = "", stepBy = "") {
  const id = "stepper-" + ++stepperSeq;
  // The buttons live outside the <label> so they don't become part of the field's accessible name.
  return `<div class="field"><label for="${id}">${esc(label)}</label><div class="stepper"><button type="button" class="step" data-step="-1" aria-label="Menos ${esc(label)}">−</button><input id="${id}" class="quantity" name="${name}" type="number" value="${esc(value)}" ${stepBy ? `data-step-by="${esc(stepBy)}"` : ""} ${extra}><button type="button" class="step" data-step="1" aria-label="Más ${esc(label)}">+</button></div></div>
`;
}
function options(items, current) {
  return items
    .map(
      ([v, label]) =>
        `<option value="${esc(v)}" ${v === current ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join("");
}
function select(label, name, items, current) {
  return `<label class="field">${esc(label)}<select name="${name}">${options(items, current)}</select></label>`;
}
function modal(title, description, body, onSubmit, label = "Guardar") {
  const d = $("#modal");
  d.innerHTML = `<form id="modal-form"><div class="modal-heading"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div><button type="button" class="icon-button" data-action="close" aria-label="Cerrar">${icon("close")}</button></div><div class="modal-body">${body}<p id="form-error" role="alert"></p></div><div class="modal-footer"><button type="button" class="btn secondary" data-action="close">Cancelar</button><button class="btn primary" type="submit">${label}</button></div></form>`;
  d.showModal();
  $("#modal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.submitter;
    button.disabled = true;
    try {
      const ok = await onSubmit(new FormData(e.currentTarget));
      if (ok !== false) d.close();
    } catch (err) {
      $("#form-error").textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}
function count(id) {
  const p = product(id) || state.products[0];
  modal(
    "Registrar un conteo",
    "Indica cuánto hay ahora. Reemplaza el stock contado; no suma una entrada.",
    select(
      "Producto",
      "product",
      state.products.map((p) => [p.id, `${p.name} (${p.unit})`]),
      p.id,
    ) +
      field(
        unitLabel("Cantidad que hay ahora", p),
        "value",
        p.stock,
        "number",
        'min="0" max="1000000" step="0.001" required',
      ) +
      field(
        "Motivo",
        "reason",
        "Conteo manual",
        "text",
        "required maxlength=500",
      ),
    async (f) =>
      mutate(
        {
          type: "count",
          product: f.get("product"),
          value: Number(f.get("value")),
          reason: f.get("reason"),
        },
        "Conteo guardado en este equipo.",
      ),
  );
  $("#modal-form select").addEventListener("change", (e) => {
    const chosen = product(e.target.value);
    const input = $("#modal-form input[name=value]");
    input.value = chosen.stock;
    retitleField(input, unitLabel("Cantidad que hay ahora", chosen));
  });
}
function photoFields(ph) {
  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 10);
  return (
    select(
      "Proveedor del documento",
      "supplier",
      [["", "Sin proveedor"], ...state.suppliers.map((s) => [s.id, s.name])],
      ph?.supplier || "",
    ) +
    field(
      "Fecha del documento",
      "documentDate",
      ph?.documentDate || ph?.at?.slice(0, 10) || localDate,
      "date",
      "required",
    )
  );
}
function showDetection(form, result, manual) {
  const box = form.querySelector(".detection-status");
  const selected = form.querySelector("select[name=supplier]");
  if (!manual) selected.value = result.supplier || "";
  box.textContent = result.supplier
    ? "Proveedor propuesto: " +
      supplier(result.supplier).name +
      ". " +
      result.reason +
      " Confirma o corrige antes de guardar."
    : result.reason;
}
function photo() {
  let serial = 0,
    manual = false;
  modal(
    "Añadir un documento",
    "Foto o PDF. El texto se lee en este equipo para proponer proveedor, tipo y pedido. Las cantidades no cambian.",
    '<p class="detection-status" role="status">Al elegir el archivo se buscará su proveedor entre tus fichas.</p>' +
      photoFields() +
      `<label class="upload-zone">${icon("photo")}<strong>Elige una foto o un PDF</strong><span>JPG, PNG, WebP hasta 5 MB · PDF hasta 10 MB</span><input name="photo" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required></label><div id="photo-preview"></div><details><summary>Texto leído del documento</summary><label class="field">Texto leído<textarea name="ocrText" maxlength="20000" readonly></textarea></label></details><label class="field">Nota<textarea name="note" maxlength="500"></textarea></label><p class="fineprint">Guardar confirma el proveedor seleccionado. Puedes elegirlo manualmente si la lectura falla.</p>`,
    async (f) => {
      const file = f.get("photo");
      const pdf = file.type === "application/pdf";
      if (
        !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(
          file.type,
        ) ||
        file.size > (pdf ? 10000000 : 5000000)
      )
        throw Error("Usa JPG, PNG o WebP de hasta 5 MB, o PDF de hasta 10 MB.");
      return mutate(
        {
          type: "photo",
          name: file.name,
          data: await readFile(file),
          note: f.get("note"),
          ocrText: f.get("ocrText"),
          supplier: f.get("supplier") || undefined,
          documentDate: f.get("documentDate"),
        },
        "Documento guardado con su proveedor.",
      );
    },
    "Guardar documento",
  );
  const form = $("#modal-form");
  form
    .querySelector("select[name=supplier]")
    .addEventListener("change", () => (manual = true));
  form
    .querySelector("input[name=photo]")
    .addEventListener("change", async (e) => {
      const current = ++serial,
        file = e.target.files[0],
        button = form.querySelector("button[type=submit]");
      form.querySelector("textarea[name=ocrText]").value = "";
      if (!manual) form.querySelector("select[name=supplier]").value = "";
      form.querySelector("#photo-preview").innerHTML = "";
      if (!file) return;
      button.disabled = true;
      form.querySelector(".detection-status").textContent =
        "Leyendo la foto en este equipo…";
      try {
        if (file.type === "application/pdf") {
          if (file.size > 10000000) throw Error("El PDF supera 10 MB.");
          form.querySelector(".detection-status").textContent =
            "Leyendo el texto del PDF en este equipo. No se envía a ninguna parte.";
          const data = await readFile(file);
          if (current !== serial || $("#modal-form") !== form) return;
          const result = await request("/api/pdf", { data });
          if (current !== serial || $("#modal-form") !== form) return;
          form.querySelector("textarea[name=ocrText]").value = result.text;
          form.querySelector("#photo-preview").innerHTML = result.text
            ? `<p class="muted">PDF de ${result.pages} página${result.pages === 1 ? "" : "s"} leído. Mira «Texto leído del documento» para comprobarlo.</p>`
            : `<p class="muted">${esc(result.reason)}</p>`;
          if (result.text) showDetection(form, result.detection, manual);
          else
            form.querySelector(".detection-status").textContent = result.reason;
          return;
        }
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 5000000
        )
          throw Error("Usa JPG, PNG o WebP de hasta 5 MB.");
        const data = await readFile(file);
        if (current !== serial || $("#modal-form") !== form) return;
        form.querySelector("#photo-preview").innerHTML =
          `<img class="photo-preview" src="${esc(data)}" alt="Vista previa de la foto">`;
        const result = await request("/api/ocr", { data });
        if (current !== serial || $("#modal-form") !== form) return;
        form.querySelector("textarea[name=ocrText]").value = result.text;
        showDetection(form, result.detection, manual);
      } catch (e) {
        if (current === serial && $("#modal-form") === form)
          form.querySelector(".detection-status").textContent =
            e.message + " Puedes elegir el proveedor manualmente.";
      } finally {
        if (current === serial && $("#modal-form") === form)
          button.disabled = false;
      }
    });
}
const readFile = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(Error("No se pudo leer el archivo."));
    r.readAsDataURL(file);
  });
