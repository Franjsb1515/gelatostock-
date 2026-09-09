// Acciones adicionales: movimientos, correcciones, edición de productos y proveedores.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
async function extendedAction(name, el) {
  if (name === "movement") {
    modal(
      "Entrada, salida o merma",
      "Este movimiento ajusta el stock y queda registrado con su motivo.",
      select(
        "Producto",
        "product",
        state.products.map((p) => [p.id, `${p.name} (${p.unit})`]),
      ) +
        select("Tipo de movimiento", "kind", [
          ["entry", "Entrada de mercadería"],
          ["exit", "Salida / consumo"],
          ["waste", "Merma / pérdida"],
        ]) +
        stepperField(
          "Cantidad en unidad base",
          "value",
          1,
          'min="0.001" max="1000000" step="0.001" required',
          "1",
        ) +
        field(
          "Motivo",
          "reason",
          "",
          "text",
          'required maxlength="500" placeholder="Ejemplo: consumo de barra o rotura"',
        ),
      async (f) =>
        mutate(
          {
            type: "movement",
            product: f.get("product"),
            kind: f.get("kind"),
            value: Number(f.get("value")),
            reason: f.get("reason"),
          },
          "Movimiento guardado.",
        ),
    );
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
  if (name === "editProduct") {
    const p = product(el.dataset.product);
    modal(
      "Editar producto",
      "La unidad base y el stock se conservan. Los pedidos existentes mantienen su presentación y precio.",
      `<div class="form-grid">${field("Nombre", "name", p.name, "text", 'required maxlength="100"')}${field("Presentación / detalle", "detail", p.detail, "text", 'maxlength="200"')}${field("Stock mínimo", "min", p.min, "number", 'min="0" max="1000000" step="0.001" required')}${field("Stock objetivo", "target", p.target, "number", 'min="0" max="1000000" step="0.001" required')}${field("Unidades base por paquete", "pack", p.pack, "number", 'min="0.001" max="1000000" step="0.001" required')}${field("Precio por paquete (€)", "price", p.price / 100, "number", 'min="0" max="1000000" step="0.01" required')}${select(
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
          { type: "editProduct", product: p.id, ...a },
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
