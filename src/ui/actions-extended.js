// Acciones adicionales: movimientos, correcciones, edición de productos y proveedores.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
// Otros proveedores donde se compra el mismo producto. Lo escribe la persona: ni el formato
// ni el precio se deducen de nada. Elegirlo se hace después en el carrito, producto a producto.
function altSuppliersModal(id) {
  const p = product(id);
  if (!p) return;
  const free = state.suppliers.filter(
    (s) =>
      s.id !== p.supplier && !p.alternates.some((x) => x.supplier === s.id),
  );
  const list = p.alternates.length
    ? `<div class="alt-list">${p.alternates
        .map(
          (x) =>
            `<div class="alt-line"><div><strong>${esc(supplier(x.supplier).name)}</strong><small>${num(x.pack)} ${esc(p.unit)} por paquete · ${x.price ? money(x.price) + " el paquete" : "precio: No disponible"}</small></div><button type="button" class="text-button" data-alt-remove="${esc(x.supplier)}">Quitar</button></div>`,
        )
        .join("")}</div>`
    : `<p>Todavía no has apuntado ningún otro proveedor para ${esc(p.name)}.</p>`;
  modal(
    "Otros proveedores de " + p.name,
    "Apunta dónde más lo compras. No cambia su proveedor habitual: en el carrito eliges a quién se lo pides cada vez.",
    list +
      (free.length
        ? `<div class="form-grid">${select(
            "Añadir proveedor",
            "supplier",
            free.map((s) => [s.id, s.name]),
          )}${field("Cuánto trae cada paquete", "pack", p.pack, "number", 'min="0.001" max="1000000" step="0.001" required')}${field("Precio por paquete (€)", "price", p.price / 100, "number", 'min="0" max="1000000" step="0.01" required')}</div><small>Escribe el formato y el precio de ese proveedor. Si los dejas a 0, el precio sale como «No disponible».</small>`
        : "<p>Ya has apuntado a todos tus proveedores para este producto.</p>"),
    async (f) => {
      if (!free.length) return true;
      return mutate(
        {
          type: "setAlternate",
          product: p.id,
          supplier: f.get("supplier"),
          pack: Number(f.get("pack")),
          price: Math.round(Number(f.get("price")) * 100),
        },
        "Proveedor apuntado.",
      );
    },
    free.length ? "Apuntar" : "Cerrar",
  );
  for (const b of document.querySelectorAll("#modal-form [data-alt-remove]"))
    b.addEventListener("click", async () => {
      const ok = await mutate(
        {
          type: "removeAlternate",
          product: p.id,
          supplier: b.dataset.altRemove,
        },
        "Proveedor quitado de la lista.",
      );
      if (ok) altSuppliersModal(p.id);
    });
}
// Qué le compra a un proveedor, a qué precio y desde cuándo. Lo calcula el núcleo
// (core/inventory.ts) y viaja en el sobre de estado; aquí solo se enseña.
function supplierCatalogModal(id) {
  const s = supplier(id);
  const lines = (catalog && catalog[id]) || [];
  const rows = lines
    .map(
      (l) =>
        `<tr><td><strong>${esc(l.name)}</strong>${l.usual ? "" : "<small>otro proveedor donde también lo compras</small>"}</td><td>${num(l.pack)} ${esc(l.unit)}</td><td>${l.price ? money(l.price) : "No disponible"}</td><td>${l.since ? date(l.since) : "No disponible"}</td><td>${esc(priceSourceLabel[l.source] || "No disponible")}${l.refLabel ? "<small>" + esc(l.refLabel) + "</small>" : ""}</td></tr>`,
    )
    .join("");
  modal(
    "Qué le compras a " + s.name,
    "Precio por paquete de cada producto, desde cuándo está apuntado y de dónde salió. Lo que no consta se queda en «No disponible»: no se rellena solo.",
    lines.length
      ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Paquete</th><th>Precio</th><th>Desde</th><th>De dónde sale</th></tr></thead><tbody>${rows}</tbody></table></div><p class="fineprint">«Desde» es el día en que se apuntó ese precio. Los productos con el precio de siempre, sin ningún cambio registrado, salen como «No disponible».</p>`
      : `<p>Todavía no hay ningún producto con ${esc(s.name)} como proveedor.</p>`,
    async () => true,
    "Cerrar",
  );
}
// Apuntar un precio citando de dónde sale: un documento archivado o un mensaje del proveedor.
// La app nunca lo escribe sola; aquí se elige el producto y se repasa el importe.
function setPriceModal({ supplier: supId, source, ref, price, product: pick }) {
  const s = supplier(supId);
  const list = state.products.filter((p) => p.supplier === supId);
  const origin =
    source === "message"
      ? "el mensaje de " + s.name
      : "el documento que tienes archivado";
  if (!list.length) {
    modal(
      "Apuntar un precio",
      "Se apunta en la ficha del producto citando de dónde sale.",
      `<p>Ningún producto tiene a ${esc(s.name)} como proveedor habitual, así que no hay dónde apuntarlo.</p>`,
      async () => true,
      "Cerrar",
    );
    return;
  }
  const chosen = list.find((p) => p.id === pick) || list[0];
  modal(
    "Apuntar el precio",
    `Queda en la ficha del producto y en el historial del proveedor, citando ${origin}. No cambia el stock ni ningún pedido.`,
    select(
      "Producto",
      "product",
      list.map((p) => [p.id, `${p.name} · hoy ${money(p.price)} el paquete`]),
      chosen.id,
    ) +
      field(
        "Precio por paquete (€)",
        "price",
        (price === undefined ? chosen.price : price) / 100,
        "number",
        'min="0" max="1000000" step="0.01" required',
      ) +
      `<p class="fineprint">El precio anterior no se pierde: queda en el historial con su fecha. El coste de las recetas y el carrito usan a partir de ahora el precio nuevo.</p>`,
    async (f) =>
      mutate(
        {
          type: "setPrice",
          product: f.get("product"),
          price: Math.round(Number(f.get("price")) * 100),
          source,
          ref,
        },
        "Precio apuntado con su origen.",
      ),
    "Apuntar precio",
  );
}
async function extendedAction(name, el) {
  if (name === "supplierCatalog") {
    supplierCatalogModal(el.dataset.supplier);
    return true;
  }
  if (name === "setPrice") {
    setPriceModal({
      supplier: el.dataset.supplier,
      source: el.dataset.source,
      ref: el.dataset.ref,
      price: el.dataset.price ? Number(el.dataset.price) : undefined,
      product: el.dataset.product,
    });
    return true;
  }
  if (name === "movement") {
    const first = product(el?.dataset?.product) || state.products[0];
    modal(
      "Entrada, salida o merma",
      "Este movimiento ajusta el stock y queda registrado con su motivo.",
      select(
        "Producto",
        "product",
        state.products.map((p) => [p.id, `${p.name} (${p.unit})`]),
        first?.id,
      ) +
        select("Tipo de movimiento", "kind", [
          ["entry", "Entrada de mercadería"],
          ["exit", "Salida / consumo"],
          ["waste", "Merma / pérdida"],
        ]) +
        stepperField(
          unitLabel("Cantidad", first),
          "value",
          1,
          'min="0.001" max="1000000" step="0.001" required',
          "1",
        ) +
        // Los mismos motivos que el cierre del día, para poder comparar las dos mermas.
        `<label class="field" id="waste-reason-field" hidden>Motivo de la merma<select name="wasteReason">${options(Object.entries(wasteReasons), "expiry")}</select></label>` +
        field(
          "Motivo",
          "reason",
          "",
          "text",
          'required maxlength="500" placeholder="Ejemplo: consumo de barra o rotura"',
        ),
      async (f) => {
        const waste = f.get("kind") === "waste";
        return mutate(
          {
            type: "movement",
            product: f.get("product"),
            kind: f.get("kind"),
            value: Number(f.get("value")),
            reason: f.get("reason") || "",
            ...(waste ? { wasteReason: f.get("wasteReason") } : {}),
          },
          "Movimiento guardado.",
        );
      },
    );
    $("#modal-form select[name=product]").addEventListener("change", (e) =>
      retitleField(
        $("#modal-form input[name=value]"),
        unitLabel("Cantidad", product(e.target.value)),
      ),
    );
    // Con «Merma / pérdida» el motivo se elige de la lista y el texto libre pasa a ser un
    // detalle opcional; con entrada o salida, el texto libre vuelve a ser obligatorio.
    $("#modal-form select[name=kind]").addEventListener("change", (e) => {
      const waste = e.target.value === "waste";
      const reason = $("#modal-form input[name=reason]");
      $("#waste-reason-field").hidden = !waste;
      reason.required = !waste;
      reason.placeholder = waste
        ? "Ejemplo: se rompió la garrafa al abrirla"
        : "Ejemplo: consumo de barra o rotura";
      retitleField(reason, waste ? "Detalle (opcional)" : "Motivo");
    });
    return true;
  }
  if (name === "reverse") {
    const m = state.movements.find((x) => x.id === el.dataset.id);
    modal(
      "Revertir un movimiento",
      "Se añade una compensación. El movimiento original no se borra.",
      `<p>${esc(product(m.product).name)} · compensación: ${num(-m.delta)} ${product(m.product).unit}</p>` +
        field(
          "Motivo de la corrección",
          "reason",
          "",
          "text",
          'required maxlength="500"',
        ),
      async (f) =>
        mutate(
          { type: "reverse", id: m.id, reason: f.get("reason") },
          "Corrección registrada con trazabilidad.",
        ),
      "Registrar corrección",
    );
    return true;
  }
  if (name === "cancelOrder") {
    const o = state.orders.find((x) => x.id === el.dataset.order);
    modal(
      "Cancelar " + o.number,
      "Solo se cancela este pedido pendiente; no cambia el stock.",
      `<p>El proveedor no recibirá nada. Estos productos volverán a considerarse para la reposición.</p>`,
      async () =>
        mutate({ type: "cancel", order: o.id }, "Pedido pendiente cancelado."),
      "Cancelar pedido",
    );
    return true;
  }
  if (name === "altSuppliers") {
    altSuppliersModal(el.dataset.product);
    return true;
  }
  if (name === "editProduct") {
    const p = product(el.dataset.product);
    modal(
      "Editar producto",
      "La unidad de medida y el stock se conservan. Los pedidos existentes mantienen su presentación y precio.",
      `<div class="form-grid">${field("Nombre", "name", p.name, "text", 'required maxlength="100"')}${field("Presentación / detalle", "detail", p.detail, "text", 'maxlength="200"')}${field("Stock mínimo", "min", p.min, "number", 'min="0" max="1000000" step="0.001" required')}${field("Stock objetivo", "target", p.target, "number", 'min="0" max="1000000" step="0.001" required')}${field("Cuánto trae cada paquete", "pack", p.pack, "number", 'min="0.001" max="1000000" step="0.001" required')}${field("Precio por paquete (€)", "price", p.price / 100, "number", 'min="0" max="1000000" step="0.01" required')}${select("Zona de conteo", "zone", Object.entries(zoneLabel), p.zone || "almacen")}${["sugars", "fat", "solids", "msnf"].map((k) => field({ sugars: "Azúcares % (ficha)", fat: "Grasa % (ficha)", solids: "Sólidos totales % (ficha)", msnf: "Sólidos lácteos no grasos % (ficha)" }[k], "comp_" + k, p.composition?.[k] ?? "", "number", 'min="0" max="100" step="0.1" placeholder="opcional"')).join("")}${select(
        "Proveedor",
        "supplier",
        state.suppliers.map((s) => [s.id, s.name]),
        p.supplier,
      )}</div>`,
      async (f) => {
        const a = Object.fromEntries(f);
        for (const k of ["min", "target", "pack"]) a[k] = Number(a[k]);
        a.price = Math.round(Number(a.price) * 100);
        return mutate(
          {
            type: "editProduct",
            product: p.id,
            ...a,
            composition: Object.fromEntries(
              ["sugars", "fat", "solids", "msnf"]
                .filter(
                  (k) =>
                    f.get("comp_" + k) !== "" && f.get("comp_" + k) !== null,
                )
                .map((k) => [k, Number(f.get("comp_" + k))]),
            ),
          },
          "Ficha actualizada.",
        );
      },
    );
    return true;
  }
  if (name === "supplierEditor") {
    const s = el.dataset.supplier
      ? supplier(el.dataset.supplier)
      : { name: "", initials: "", category: "", delivery: "", color: "sage" };
    modal(
      s.id ? "Editar proveedor" : "Nuevo proveedor",
      "Esta ficha es local; guardarla no conecta WhatsApp ni envía mensajes.",
      field("Nombre", "name", s.name, "text", 'required maxlength="100"') +
        field(
          "NIF/CIF del proveedor",
          "taxId",
          s.taxId || "",
          "text",
          'maxlength="30"',
        ) +
        field(
          "WhatsApp con prefijo internacional",
          "whatsapp",
          s.whatsapp || "",
          "tel",
          'placeholder="+34…" maxlength="30"',
        ) +
        field(
          "Web de compra (por ejemplo Makro)",
          "web",
          s.web || "",
          "url",
          'placeholder="https://…" maxlength="200"',
        ) +
        `<label class="field">Otros nombres en documentos (uno por línea)<textarea name="aliases" maxlength="1000">${esc(s.aliases || "")}</textarea></label>` +
        field(
          "Iniciales",
          "initials",
          s.initials,
          "text",
          'required maxlength="5"',
        ) +
        field(
          "Especialidad",
          "category",
          s.category,
          "text",
          'required maxlength="100"',
        ) +
        field(
          "Días o condiciones de entrega",
          "delivery",
          s.delivery,
          "text",
          'required maxlength="200"',
        ) +
        select(
          "Color de la ficha",
          "color",
          [
            ["sage", "Verde"],
            ["rose", "Rosa"],
            ["sand", "Arena"],
            ["lavender", "Lavanda"],
          ],
          s.color,
        ),
      async (f) =>
        mutate(
          {
            type: "supplier",
            ...(s.id ? { id: s.id } : {}),
            ...Object.fromEntries(f),
          },
          "Proveedor guardado localmente.",
        ),
    );
    return true;
  }
  return false;
}
