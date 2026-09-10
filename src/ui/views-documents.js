// Vista de Documentos por proveedor.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
const docTypeLabel = (t) =>
  t ? (aiTypes[t] || t).replace("Posible ", "") : "Sin tipo";
function documentCard(ph) {
  const order = ph.order && state.orders.find((o) => o.id === ph.order);
  const sug = ph.suggestion;
  const sugText = sug
    ? [
        sug.supplier
          ? "proveedor " + esc(supplier(sug.supplier)?.name || "")
          : "",
        sug.order
          ? "pedido " +
            esc(state.orders.find((o) => o.id === sug.order)?.number || "")
          : "",
        sug.docType ? "tipo " + esc(docTypeLabel(sug.docType)) : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const isPdf = ph.mime === "application/pdf";
  // Tarjeta en rejilla: miniatura + datos arriba; propuesta y acciones ocupan todo el ancho.
  return `<article class="doc-card"><div class="doc-thumb">${isPdf ? `<span class="doc-pdf">PDF</span>` : `<img src="${esc(ph.data || "/api/photos/" + ph.id)}" alt="${esc(ph.name)}">`}</div><div class="doc-body"><strong>${esc(ph.name)}</strong><small>${esc(ph.supplier ? supplier(ph.supplier).name : "Sin proveedor")} · ${esc(ph.documentDate || ph.at.slice(0, 10))} · ${ph.source === "whatsapp" ? "WhatsApp" : "Foto"}</small><div class="doc-tags">${pill(docTypeLabel(ph.docType), ph.docType ? "sage" : "neutral")}${order ? pill(order.number, "lavender") : pill("Sin pedido", "neutral")}</div></div>${sug && sugText ? `<div class="doc-suggestion"><span><strong>Propuesta por reglas:</strong> ${sugText}. <span class="muted">${esc(sug.reason)}</span></span>${btn("Aceptar", "applySuggestion", "primary", `data-id="${esc(ph.id)}"`)}</div>` : sug ? `<div class="muted">${esc(sug.reason)}</div>` : ""}<div class="row-actions doc-actions">${btn("Organizar", "organizePhoto", "secondary", `data-id="${esc(ph.id)}"`)}${btn(order ? "Cambiar pedido" : "Vincular pedido", "linkDocument", "secondary", `data-id="${esc(ph.id)}"`)}${order ? btn("Desvincular", "unlinkDocument", "secondary", `data-id="${esc(ph.id)}"`) : ""}${ph.ocrText ? btn("Revisar texto con IA", "aiPhoto", "secondary", `data-id="${esc(ph.id)}"`) : ""}${btn("Dónde está", "documentPath", "secondary", `data-id="${esc(ph.id)}"`)}</div></article>`;
}
function documents() {
  const list = state.photos.filter(
    (p) =>
      (docSupplier === "all" ||
        p.supplier === docSupplier ||
        (docSupplier === "none" && !p.supplier)) &&
      (docFilter === "all" ||
        (docFilter === "unlinked" && !p.order) ||
        (docFilter === "suggested" && p.suggestion) ||
        (docFilter === "pdf" && p.mime === "application/pdf")),
  );
  const groups = new Map();
  for (const p of list) {
    const key = p.supplier || "none";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return (
    header(
      "Documentos por proveedor",
      "Facturas, albaranes, recibos y pedidos, archivados y vinculados al pedido al que pertenecen.",
      btn(icon("photo") + " Añadir documento", "photo", "primary"),
    ) +
    `<div class="notice subtle">${icon("shield")}<div><strong>Las propuestas las hacen reglas, no la IA</strong><span>Número de pedido en el texto, proveedor y fecha, e importe frente al pedido. Nada se vincula sin tu confirmación. Los adjuntos de WhatsApp de proveedores autorizados llegan aquí solos.</span></div></div><div class="message-filters"><label class="field">Proveedor<select id="doc-supplier"><option value="all">Todos</option><option value="none" ${docSupplier === "none" ? "selected" : ""}>Sin proveedor</option>${state.suppliers.map((s) => `<option value="${s.id}" ${docSupplier === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label><label class="field">Mostrar<select id="doc-filter">${[
      ["all", "Todos"],
      ["unlinked", "Sin pedido"],
      ["suggested", "Con propuesta"],
      ["pdf", "PDF"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${docFilter === v ? "selected" : ""}>${l}</option>`,
      )
      .join("")}</select></label></div>${
      list.length
        ? [...groups.entries()]
            .map(
              ([key, docs]) =>
                `<section class="panel"><div class="panel-heading"><div><h2>${esc(key === "none" ? "Sin proveedor" : supplier(key).name)}</h2><p>${docs.length} documento${docs.length === 1 ? "" : "s"}</p></div></div><div class="doc-grid">${docs.map(documentCard).join("")}</div></section>`,
            )
            .join("")
        : '<div class="panel empty compact">No hay documentos con estos filtros. Añade una foto o un PDF, o autoriza chats de WhatsApp para recibirlos solos.</div>'
    }`
  );
}
