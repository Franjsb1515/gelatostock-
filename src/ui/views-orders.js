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
function orderTracking() {
  const open = state.orders.filter(
    (o) => !["received", "cancelled"].includes(o.status),
  );
  const closed = state.orders.filter((o) =>
    ["received", "cancelled"].includes(o.status),
  );
  const list = orderFilter === "open" ? open : closed;
  return `<section class="orders-panel"><div class="tracking-intro"><div><span class="eyebrow">DESPUÉS DEL CARRITO</span><h2>Control de entregas</h2><p>Comprueba qué llegó y qué falta en cada pedido. Solo las cantidades que registres como recibidas se suman al inventario.</p></div><div class="tracking-example"><strong>Un ejemplo</strong><p>Pides 6 cajas y llegan 4: registras esas 4. Las otras 2 siguen pendientes.</p><small>Los envíos reales van por WhatsApp y siempre los confirmas tú.</small></div></div>${
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
          pending: "Siguiente paso: simular el envío para probar una entrega.",
          sent: "Siguiente paso: cuando llegue mercancía, registra las cantidades recibidas.",
          partial:
            "Siguiente paso: registra la próxima entrega de los productos que faltan.",
          received:
            "Entrega completada. Las cantidades ya están en el inventario.",
          cancelled: "Pedido cancelado. No se espera mercancía.",
        }[o.status];
        return `<article class="delivery-card" data-order-card="${esc(o.id)}"><header><div><span class="order-number">${esc(o.number)} · ${date(o.at)}${o.expected ? " · entrega prevista " + date(o.expected + "T12:00:00Z") : ""}</span><h3>${esc(supplier(o.supplier).name)}</h3></div>${pill(o.status === "sent" && o.dispatch ? "Enviado por WhatsApp" : statusLabel[o.status], o.status === "received" ? "sage" : "sand")}</header><div class="delivery-progress"><span>${finished} de ${o.lines.length} productos recibidos por completo</span><strong>${money(o.lines.reduce((n, l) => n + l.packs * l.price, 0))} <small>estimados</small></strong></div><div class="table-scroll"><table class="delivery-table"><thead><tr><th>Producto / presentación</th><th>Pedido</th><th>Recibido</th><th>${o.status === "cancelled" ? "No entregado" : "Falta recibir"}</th></tr></thead><tbody>${o.lines
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
        })()}<footer class="delivery-next"><div><strong>${hint}</strong><small>${o.dispatch ? `Enviado por WhatsApp a ${esc(o.dispatch.to)} el ${date(o.dispatch.at)} ${time(o.dispatch.at)}. ${o.confirmedAt ? `Confirmado por el proveedor el ${date(o.confirmedAt)}.` : "Pendiente de confirmación del proveedor."}` : o.status === "pending" || o.status === "sent" ? "Simulación: no se ha contactado al proveedor." : "Registro de demostración · sin pagos ni mensajes enviados."}</small></div><div class="row-actions">${o.status === "pending" ? btn("Enviar por WhatsApp", "orderWhatsApp", "primary", `data-order="${esc(o.id)}"`) + btn("Simular envío", "send", "secondary", `data-order="${esc(o.id)}"`) + btn("Cancelar pedido", "cancelOrder", "danger", `data-order="${esc(o.id)}"`) : ["sent", "partial"].includes(o.status) ? btn("Registrar lo que llegó", "receive", "primary", `data-order="${esc(o.id)}"`) + btn("Fijar fecha de entrega", "setExpected", "secondary", `data-order="${esc(o.id)}"`) + (o.confirmedAt ? "" : btn("Marcar confirmado", "confirmOrder", "secondary", `data-order="${esc(o.id)}"`)) : ""}</div></footer></article>`;
      })
      .join("") ||
    '<div class="panel empty compact">' +
      (orderFilter === "open"
        ? "No hay entregas pendientes. Los nuevos pedidos aparecerán aquí al autorizar el carrito."
        : "Los pedidos completados y cancelados aparecerán aquí.") +
      "</div>"
  }</div></section>`;
}
function orders() {
  const total = state.cart.reduce(
    (n, l) => n + l.packs * product(l.product).price,
    0,
  );
  return (
    header(
      "Compras con todo bajo control.",
      "Prepara el carrito, revisa el pedido y registra lo que llega.",
      btn("Sugerir reposición", "suggest", "primary"),
    ) +
    `<div class="notice">${icon("shield")}<div><strong>Pedidos reales solo por WhatsApp</strong><span>El carrito crea pedidos por proveedor; se envían por WhatsApp uno a uno cuando tú lo confirmas. La app nunca realiza pagos.</span></div></div><div class="purchase-grid"><section class="panel"><div class="panel-heading"><h2>Tu carrito</h2>${pill(state.cart.length + " productos")}</div>${
      state.cart.length
        ? `<div class="cart-lines">${state.cart
            .map((l) => {
              const p = product(l.product);
              return `<div class="cart-line"><span class="product-icon sage">${icon(p.icon)}</span><div class="cart-desc"><strong>${esc(p.name)}</strong><small>${esc(supplier(p.supplier).name)} · ${num(p.pack)} ${p.unit} / paquete</small></div><div class="stepper"><button type="button" class="step" data-step="-1" aria-label="Un paquete menos de ${esc(p.name)}">−</button><input aria-label="Paquetes de ${esc(p.name)}" class="quantity" type="number" min="0" max="10000" step="1" value="${l.packs}" data-cart="${p.id}"><button type="button" class="step" data-step="1" aria-label="Un paquete más de ${esc(p.name)}">+</button></div><strong>${money(l.packs * p.price)}</strong><button class="icon-button" aria-label="Quitar ${esc(p.name)}" data-remove="${p.id}">${icon("close")}</button></div>`;
            })
            .join("")}</div>`
        : '<div class="empty">' +
          icon("cart") +
          "<h3>Tu próximo pedido empieza aquí</h3><p>Añade productos o prepara la reposición sugerida.</p></div>"
    }<div class="panel-bottom">${btn(icon("plus") + " Añadir producto", "addcart")}${state.suppliers
      .filter(
        (s) =>
          s.web && state.cart.some((l) => product(l.product).supplier === s.id),
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
      )}</div></section><aside class="panel order-summary"><h2>Resumen del carrito</h2><div class="summary-row"><span>Productos</span><strong>${money(total)}</strong></div><div class="summary-row"><span>Envío e impuestos</span><span>Por confirmar</span></div><div class="summary-total"><span>Total estimado</span><strong>${money(total)}</strong></div><p>Los precios son ficticios. Se creará un pedido independiente por proveedor.</p>${btn("Revisar y autorizar " + icon("arrow"), "checkout", "primary full", state.cart.length ? "" : "disabled")}<small>Se guardará como pendiente de envío.</small></aside></div>${orderTracking()}`
  );
}
