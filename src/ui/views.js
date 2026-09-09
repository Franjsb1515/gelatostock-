// Vistas: resumen, inventario, producción, IA local, compras, mensajes, proveedores, actividad y ajustes.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
function home() {
  const important = state.messages.filter(
    (m) => m.priority === "important" && !m.reviewed,
  );
  const open = state.orders.filter(
    (o) => !["received", "cancelled"].includes(o.status),
  );
  const value = state.products.reduce(
    (n, p) => n + (p.stock / p.pack) * p.price,
    0,
  );
  return (
    header(
      "Un buen día empieza en orden.",
      "Tu stock, tus compras y tus proveedores. Todo en un mismo lugar.",
      btn(icon("photo") + " Cargar foto", "photo") +
        btn(icon("plus") + " Registrar stock", "count", "primary"),
    ) +
    `<section class="hero"><div class="hero-copy"><span class="hero-label"><i class="dot"></i> ARTE + GELATO · HOY</span><h2>Más tiempo para crear.<br>Menos para contar.</h2><p>${low().length ? `Hay ${low().length} productos por debajo del mínimo.<br>Prepará la reposición y seguí con tu día.` : "Tu inventario está por encima de los mínimos.<br>Todo listo para seguir con tu día."}</p>${btn("Preparar reposición " + icon("arrow"), "suggest", "cream")}</div><div class="hero-art" aria-hidden="true"><span class="art-orbit"></span><span class="art-dot"></span><div class="scoop scoop-one"></div><div class="scoop scoop-two"></div><div class="scoop scoop-three"></div><div class="gelato-cup"><span>g.</span></div><span class="art-caption">un poco de orden,<br>mucho gelato.</span></div></section>
 ${homeNotices()}<section class="stats"><article class="stat"><span class="stat-icon sage">${icon("box")}</span><div><p>Productos en catálogo</p><strong>${state.products.length}</strong><small>Todo tu inventario</small></div></article><article class="stat"><span class="stat-icon peach">${icon("alert")}</span><div><p>Necesitan reposición</p><strong>${low().length}</strong><small>Por debajo del mínimo</small></div></article><article class="stat"><span class="stat-icon lavender">${icon("cart")}</span><div><p>Pedidos en curso</p><strong>${open.length}</strong><small>${state.cart.length} productos en el carrito</small></div></article><article class="stat"><span class="stat-icon sand">${icon("store")}</span><div><p>Valor estimado del stock</p><strong class="money-value">${money(value)}</strong><small>Precios de demostración</small></div></article></section>
 <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Un vistazo al inventario</h2><p>Los productos que necesitan atención.</p></div><button class="text-button" data-nav="stock">Ver inventario ${icon("arrow")}</button></div>${productTable(low().slice(0, 5), true)}</section><div class="right-stack"><section class="panel inbox-preview"><div class="panel-heading"><h2>Tu bandeja de entrada</h2><span class="count-bubble">${important.length}</span></div>${
   important.length
     ? important
         .slice(0, 2)
         .map(
           (m) =>
             `<button class="message-preview" data-open-message="${m.id}"><div class="message-top"><span class="supplier-avatar ${supplier(m.supplier).color}">${esc(supplier(m.supplier).initials)}</span><div><strong>${esc(supplier(m.supplier).name)}</strong><small>${time(m.at)} · Demostración</small></div><i class="unread-dot"></i></div>${pill("Importante", "peach")}<p>${esc(m.text)}</p><span class="text-link">Revisar mensaje ${icon("arrow")}</span></button>`,
         )
         .join("")
     : '<div class="empty compact">Sin mensajes importantes pendientes.</div>'
 }<button class="full-link" data-nav="messages">Abrir mensajes ${icon("arrow")}</button></section><section class="tip-card"><span class="stat-icon sage">${icon("leaf")}</span><h3>Un stock que se entiende.</h3><p>Los pedidos pendientes se descuentan de la reposición sugerida. Menos compras repetidas.</p></section></div></div>`
  );
}
function productTable(items, compact = false) {
  return items.length
    ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Disponible</th>${compact ? "" : "<th>Mín. / objetivo</th><th>Proveedor</th>"}<th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${items.map((p) => `<tr><td><div class="product-cell"><span class="product-icon ${p.category === "Gelatería" ? "sage" : p.category === "Cafetería" ? "sand" : p.category === "Postres" ? "rose" : "lavender"}">${icon(p.icon)}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.detail)}</small></div></div></td><td><strong>${num(p.stock)} <span class="unit">${p.unit}</span></strong>${pending(p.id) ? `<small class="incoming">+ ${num(pending(p.id))} en pedido</small>` : ""}</td>${compact ? "" : `<td>${num(p.min)} / ${num(p.target)} ${p.unit}</td><td>${esc(supplier(p.supplier).name)}</td>`}<td>${p.stock < p.min ? pill("Stock bajo", "peach") : pill("En orden", "sage")}</td><td>${compact ? `<button class="icon-button bordered" data-add="${p.id}" aria-label="Añadir ${esc(p.name)} al carrito">${icon("plus")}</button>` : `<div class="row-actions"><button class="text-button" data-count="${p.id}">Contar</button><button class="text-button" data-action="editProduct" data-product="${p.id}">Editar</button></div>`}</td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty">' +
        icon("check") +
        "<h3>Todo en orden</h3><p>No hay productos en esta selección.</p></div>";
}
function stock() {
  const items = state.products.filter(
    (p) =>
      (filter === "Todos" ||
        (filter === "Stock bajo" ? p.stock < p.min : p.category === filter)) &&
      (p.name + " " + p.detail).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    header(
      "Inventario",
      "Cada ingrediente, cada envase y cada porción, en su lugar.",
      btn(icon("plus") + " Entrada / salida", "movement", "primary") +
        btn(icon("photo") + " Cargar foto", "photo") +
        btn(icon("plus") + " Nuevo producto", "product", "primary"),
    ) +
    `<section class="panel"><div class="toolbar"><div class="tabs">${["Todos", "Stock bajo", "Gelatería", "Cafetería", "Postres", "Envases"].map((f) => `<button data-filter="${f}" class="tab ${filter === f ? "selected" : ""}">${f}${f === "Stock bajo" ? ` <span>${low().length}</span>` : ""}</button>`).join("")}</div><label class="search">${icon("search")}<input id="search" placeholder="Buscar producto…" value="${esc(query)}" aria-label="Buscar producto"></label></div>${productTable(items)}<div class="table-footer">${items.length} productos · cantidades en su unidad base<span>Guardado en este equipo</span></div></section>`
  );
}
const aiTypes = {
  factura: "Posible factura",
  proforma: "Posible proforma / presupuesto",
  abono: "Posible abono / rectificación",
  albaran: "Posible albarán",
  lista_precios: "Posible lista de precios",
  oferta: "Posible oferta",
  mensaje: "Mensaje",
  otro: "Tipo por revisar",
};
const replyLabel = {
  out_of_stock: "Falta de producto",
  cancellation: "Cancelación",
  closed: "Cierre o vacaciones",
  payment: "Pago o factura pendiente",
  change: "Cambio de condiciones",
  question: "Pregunta o petición del proveedor",
  document: "Documento enviado",
  delivery_date: "Fecha de entrega",
  confirmation: "Confirmación",
  other: "Sin interpretar",
};
const toRead = () =>
  state.messages.filter((m) => m.interpretation?.needsReading && !m.reviewed);
const proposedProductions = () =>
  state.productions.filter((p) => p.status === "proposed");
function replyBlock(m) {
  const i = m.interpretation;
  if (!i) return "";
  const ai = m.aiReading;
  return `<div class="reply-reading"><div class="message-label">RESPUESTA DEL PROVEEDOR · LECTURA POR REGLAS</div><h3>${esc(replyLabel[i.category])}${i.needsReading && !m.reviewed ? " " + pill("Debes leer", "peach") : ""}${i.learned ? " " + pill("Aprendido de ti", "sage") : i.corrected ? " " + pill("Corregido por ti", "sage") : ""}</h3><p>${esc(i.summary)}</p>${i.deliveryDate ? `<p><strong>Entrega indicada:</strong> ${date(i.deliveryDate + "T12:00:00Z")}${i.deliveryHint ? " («" + esc(i.deliveryHint) + "»)" : ""}</p>` : i.deliveryHint ? `<p><strong>Plazo indicado:</strong> ${esc(i.deliveryHint)}</p>` : ""}${i.missing ? `<p><strong>Producto que falta:</strong> ${esc(i.missing)}</p>` : ""}${ai ? `<div class="muted">Segunda lectura (IA local, ${esc(ai.model)}): ${esc(replyLabel[ai.category])} · ${ai.status === "agreement" ? "dos lecturas coincidentes" : ai.status === "disagreement" ? "las lecturas discrepan: revisa tú" : "sin lectura válida"} · ${time(ai.at)}${ai.status === "agreement" && ai.category !== i.category ? " · No coincide con las reglas: decide leyendo el original." : ""}</div>` : '<div class="muted">Sin segunda lectura de IA todavía. Es opcional y solo propone una categoría.</div>'}</div>`;
}
function homeNotices() {
  const read = toRead().length,
    proposed = proposedProductions().length;
  const soon = state.orders.filter(
    (o) =>
      o.expected &&
      ["sent", "partial"].includes(o.status) &&
      (new Date(o.expected + "T12:00:00Z") - Date.now()) / 86400000 < 2,
  );
  const deliveries = soon.length
    ? `<strong>${soon.length} entrega${soon.length === 1 ? "" : "s"} prevista${soon.length === 1 ? "" : "s"} en los próximos dos días</strong><span>${esc(soon.map((o) => o.number + " " + supplier(o.supplier).name + " (" + date(o.expected + "T12:00:00Z") + ")").join(", "))}. </span><button class="text-button" data-nav="orders">Ver entregas ${icon("arrow")}</button>`
    : "";
  if (!read && !proposed && !soon.length) return "";
  return `<div class="notice subtle home-notice">${icon("alert")}<div>${read ? `<strong>${read} mensaje${read === 1 ? "" : "s"} de proveedores que debes leer</strong><span>Falta de producto, cambios, preguntas o retrasos detectados por reglas. </span><button class="text-button" data-nav="messages" data-filter-messages="toread">Ver mensajes ${icon("arrow")}</button>` : ""}${proposed ? `<strong>${proposed} producción${proposed === 1 ? "" : "es"} por aprobar</strong><span>El consumo estimado no cambia el stock hasta que lo apruebes. </span><button class="text-button" data-nav="production">Ver producción ${icon("arrow")}</button>` : ""}${deliveries}</div></div>`;
}
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
  return `<article class="doc-card"><div class="doc-thumb">${isPdf ? `<span class="doc-pdf">PDF</span>` : `<img src="${esc(ph.data || "/api/photos/" + ph.id)}" alt="${esc(ph.name)}">`}</div><div class="doc-body"><strong>${esc(ph.name)}</strong><small>${esc(ph.supplier ? supplier(ph.supplier).name : "Sin proveedor")} · ${esc(ph.documentDate || ph.at.slice(0, 10))} · ${ph.source === "whatsapp" ? "WhatsApp" : "Foto"}</small><div class="doc-tags">${pill(docTypeLabel(ph.docType), ph.docType ? "sage" : "neutral")}${order ? pill(order.number, "lavender") : pill("Sin pedido", "neutral")}</div>${sug && sugText ? `<div class="doc-suggestion"><strong>Propuesta por reglas:</strong> ${sugText}. <span class="muted">${esc(sug.reason)}</span> ${btn("Aceptar", "applySuggestion", "primary", `data-id="${esc(ph.id)}"`)}</div>` : sug ? `<div class="muted">${esc(sug.reason)}</div>` : ""}<div class="row-actions">${btn("Organizar", "organizePhoto", "secondary", `data-id="${esc(ph.id)}"`)}${btn(order ? "Cambiar pedido" : "Vincular pedido", "linkDocument", "secondary", `data-id="${esc(ph.id)}"`)}${order ? btn("Desvincular", "unlinkDocument", "secondary", `data-id="${esc(ph.id)}"`) : ""}${ph.ocrText ? btn("Revisar texto con IA", "aiPhoto", "secondary", `data-id="${esc(ph.id)}"`) : ""}${btn("Dónde está", "documentPath", "secondary", `data-id="${esc(ph.id)}"`)}</div></div></article>`;
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
function production() {
  if (lockInfo?.enabled && !lockInfo.unlocked)
    return (
      header(
        "Recetario protegido",
        "Las recetas y la producción se abren con tu contraseña durante 30 minutos.",
      ) +
      `<section class="panel settings-card lock-panel"><span class="stat-icon sage">${icon("shield")}</span><h2>Introduce la contraseña</h2><label class="field">Contraseña del recetario<input type="password" id="lock-password" autocomplete="current-password" maxlength="100"></label><div class="setting-actions">${btn("Desbloquear", "unlockRecipes", "primary")}</div><p class="fineprint">Protege la pantalla dentro de la app. Los movimientos de stock siguen visibles en Actividad. Si la olvidas, se puede quitar con la app cerrada borrando la clave recipes_lock de la tabla settings de gelatostock.sqlite.</p></section>`
    );
  const proposed = proposedProductions();
  const applied = state.productions.filter((p) => p.status === "applied");
  const byDate = {};
  for (const p of applied) (byDate[p.date] ||= []).push(p);
  const dates = Object.keys(byDate).sort().reverse().slice(0, 30);
  const lineText = (l) => {
    const p = product(l.product);
    return `${esc(p.name)} ${num(l.quantity)} ${esc(p.unit)}`;
  };
  return (
    header(
      "Producción y recetas",
      "Cada kilo de gelato descuenta sus ingredientes, solo cuando tú lo apruebas.",
      btn(icon("plus") + " Nueva receta", "recipeEditor") +
        btn(icon("plus") + " Registrar producción", "produce", "primary"),
    ) +
    `<div class="notice subtle">${icon("shield")}<div><strong>Cálculo por reglas con tu receta, no por IA</strong><span>La app propone el consumo y el producto terminado. Puedes corregir cada cantidad antes de aprobar. El stock resultante es una estimación hasta el próximo conteo.</span></div></div><section class="panel"><div class="panel-heading"><div><h2>Producciones por aprobar</h2><p>Revisa el consumo estimado. Aprobar crea movimientos de salida por producción y la entrada del producto terminado.</p></div></div>${
      proposed.length
        ? proposed
            .map(
              (p) =>
                `<article class="production-card" data-production="${esc(p.id)}"><header><div><strong>${esc(p.name)}</strong><small>${num(p.quantity)} kg · ${date(p.date + "T12:00:00Z")}</small></div>${pill("Por aprobar", "sand")}</header><div class="table-scroll"><table class="delivery-table"><thead><tr><th>Ingrediente</th><th>Estimado por receta</th><th>Consumo real</th><th>Stock actual</th></tr></thead><tbody>${p.lines
                  .map((l) => {
                    const pr = product(l.product);
                    return `<tr><td><strong>${esc(pr.name)}</strong></td><td>${num(l.quantity)} ${esc(pr.unit)}</td><td><input type="number" class="inline-input" data-prod-line="${esc(l.product)}" value="${l.quantity}" min="0" max="1000000" step="${pr.unit === "ud" ? "1" : "0.001"}" aria-label="Consumo real de ${esc(pr.name)}"> ${esc(pr.unit)}</td><td>${num(pr.stock)} ${esc(pr.unit)}${pr.stock < l.quantity ? " " + pill("Insuficiente", "peach") : ""}</td></tr>`;
                  })
                  .join(
                    "",
                  )}</tbody></table></div>${p.output ? `<p><strong>Producto terminado:</strong> ${esc(product(p.output.product).name)} <input type="number" class="inline-input" data-prod-output value="${p.output.quantity}" min="0" max="1000000" step="0.001" aria-label="Kilos de producto terminado"> kg</p>` : '<p class="muted">Esta receta no tiene producto terminado asociado; solo se descuentan ingredientes.</p>'}<label class="field">Nota (opcional)<input type="text" class="inline-input wide" data-prod-note maxlength="500" placeholder="Ejemplo: se usó más leche"></label><div class="row-actions">${btn(icon("check") + " Aprobar y descontar", "applyProduction", "primary", `data-id="${esc(p.id)}"`)}${btn("Descartar", "discardProduction", "secondary", `data-id="${esc(p.id)}"`)}</div></article>`,
            )
            .join("")
        : '<div class="empty compact">No hay producciones pendientes. Registra una producción para ver el consumo estimado.</div>'
    }</section><section class="panel"><div class="panel-heading"><div><h2>Hoja diaria de producción</h2><p>Kilos producidos por día y por gelato, con el consumo aprobado.</p></div></div>${
      dates.length
        ? `<div class="table-scroll"><table class="delivery-table"><thead><tr><th>Día</th><th>Gelato</th><th>Kilos</th><th>Consumo aprobado</th></tr></thead><tbody>${dates
            .map((d) =>
              byDate[d]
                .map(
                  (p, i) =>
                    `<tr>${i === 0 ? `<td rowspan="${byDate[d].length}"><strong>${date(d + "T12:00:00Z")}</strong><small>${num(byDate[d].reduce((n, x) => n + x.quantity, 0))} kg en total</small></td>` : ""}<td>${esc(p.name)}${p.note ? `<small>${esc(p.note)}</small>` : ""}</td><td>${num(p.output?.quantity ?? p.quantity)} kg</td><td>${
                      p.lines
                        .filter((l) => l.quantity)
                        .map(lineText)
                        .join(", ") || "Sin consumo"
                    }</td></tr>`,
                )
                .join(""),
            )
            .join("")}</tbody></table></div>`
        : '<div class="empty compact">Todavía no hay producciones aprobadas.</div>'
    }</section><section class="panel"><div class="panel-heading"><div><h2>Recetas</h2><p>Cantidades por lo que rinde cada receta, en la unidad base de cada ingrediente.</p></div></div><div class="recipe-grid">${
      state.recipes
        .map(
          (r) =>
            `<article class="recipe-card"><h3>${esc(r.name)}</h3><small>Rinde ${num(r.yield)} kg${r.product ? " · terminado: " + esc(product(r.product).name) : " · sin producto terminado"}</small><ul>${r.ingredients.map((i) => `<li>${lineText(i)}</li>`).join("")}</ul>${r.note ? `<p class="muted">${esc(r.note)}</p>` : ""}<div class="row-actions">${btn("Producir", "produce", "primary", `data-recipe="${esc(r.id)}"`)}${btn("Editar", "recipeEditor", "secondary", `data-id="${esc(r.id)}"`)}${btn("Eliminar", "deleteRecipe", "secondary", `data-id="${esc(r.id)}"`)}</div></article>`,
        )
        .join("") ||
      '<div class="empty compact">Sin recetas. Crea la primera con «Nueva receta».</div>'
    }</div></section>${salesSection()}`
  );
}
function salesSection() {
  const finished = state.products.filter(
    (p) =>
      p.unit === "kg" &&
      (state.recipes.some((r) => r.product === p.id) ||
        ["Gelatería", "Postres"].includes(p.category)),
  );
  const today = new Date().toISOString().slice(0, 10);
  return `<section class="panel" data-sales><div class="panel-heading"><div><h2>Ventas y mermas del día</h2><p>Kilos vendidos o desechados de producto terminado. Cada cantidad crea una salida o una merma trazable y reversible.</p></div></div><label class="field short">Día<input type="date" class="inline-input" data-sales-date value="${today}" max="${today}"></label><div class="table-scroll"><table class="delivery-table"><thead><tr><th>Producto terminado</th><th>Stock</th><th>Vendido (kg)</th><th>Merma (kg)</th></tr></thead><tbody>${finished
    .map(
      (p) =>
        `<tr><td><strong>${esc(p.name)}</strong></td><td>${num(p.stock)} kg</td><td><input type="number" class="inline-input" data-sold="${esc(p.id)}" min="0" max="1000000" step="0.001" placeholder="0" aria-label="Vendido de ${esc(p.name)}"></td><td><input type="number" class="inline-input" data-waste="${esc(p.id)}" min="0" max="1000000" step="0.001" placeholder="0" aria-label="Merma de ${esc(p.name)}"></td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div>${finished.length ? `<div class="row-actions">${btn(icon("check") + " Registrar ventas y mermas", "dailySales", "primary")}</div>` : '<p class="muted">No hay productos terminados en kg.</p>'}</section>`;
}
function ingredientRow(productId = "", qty = "") {
  return `<div class="ingredient-row"><select name="ing-product" aria-label="Ingrediente">${options([["", "Elegir ingrediente"], ...state.products.map((p) => [p.id, `${p.name} (${p.unit})`])], productId)}</select><input name="ing-qty" type="number" min="0.001" max="1000000" step="0.001" value="${esc(qty)}" aria-label="Cantidad"><button type="button" class="icon-button" data-action="removeIngredient" aria-label="Quitar ingrediente">${icon("close")}</button></div>`;
}
function aiChatSection() {
  return `<section class="panel settings-card ai-chat"><h2>Dudas sobre la app o el texto</h2><p>Pregunta cómo usar GelatoStock o qué dice el texto del editor. Responde el mismo modelo local con una guía fija; no consulta tu inventario ni tus pedidos y no ejecuta acciones.</p><div class="ai-chat-log" aria-live="polite">${aiChat.map((m) => `<article class="ai-chat-msg ${m.role}"><strong>${m.role === "user" ? "Tú" : "IA local"}</strong><p class="${m.role === "assistant" ? "ai-chat-answer" : ""}">${esc(m.content)}</p></article>`).join("") || '<p class="muted">Ejemplo: «¿Qué hace Control de entregas?» o «¿Este texto es una factura o un presupuesto?»</p>'}</div><label class="check"><input type="checkbox" id="ai-chat-doc" ${aiChatUseDoc ? "checked" : ""} ${aiBusy ? "disabled" : ""}> Usar el texto del editor como contexto</label><label class="field">Tu pregunta<textarea id="ai-chat-input" maxlength="1500" rows="3" ${aiBusy ? "disabled" : ""}></textarea></label><div class="setting-actions">${btn(aiBusy ? "Respondiendo en este equipo…" : "Preguntar a la IA local", "aiChatSend", "primary", aiBusy ? "disabled" : "")}${aiBusy ? btn("Detener", "aiCancel") : ""}${aiChat.length ? btn("Vaciar chat", "aiChatClear", "secondary") : ""}</div>${aiChatError ? `<p role="alert">${esc(aiChatError)}</p>` : ""}<small>Respuestas orientativas generadas en este equipo; pueden ser incorrectas o incompletas. El chat se conserva solo en esta ventana. Se envían al modelo los últimos 6 mensajes.</small></section>`;
}
function aiPage() {
  return (
    header(
      "Una segunda lectura, en tu equipo.",
      "Interpreta textos de proveedores sin enviar tus documentos a una IA externa.",
    ) +
    `<div class="settings-grid"><section class="panel settings-card"><h2>Texto que quieres revisar</h2><p>Pega un mensaje o abre el texto de una foto desde Configuración. Revisa el OCR antes de analizarlo. Para PDF todavía debes copiar el texto.</p><label class="field">Profundidad de lectura<select id="ai-mode" ${aiBusy ? "disabled" : ""}><option value="careful" ${aiMode === "careful" ? "selected" : ""}>Revisión reforzada · dos lecturas</option><option value="standard" ${aiMode === "standard" ? "selected" : ""}>Lectura simple · más rápida</option></select></label><label class="field">Documento o mensaje<textarea id="ai-text" class="ai-editor" maxlength="4000" ${aiBusy ? "disabled" : ""}>${esc(aiDraft)}</textarea></label><small>Máximo 4.000 caracteres. Se analiza únicamente este texto.</small><div class="setting-actions">${btn(aiBusy ? "Leyendo en este equipo…" : "Analizar con IA local", "aiAnalyze", "primary", aiBusy ? "disabled" : "")}${aiBusy ? btn("Detener lectura", "aiCancel") : ""}</div><p role="status">${aiBusy ? "Cargando el modelo y leyendo. Puede tardar hasta 4 minutos; puedes seguir usando otras pantallas." : "Modelo local incluido · sin pagos por uso"}</p>${aiError ? `<p role="alert">${esc(aiError)}</p>` : ""}</section><section class="panel settings-card"><span class="stat-icon sage">${icon("shield")}</span><h2>Lectura para revisar</h2>${aiResult ? `<div class="ai-result" id="ai-reading-result"><strong>${esc(aiTypes[aiResult.tipo])}</strong>${aiResult.invalid ? `<p>${esc(aiResult.reason)}</p>` : `<p>Inicio del texto original para contrastar:</p><blockquote>${esc(aiResult.evidencia)}</blockquote>`}<p><strong>${aiResult.verification?.status === "agreement" ? "Dos lecturas coinciden · requiere revisión" : aiResult.verification?.status === "disagreement" ? "Las lecturas no coinciden · revisa el original" : "Una lectura · requiere revisión"}</strong></p>${(aiResult.warnings || []).map((w) => `<p class="ai-warning">${esc(w)}</p>`).join("")}${aiResult.arithmetic ? `<div class="ai-math"><strong>Comprobación de importes por la app</strong><p>${esc(aiResult.arithmetic.reason)}</p>${aiResult.arithmetic.status !== "not_checked" ? `<p>Base ${money(aiResult.arithmetic.base)} + IVA ${money(aiResult.arithmetic.tax)} = ${money(aiResult.arithmetic.expected)}<br>Total declarado: ${money(aiResult.arithmetic.total)}</p>` : ""}</div>` : ""}<small>${num(aiResult.milliseconds / 1000)} segundos · ${esc(aiResult.model)}</small>${aiSourcePhoto && state.photos.some((p) => p.id === aiSourcePhoto) && !aiResult.invalid ? `<div class="setting-actions">${btn("Confirmar este tipo en la foto", "aiSavePhotoType", "secondary")}<small>Queda guardado como tu decisión, no como la de la IA.</small></div>` : ""}</div>` : "<p>Al analizar verás un posible tipo de documento y el inicio del texto original.</p>"}<p>La IA puede equivocarse o inventar detalles. Contrasta su propuesta con el original. Una lista de precios no acredita una compra ni una recepción.</p><ul class="feature-list"><li>${icon("check")} No modifica stock ni registra facturas</li><li>${icon("check")} No compra, no envía mensajes y no abre enlaces</li><li>${icon("check")} Texto y resultado no se guardan en registros de IA</li></ul><small>El resultado se conserva en esta ventana hasta sustituirlo o cerrar la app. El documento original, si lo guardaste, permanece en su archivo.</small></section>${aiChatSection()}</div>`
  );
}
function orderTracking() {
  const open = state.orders.filter(
    (o) => !["received", "cancelled"].includes(o.status),
  );
  const closed = state.orders.filter((o) =>
    ["received", "cancelled"].includes(o.status),
  );
  const list = orderFilter === "open" ? open : closed;
  return `<section class="orders-panel"><div class="tracking-intro"><div><span class="eyebrow">DESPUÉS DEL CARRITO</span><h2>Control de entregas</h2><p>Comprueba qué llegó y qué falta en cada pedido. Solo las cantidades que registres como recibidas se suman al inventario.</p></div><div class="tracking-example"><strong>Un ejemplo</strong><p>Pides 6 cajas y llegan 4: registras esas 4. Las otras 2 siguen pendientes.</p><small>Los pedidos de este prototipo son de demostración.</small></div></div><div class="tracking-tabs" aria-label="Filtrar entregas">${btn(`En curso · ${open.length}`, "orderFilter", orderFilter === "open" ? "primary" : "secondary", 'data-filter="open" aria-pressed="' + (orderFilter === "open") + '"')}${btn(`Cerrados · ${closed.length}`, "orderFilter", orderFilter === "closed" ? "primary" : "secondary", 'data-filter="closed" aria-pressed="' + (orderFilter === "closed") + '"')}</div><div class="delivery-list">${
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
        return `<article class="delivery-card" data-order-card="${esc(o.id)}"><header><div><span class="order-number">${esc(o.number)} · ${date(o.at)}${o.expected ? " · entrega prevista " + date(o.expected + "T12:00:00Z") : ""}</span><h3>${esc(supplier(o.supplier).name)}</h3></div>${pill(statusLabel[o.status], o.status === "received" ? "sage" : "sand")}</header><div class="delivery-progress"><span>${finished} de ${o.lines.length} productos recibidos por completo</span><strong>${money(o.lines.reduce((n, l) => n + l.packs * l.price, 0))} <small>estimados</small></strong></div><div class="table-scroll"><table class="delivery-table"><thead><tr><th>Producto / presentación</th><th>Pedido</th><th>Recibido</th><th>${o.status === "cancelled" ? "No entregado" : "Falta recibir"}</th></tr></thead><tbody>${o.lines
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
        })()}<footer class="delivery-next"><div><strong>${hint}</strong><small>${o.dispatch ? `Enviado por WhatsApp a ${esc(o.dispatch.to)} el ${date(o.dispatch.at)} ${time(o.dispatch.at)}. Pendiente de confirmación del proveedor.` : o.status === "pending" || o.status === "sent" ? "Simulación: no se ha contactado al proveedor." : "Registro de demostración · sin pagos ni mensajes enviados."}</small></div><div class="row-actions">${o.status === "pending" ? btn("Enviar por WhatsApp", "orderWhatsApp", "primary", `data-order="${esc(o.id)}"`) + btn("Simular envío", "send", "secondary", `data-order="${esc(o.id)}"`) + btn("Cancelar pedido", "cancelOrder", "secondary", `data-order="${esc(o.id)}"`) : ["sent", "partial"].includes(o.status) ? btn("Registrar lo que llegó", "receive", "primary", `data-order="${esc(o.id)}"`) : ""}</div></footer></article>`;
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
      "Prepará el carrito, revisá el pedido y registrá lo que llega.",
      btn("Sugerir reposición", "suggest", "primary"),
    ) +
    `<div class="notice">${icon("shield")}<div><strong>Compras de demostración</strong><span>Podés probar el circuito completo. No se envían mensajes ni se realizan pagos.</span></div></div><div class="purchase-grid"><section class="panel"><div class="panel-heading"><h2>Tu carrito</h2>${pill(state.cart.length + " productos")}</div>${
      state.cart.length
        ? `<div class="cart-lines">${state.cart
            .map((l) => {
              const p = product(l.product);
              return `<div class="cart-line"><span class="product-icon sage">${icon(p.icon)}</span><div class="cart-desc"><strong>${esc(p.name)}</strong><small>${esc(supplier(p.supplier).name)} · ${num(p.pack)} ${p.unit} / paquete</small></div><input aria-label="Paquetes de ${esc(p.name)}" class="quantity" type="number" min="0" max="10000" step="1" value="${l.packs}" data-cart="${p.id}"><strong>${money(l.packs * p.price)}</strong><button class="icon-button" aria-label="Quitar ${esc(p.name)}" data-remove="${p.id}">${icon("close")}</button></div>`;
            })
            .join("")}</div>`
        : '<div class="empty">' +
          icon("cart") +
          "<h3>Tu próximo pedido empieza aquí</h3><p>Añadí productos o prepará la reposición sugerida.</p></div>"
    }<div class="panel-bottom">${btn(icon("plus") + " Añadir producto", "addcart")}</div></section><aside class="panel order-summary"><h2>Resumen del carrito</h2><div class="summary-row"><span>Productos</span><strong>${money(total)}</strong></div><div class="summary-row"><span>Envío e impuestos</span><span>Por confirmar</span></div><div class="summary-total"><span>Total estimado</span><strong>${money(total)}</strong></div><p>Los precios son ficticios. Se creará un pedido independiente por proveedor.</p>${btn("Revisar y autorizar " + icon("arrow"), "checkout", "primary full", state.cart.length ? "" : "disabled")}<small>Se guardará como pendiente de envío.</small></aside></div>${orderTracking()}`
  );
}
function messages() {
  const fold = (v) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const list = state.messages.filter(
    (x) =>
      (messageSupplier === "all" || x.supplier === messageSupplier) &&
      (messageFilter === "all" ||
        (messageFilter === "unread" && !x.read) ||
        (messageFilter === "pending" && !x.reviewed) ||
        (messageFilter === "important" &&
          x.priority === "important" &&
          !x.reviewed) ||
        (messageFilter === "relevant" && x.relevance === "relevant") ||
        (messageFilter === "toread" &&
          x.interpretation?.needsReading &&
          !x.reviewed)) &&
      fold(x.text + " " + supplier(x.supplier).name).includes(
        fold(messageQuery),
      ),
  );
  const m = list.find((x) => x.id === selectedMessage) || list[0];
  return (
    header(
      "Mensajes que se convierten en acciones.",
      "Las novedades relevantes de tus proveedores, sin perder el original.",
      btn(icon("plus") + " Simular mensaje", "message", "primary"),
    ) +
    `<div class="notice subtle">${icon("message")}<div><strong>Bandeja de proveedores</strong><span>Mensajes de WhatsApp de proveedores autorizados y mensajes de demostración, leídos por reglas. Las respuestas al pedido enviado se vinculan solas cuando no hay duda.</span></div></div><div class="message-filters"><label class="field">Buscar mensajes<input id="message-search" type="search" value="${esc(messageQuery)}" placeholder="Texto o proveedor"></label><label class="field">Proveedor<select id="message-supplier"><option value="all">Todos los proveedores</option>${state.suppliers.map((s) => `<option value="${s.id}" ${messageSupplier === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label><label class="field">Mostrar<select id="message-filter">${Object.entries(
      {
        all: "Todos los mensajes",
        unread: "Sin leer",
        pending: "Sin revisar",
        important: "Importantes pendientes",
        relevant: "Relacionados con pedidos",
        toread: "Debes leer",
      },
    )
      .map(
        ([v, l]) =>
          `<option value="${v}" ${messageFilter === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label></div><section class="inbox-layout"><div class="conversation-list"><div class="conversation-heading">Bandeja de proveedores <span>${list.length} de ${state.messages.length}</span></div>${list.map((x) => `<button class="conversation ${m?.id === x.id ? "selected" : ""}" data-open-message="${x.id}"><span class="supplier-avatar ${supplier(x.supplier).color}">${esc(supplier(x.supplier).initials)}</span><div><div class="conversation-title"><strong>${esc(supplier(x.supplier).name)}</strong><small>${time(x.at)}</small></div><p>${esc(x.text)}</p><span class="mini-status">${x.reviewed ? "Revisado" : priorityLabel[x.priority]} · ${relevanceLabel[x.relevance]}${x.interpretation?.needsReading && !x.reviewed ? " · Leer" : ""}</span></div>${!x.read ? '<i class="unread-dot"></i>' : ""}</button>`).join("")}</div><div class="message-detail">${m ? `<div class="detail-heading"><span class="supplier-avatar ${supplier(m.supplier).color}">${esc(supplier(m.supplier).initials)}</span><div><h2>${esc(supplier(m.supplier).name)}</h2><p>${m.channel === "whatsapp" ? "WhatsApp · " + esc(m.sender || "") : "Mensaje de demostración"} · ${date(m.at)}, ${time(m.at)}</p></div>${pill(m.reviewed ? "Revisado" : priorityLabel[m.priority], m.reviewed ? "sage" : m.priority === "important" ? "peach" : "lavender")}</div><div class="message-body"><div class="message-label">MENSAJE ORIGINAL</div><div class="message-bubble">${esc(m.text)}</div><div class="interpretation"><div class="message-label">${icon("leaf")} LECTURA ASISTIDA POR REGLAS</div><h3>${esc(priorityLabel[m.priority])}</h3><p>${esc(m.reason)}</p><h3>${esc(relevanceLabel[m.relevance])}</h3><p>${esc(m.relevanceReason)}</p>${replyBlock(m)}<div class="muted">${m.order ? "Vinculado a " + esc(state.orders.find((o) => o.id === m.order)?.number) : "Sin pedido vinculado. No se han modificado compras ni stock."}</div></div><div class="message-actions">${btn(aiReplyBusy === m.id ? "Leyendo la respuesta…" : "Segunda lectura con IA local", "aiReadReply", "secondary", `data-id="${esc(m.id)}" ${aiReplyBusy ? "disabled" : ""}`)}${btn("Abrir en IA local", "aiMessage", "secondary", `data-id="${esc(m.id)}"`)}${btn("Corregir lectura", "correctReading", "secondary", `data-id="${esc(m.id)}"`)}${btn(m.reviewed ? "Mensaje revisado" : icon("check") + " Marcar revisado", "review", "primary", `data-id="${m.id}" ${m.reviewed ? "disabled" : ""}`)}${btn("Cambiar prioridad", "priority", "secondary", `data-id="${m.id}"`)}${btn("Corregir relevancia", "relevance", "secondary", `data-id="${m.id}"`)}${btn("Vincular pedido", "link", "secondary", `data-id="${m.id}"`)}</div><p class="fineprint">Revisar un mensaje no acepta sobrecostes ni sustituciones. La conexión real se añadirá en una siguiente etapa.</p></div>` : '<div class="empty">No hay mensajes que coincidan con estos filtros.</div>'}</div></section>`
  );
}
function suppliers() {
  return (
    header(
      "Personas detrás de cada ingrediente.",
      "Tus proveedores y sus productos, reunidos en un solo lugar.",
      btn(icon("plus") + " Nuevo proveedor", "supplierEditor", "primary"),
    ) +
    `<div class="supplier-grid">${state.suppliers.map((s) => `<article class="panel supplier-card"><span class="supplier-avatar large ${s.color}">${esc(s.initials)}</span><h2>${esc(s.name)}</h2><p>${esc(s.category)}</p><div class="supplier-info">${icon("clock")} ${esc(s.delivery)}</div><div class="supplier-info">${icon("box")} ${state.products.filter((p) => p.supplier === s.id).length} productos en catálogo</div><div class="supplier-card-footer">${btn("Editar", "supplierEditor", "secondary", `data-supplier="${s.id}"`)}${btn("Simular mensaje", "message", "secondary", `data-supplier="${s.id}"`)}</div></article>`).join("")}</div><div class="notice">${icon("store")}<div><strong>Tu red de proveedores vendrá después</strong><span>Makro España y WhatsApp necesitan una integración comprobada. Estas fichas sirven para probar el flujo.</span></div></div>`
  );
}
function activity() {
  const kinds = {
    count: "Conteo",
    entry: "Entrada",
    exit: "Salida",
    waste: "Merma",
    receipt: "Recepción",
    reversal: "Corrección",
    production: "Producción",
    output: "Terminado",
  };
  const ledger = state.movements || [];
  return (
    header(
      "Cada cambio tiene su historia.",
      "Movimientos trazables: ninguna corrección borra el registro original.",
      btn("Entrada / salida", "movement", "primary"),
    ) +
    `<section class="panel"><div class="panel-heading"><div><h2>Movimientos de inventario</h2><p>Últimos 30 movimientos · ${ledger.length} registrados</p></div>${pill("Guardado en SQLite", "sage")}</div>${
      ledger.length
        ? `<div class="table-wrap"><table><thead><tr><th>Producto y motivo</th><th>Tipo</th><th>Cambio</th><th>Antes → después</th><th>Acción</th></tr></thead><tbody>${ledger
            .slice(0, 30)
            .map(
              (m) =>
                `<tr><td><strong>${esc(product(m.product).name)}</strong><small class="movement-reason">${esc(m.reason)} · ${date(m.at)} ${time(m.at)}</small></td><td>${pill(kinds[m.kind])}</td><td>${m.delta > 0 ? "+" : ""}${num(m.delta)} ${product(m.product).unit}</td><td>${num(m.before)} → ${num(m.after)}</td><td>${m.kind !== "receipt" && !m.reverses && !ledger.some((x) => x.reverses === m.id) ? btn("Revertir", "reverse", "secondary", `data-id="${m.id}"`) : pill(m.reverses ? "Compensación" : ledger.some((x) => x.reverses === m.id) ? "Revertido" : "Pedido")}</td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : '<div class="empty compact">Los nuevos conteos, entradas y salidas aparecerán aquí.</div>'
    }</section>` +
    `<section class="panel activity-panel orders-panel"><div class="panel-heading"><h2>Actividad reciente</h2></div>${state.activity
      .slice(0, 50)
      .map(
        (a) =>
          `<div class="activity-row"><span class="activity-dot"></span><div><p>${esc(a.text)}</p><small>${date(a.at)} · ${time(a.at)}</small></div></div>`,
      )
      .join("")}</section>`
  );
}
function settings() {
  return (
    header(
      "Un espacio que funciona a tu manera.",
      "Datos locales, copias de seguridad y un camino claro para crecer.",
    ) +
    `<div class="settings-grid"><section class="panel settings-card"><span class="stat-icon sage">${icon("shield")}</span><h2>Datos bajo tu control</h2><p>SQLite guarda las operaciones de forma consistente. Las fotos se almacenan por separado y se incluyen en las copias.</p><label class="path-label">CARPETA DE DATOS</label><code class="path">${esc(dataDir)}</code><div class="setting-actions">${btn(icon("download") + " Crear copia", "backup", "primary")}${btn("Exportar CSV", "exportCsv", "secondary")}${btn("Restaurar copia", "restore")}</div><p class="fineprint">Restaurar reemplaza los datos actuales. Se conserva una copia previa automáticamente.</p><p class="fineprint">Copia automática diaria en la carpeta backups (se conservan las 30 últimas automáticas). ${backupInfo?.last ? "Última: " + date(backupInfo.last) + " " + time(backupInfo.last) + "." : "Todavía no se ha creado."}${backupInfo?.warning ? " " + esc(backupInfo.warning) : ""}</p></section><section class="panel settings-card"><span class="stat-icon lavender">${icon("leaf")}</span><h2>Inteligencia integrada</h2>${pill("Modelo local incluido", "sage")}<p>El modelo local propone el tipo de documento y contrasta la clasificación con el texto original. El OCR español sigue leyendo las fotos dentro del equipo.</p>${btn("Abrir IA local", "aiOpen", "primary")}<ul class="feature-list"><li>${icon("check")} Sin API de IA ni consumo de pago</li><li>${icon("check")} Inventario operativo sin internet</li><li>${icon("clock")} Lecturas revisables; sin acciones automáticas</li></ul></section><section class="panel settings-card"><h2>Archivo de fotos y documentos</h2><p>Fotos y PDF ordenados por proveedor y fecha del documento. La pantalla Documentos permite vincularlos a pedidos y aceptar propuestas.</p>${btn("Abrir Documentos", "openDocuments", "secondary")}${archiveWarning ? `<p role="alert">${esc(archiveWarning)}</p>` : ""}<code class="path">${esc(dataDir)} / proveedores</code>${btn(icon("photo") + " Cargar foto", "photo")}<div class="photo-grid">${
      [...state.photos]
        .sort(
          (a, b) =>
            (a.supplier || "").localeCompare(b.supplier || "") ||
            (b.documentDate || b.at).localeCompare(a.documentDate || a.at),
        )
        .map(
          (ph) =>
            `<figure><img src="${esc(ph.data || "/api/photos/" + ph.id)}" alt="${esc(ph.name)}"><figcaption><strong>${esc(ph.supplier ? supplier(ph.supplier).name : "Sin proveedor")}</strong><small>${esc(ph.documentDate || ph.at.slice(0, 10))}${ph.docType ? " · " + esc(aiTypes[ph.docType] || ph.docType).replace("Posible ", "") : ""}</small>${esc(ph.name)}<small>${esc(ph.note)}</small>${btn("Organizar", "organizePhoto", "secondary", `data-id="${ph.id}"`)}${ph.ocrText ? btn("Revisar texto con IA", "aiPhoto", "secondary", `data-id="${ph.id}"`) : ""}</figcaption></figure>`,
        )
        .join("") || '<p class="muted">Todavía no hay fotos guardadas.</p>'
    }</div></section><section class="panel settings-card"><span class="stat-icon sage">${icon("shield")}</span><h2>Recetario protegido</h2>${lockInfo?.enabled ? `<p>Las recetas piden contraseña. Estado: <strong>${lockInfo.unlocked ? "desbloqueado (30 min)" : "bloqueado"}</strong>.</p><div class="setting-actions">${btn("Bloquear ahora", "lockNow", "secondary")}${btn("Cambiar contraseña", "lockChange", "secondary")}${btn("Quitar contraseña", "lockRemove", "secondary")}</div>` : `<p>Sin contraseña: cualquiera con la app abierta ve las recetas.</p>${btn("Poner contraseña", "lockSet", "primary")}`}<p class="fineprint">Protege la pantalla y bloquea crear, editar o producir con recetas. No cifra el disco.</p></section><section class="panel settings-card"><h2>Limpieza periódica</h2><p>Borra la actividad y las conversaciones de WhatsApp más antiguas que el plazo elegido (se conservan las 50 entradas más recientes). Los movimientos de stock y las copias no se tocan.</p><label class="field">Conservar<select id="retention-days">${[
      [0, "Sin limpieza automática"],
      [7, "7 días (semanal)"],
      [14, "14 días"],
      [30, "30 días"],
      [90, "90 días"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${retentionDays === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><div class="setting-actions">${btn("Limpiar ahora", "purgeNow", "secondary", retentionDays ? "" : "disabled")}</div><p class="fineprint">La limpieza automática se ejecuta al abrir la app y cada seis horas. Antes existe siempre la copia automática diaria.</p></section><section class="panel settings-card"><h2>Lo que la app ha aprendido de tus correcciones</h2><p>Cuando corriges la lectura de un mensaje, la app recuerda la frase y aplica tu categoría a mensajes iguales o casi iguales. No entrena ningún modelo: son tus decisiones, y puedes olvidarlas aquí.</p>${
      state.learned.length
        ? state.learned
            .slice(0, 30)
            .map(
              (l) =>
                `<p><strong>${esc(replyLabel[l.category] || l.category)}</strong> · ${esc(l.example)} <small>${date(l.at)}</small> ${btn("Olvidar", "forgetLearned", "secondary", `data-id="${esc(l.id)}"`)}</p>`,
            )
            .join("") +
          (state.learned.length > 30
            ? `<p class="muted">Y ${state.learned.length - 30} más.</p>`
            : "")
        : '<p class="muted">Todavía no has corregido ninguna lectura.</p>'
    }</section><section class="panel settings-card"><h2>Identidad del negocio</h2><p>El nombre y el lugar aparecen en la barra lateral, en los mensajes de pedido y en las exportaciones.</p><p><strong>${esc(state.business)}</strong>${state.place ? " · " + esc(state.place) : ""}</p>${btn("Editar identidad", "businessEditor", "secondary")}</section><section class="panel settings-card"><h2>Primeros pasos</h2><ol class="steps"><li><strong>Inventario</strong>: revisa productos, mínimos y presentaciones; registra el stock real con «Registrar stock».</li><li><strong>Proveedores</strong>: completa NIF, WhatsApp con prefijo (+34…) y otros nombres que aparezcan en sus documentos.</li><li><strong>Producción</strong>: crea tus recetas; cada día anota kilos producidos, aprueba el consumo y registra ventas y mermas.</li><li><strong>Compras</strong>: «Preparar reposición», revisa el carrito, autoriza y envía por WhatsApp; registra lo que llega en Control de entregas.</li><li><strong>WhatsApp</strong>: conecta por QR, autoriza los chats de tus proveedores y activa «Conectar al abrir».</li><li><strong>Mensajes</strong>: mira «Debes leer»; lo demás queda anotado. La IA local es opcional y solo propone.</li><li><strong>Copias</strong>: se hacen solas cada día; restaura desde aquí si hace falta.</li></ol></section><section class="panel settings-card"><h2>Sobre este prototipo</h2><p>GelatoStock · versión ${esc(appVersion)}</p><p>Datos de ejemplo persistentes. Compras y mensajes simulados. Los módulos futuros se detallan en los documentos de la carpeta del proyecto.</p><div class="notice inline">${icon("box")}<span>Esta instalación es independiente. Todavía no sincroniza con otros equipos.</span></div></section></div>`
  );
}
