// Vistas de Compras: carrito, control de entregas y respuestas vinculadas.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
function orderReplies(o) {
  const replies = state.messages.filter(
    (m) => m.order === o.id && m.interpretation,
  );
  if (!replies.length) return "";
  return `<div class="order-replies"><strong>Respuestas del proveedor vinculadas</strong>${replies
    .slice(0, 4)
    .map(
      (m) =>
        `<p>${pill(replyLabel[m.interpretation.category], m.interpretation.needsReading && !m.reviewed ? "peach" : "sage")} ${esc(m.interpretation.summary)}${m.interpretation.deliveryDate ? " Entrega: " + date(m.interpretation.deliveryDate + "T12:00:00Z") + "." : ""}</p>`,
    )
    .join("")}</div>`;
}
// Un recordatorio por pedido y día: el botón se apaga cuando ya se reclamó hoy.
function nudgedToday(o) {
  const today = new Date().toDateString();
  return (o.nudges || []).some((n) => new Date(n.at).toDateString() === today);
}
function orderTracking() {
  const open = state.orders.filter(
    (o) => !["received", "cancelled"].includes(o.status),
  );
  const closed = state.orders.filter((o) =>
    ["received", "cancelled"].includes(o.status),
  );
  const list = orderFilter === "open" ? open : closed;
  return `<section class="orders-panel"><div class="tracking-intro"><div><span class="eyebrow">DESPUÉS DEL CARRITO</span><h2>Control de entregas</h2><p>Registra lo que llega: solo eso se suma al inventario. Lo que falte sigue pendiente.</p></div></div>${
    state.orders.some((o) => o.status === "pending")
      ? `<div class="row-actions batch-row">${btn(icon("message") + " Enviar pendientes por WhatsApp", "orderBatch", "primary")}<small>Eliges la lista completa una vez; la app los envía uno a uno con pausa.</small></div>`
      : ""
  }<div class="tracking-tabs" aria-label="Filtrar entregas">${btn(`En curso · ${open.length}`, "orderFilter", orderFilter === "open" ? "primary" : "secondary", 'data-filter="open" aria-pressed="' + (orderFilter === "open") + '"')}${btn(`Cerrados · ${closed.length}`, "orderFilter", orderFilter === "closed" ? "primary" : "secondary", 'data-filter="closed" aria-pressed="' + (orderFilter === "closed") + '"')}</div><div class="delivery-list">${
    list
      .map((o) => {
        const finished = o.lines.filter(
          (l) => Math.round((l.packs * l.pack - l.received) * 1000) === 0,
        ).length;
        const hint = {
          pending:
            "Siguiente paso: enviarlo al proveedor por WhatsApp, con tu confirmación.",
          sent: "Siguiente paso: cuando llegue mercancía, registra las cantidades recibidas.",
          partial:
            "Siguiente paso: registra la próxima entrega de los productos que faltan.",
          received:
            "Entrega completada. Las cantidades ya están en el inventario.",
          cancelled: "Pedido cancelado. No se espera mercancía.",
        }[o.status];
        return `<article class="delivery-card" data-order-card="${esc(o.id)}"><header><div><span class="order-number">${esc(o.number)} · ${date(o.at)}${o.expected ? " · entrega prevista " + date(o.expected + "T12:00:00Z") : ""}</span><h3>${esc(supplier(o.supplier).name)}</h3></div>${pill(o.status === "sent" && o.dispatch ? "Enviado por WhatsApp" : statusLabel[o.status], o.status === "received" ? "sage" : "sand")}</header><div class="delivery-progress"><span>${finished} de ${o.lines.length} productos recibidos por completo</span><strong>${o.lines.some((l) => !l.price) ? "No disponible <small>(falta algún precio)</small>" : money(o.lines.reduce((n, l) => n + l.packs * l.price, 0)) + " <small>estimados</small>"}</strong></div><div class="table-scroll"><table class="delivery-table"><thead><tr><th>Producto / presentación</th><th>Pedido</th><th>Recibido</th><th>${o.status === "cancelled" ? "No entregado" : "Falta recibir"}</th></tr></thead><tbody>${o.lines
          .map((l) => {
            const p = product(l.product);
            const rem =
              Math.round((l.packs * l.pack - l.received) * 1000) / 1000;
            return `<tr><td><strong>${esc(p.name)}</strong><small>${l.packs} × ${num(l.pack)} ${esc(p.unit)} por presentación</small></td><td>${num(l.packs * l.pack)} ${esc(p.unit)}</td><td>${num(l.received)} ${esc(p.unit)}</td><td><strong>${num(rem)} ${esc(p.unit)}</strong></td></tr>`;
          })
          .join("")}</tbody></table></div>${orderReplies(o)}${(() => {
          const docs = state.photos.filter((p) => p.order === o.id);
          return docs.length
            ? `<div class="order-replies"><strong>Documentos vinculados</strong>${docs.map((d) => `<p>${pill(docTypeLabel(d.docType), "sage")} ${esc(d.name)} · ${esc(d.documentDate || d.at.slice(0, 10))}</p>`).join("")}</div>`
            : "";
        })()}<footer class="delivery-next"><div><strong>${hint}</strong><small>${o.dispatch ? `Enviado por WhatsApp a ${esc(o.dispatch.to)} el ${date(o.dispatch.at)} ${time(o.dispatch.at)}. ${o.confirmedAt ? `Confirmado por el proveedor el ${date(o.confirmedAt)}.` : "Pendiente de confirmación del proveedor."}${(o.nudges || []).length ? ` Recordatorio enviado ${o.nudges.length === 1 ? "una vez" : o.nudges.length + " veces"}, el último el ${date(o.nudges[o.nudges.length - 1].at)} a las ${time(o.nudges[o.nudges.length - 1].at)}.` : ""}` : o.status === "pending" ? "Todavía no se ha enviado al proveedor." : o.status === "sent" ? "Pedido por otro medio (teléfono, correo…): la app no ha enviado ningún mensaje." : "Apuntado a mano: no se envió ningún mensaje."}</small></div><div class="row-actions">${o.status === "pending" ? btn("Enviar por WhatsApp", "orderWhatsApp", "primary", `data-order="${esc(o.id)}"`) + btn("Ya lo pedí por otro medio", "send", "secondary", `data-order="${esc(o.id)}"`) + btn("Cancelar pedido", "cancelOrder", "danger", `data-order="${esc(o.id)}"`) : ["sent", "partial"].includes(o.status) ? btn("Registrar lo que llegó", "receive", "primary", `data-order="${esc(o.id)}"`) + btn("Fijar fecha de entrega", "setExpected", "secondary", `data-order="${esc(o.id)}"`) + (o.confirmedAt ? "" : btn("Marcar confirmado", "confirmOrder", "secondary", `data-order="${esc(o.id)}"`) + (o.dispatch ? btn(nudgedToday(o) ? "Reclamado hoy" : "Reclamar respuesta", "orderNudge", "secondary", `data-order="${esc(o.id)}" ${nudgedToday(o) ? "disabled" : ""}`) : "")) : ""}</div></footer></article>`;
      })
      .join("") ||
    '<div class="panel empty compact">' +
      (orderFilter === "open"
        ? "No hay entregas pendientes."
        : "Los pedidos completados y cancelados aparecerán aquí.") +
      "</div>"
  }</div></section>`;
}
// Lo que cuesta una línea del carrito depende del proveedor elegido en ella: el habitual
// del producto o uno de los que la persona apuntó, con el formato y el precio que escribió.
function cartSupply(l) {
  const p = product(l.product);
  const alt = l.supplier
    ? (p.alternates || []).find((x) => x.supplier === l.supplier)
    : null;
  return {
    supplier: alt ? alt.supplier : p.supplier,
    pack: alt ? alt.pack : p.pack,
    price: alt ? alt.price : p.price,
  };
}
// Lo que el servidor dice de cada línea del carrito (core/pricelist.ts, cartAdvice): si sale más
// barata con otro proveedor ya apuntado y qué dice la lista de precios. Solo informa.
let cartHints = [];
const cartHint = (id) => cartHints.find((h) => h.product === id);
function cartHintText(l, p) {
  const h = cartHint(p.id);
  if (!h) return "";
  const buy = cartSupply(l);
  const perUnit = buy.price
    ? `<small class="cart-unit">${money(Math.round(buy.price / buy.pack))} por ${esc(p.unit)}</small>`
    : "";
  if (h.cheaper)
    return `${perUnit}<div class="cart-hint"><span><strong>Más barato con ${esc(supplier(h.cheaper.supplier).name)}:</strong> ${h.cheaper.packs} ${h.cheaper.packs === 1 ? "paquete" : "paquetes"} de ${num(h.cheaper.pack)} ${esc(p.unit)} = ${money(h.cheaper.cents)} (baja ${money(h.cheaper.saving)})</span>${btn("Cambiar", "cartCheapest", "secondary", `data-product="${esc(p.id)}"`)}</div>`;
  if (h.list && !h.list.noted)
    return `${perUnit}<div class="cart-hint list"><span><strong>En tu lista de precios:</strong> ${esc(h.list.supplier)} a ${money(h.list.cents)}${h.list.suppliers > 1 ? `, el más barato de ${h.list.suppliers} proveedores` : ""}. La lista no dice si es por kilo, litro o unidad.</span>${btn("Apuntar este precio…", "priceUse", "secondary", `data-row="${esc(h.list.row)}"`)}</div>`;
  return perUnit;
}
/** Aviso encima del carrito: cuántas líneas bajan y cuánto, con un botón para cambiarlas todas. */
function cartCheaperBanner() {
  const lines = cartHints.filter(
    (h) => h.cheaper && state.cart.some((l) => l.product === h.product),
  );
  if (!lines.length) return "";
  const saving = lines.reduce((n, h) => n + h.cheaper.saving, 0);
  return `<div class="notice cart-cheaper">${icon("alert")}<div><strong>${lines.length === 1 ? "Una línea sale" : lines.length + " líneas salen"} más barata${lines.length === 1 ? "" : "s"} con otro proveedor que ya tienes apuntado</strong><span>La compra bajaría ${money(saving)}. Compara precios, no marcas ni formatos: compruébalo antes.</span>${btn("Usar el más barato en todo", "cartCheapest", "primary")}</div></div>`;
}
function cartSupplierPicker(l, p) {
  if (!(p.alternates || []).length) return "";
  const here = cartSupply(l).supplier;
  const opts = [
    [p.supplier, supplier(p.supplier).name, p.pack, p.price],
    ...p.alternates.map((x) => [
      x.supplier,
      supplier(x.supplier).name,
      x.pack,
      x.price,
    ]),
  ];
  return `<label class="cart-supplier"><span class="sr-only">Proveedor elegido para ${esc(p.name)}</span><select data-cart-supplier="${esc(p.id)}">${opts
    .map(
      ([id, name, pack, price]) =>
        `<option value="${esc(id)}" ${id === here ? "selected" : ""}>${esc(name)} · ${num(pack)} ${esc(p.unit)} · ${price ? money(price) : "sin precio"}</option>`,
    )
    .join("")}</select></label>`;
}
// Total del carrito: una línea sin precio no cuenta como 0 €; sin todos los precios no hay total.
function cartTotalText(lines) {
  const unpriced = lines.filter((l) => !cartSupply(l).price).length;
  if (unpriced)
    return `No disponible (${unpriced} ${unpriced === 1 ? "producto" : "productos"} sin precio)`;
  return money(lines.reduce((n, l) => n + l.packs * cartSupply(l).price, 0));
}
function orders() {
  if (priceListOpen) return priceListView();
  const total = cartTotalText(state.cart);
  return (
    header(
      "Compras con todo bajo control.",
      "Prepara el carrito, revisa el pedido y registra lo que llega.",
      btn("Precios por proveedor", "priceShow", "secondary") +
        btn("Sugerir reposición", "suggest", "primary"),
    ) +
    `<div class="notice">${icon("shield")}<div><strong>Pedidos reales solo por WhatsApp</strong><span>Solo se envían cuando tú lo confirmas. La app nunca paga.</span></div></div><div class="purchase-grid"><section class="panel"><div class="panel-heading"><h2>Tu carrito</h2>${pill(state.cart.length + " productos")}</div>${cartCheaperBanner()}${
      state.cart.length
        ? `<div class="cart-lines">${state.cart
            .map((l) => {
              const p = product(l.product);
              const buy = cartSupply(l);
              return `<div class="cart-line"><span class="product-icon sage">${icon(p.icon)}</span><div class="cart-desc"><strong>${esc(p.name)}</strong><small>${esc(supplier(buy.supplier).name)} · ${num(buy.pack)} ${p.unit} / paquete${l.supplier ? " · otro proveedor, elegido por ti" : ""}</small>${cartSupplierPicker(l, p)}${cartHintText(l, p)}</div><div class="stepper"><button type="button" class="step" data-step="-1" aria-label="Un paquete menos de ${esc(p.name)}">−</button><input aria-label="Paquetes de ${esc(p.name)}" class="quantity" type="number" min="0" max="10000" step="1" value="${l.packs}" data-cart="${p.id}"><button type="button" class="step" data-step="1" aria-label="Un paquete más de ${esc(p.name)}">+</button></div><strong>${buy.price ? money(l.packs * buy.price) : "No disponible"}</strong><button class="icon-button" aria-label="Quitar ${esc(p.name)}" data-remove="${p.id}">${icon("close")}</button></div>`;
            })
            .join("")}</div>`
        : '<div class="empty">' +
          icon("cart") +
          "<h3>Tu próximo pedido empieza aquí</h3><p>Añade productos o prepara la reposición sugerida.</p></div>"
    }<div class="panel-bottom">${btn(icon("plus") + " Añadir producto", "addcart")}${state.suppliers
      .filter(
        (s) => s.web && state.cart.some((l) => cartSupply(l).supplier === s.id),
      )
      .map((s) =>
        btn(
          icon("store") + " Lista para " + esc(s.name),
          "webList",
          "secondary",
          `data-supplier="${s.id}"`,
        ),
      )
      .join(
        "",
      )}</div></section><aside class="panel order-summary"><h2>Resumen del carrito</h2><div class="summary-row"><span>Productos</span><strong>${total}</strong></div><div class="summary-row"><span>Envío e impuestos</span><span>Por confirmar</span></div><div class="summary-total"><span>Total estimado</span><strong>${total}</strong></div><p>Un pedido por proveedor, con los precios de Inventario.</p>${btn("Revisar y autorizar " + icon("arrow"), "checkout", "primary full", state.cart.length ? "" : "disabled")}<small>Se guardará como pendiente de envío.</small></aside></div>${orderTracking()}`
  );
}
