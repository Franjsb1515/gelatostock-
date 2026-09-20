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
    `<section class="hero"><div class="hero-copy"><span class="hero-label"><i class="dot"></i> ARTE + GELATO · HOY</span><h2>Más tiempo para crear.<br>Menos para contar.</h2><p>${low().length ? `Hay ${low().length} productos por debajo del mínimo.<br>Prepara la reposición y sigue con tu día.` : "Tu inventario está por encima de los mínimos.<br>Todo listo para seguir con tu día."}</p>${btn("Preparar reposición " + icon("arrow"), "suggest", "cream")}</div><div class="hero-art" aria-hidden="true"><span class="art-orbit"></span><span class="art-dot"></span><div class="scoop scoop-one"></div><div class="scoop scoop-two"></div><div class="scoop scoop-three"></div><div class="gelato-cup"><span>g.</span></div><span class="art-caption">un poco de orden,<br>mucho gelato.</span></div></section>
 ${homeNotices()}${homeDay()}<section class="stats"><article class="stat"><span class="stat-icon sage">${icon("box")}</span><div><p>Productos en catálogo</p><strong>${state.products.length}</strong><small>Todo tu inventario</small></div></article><article class="stat"><span class="stat-icon peach">${icon("alert")}</span><div><p>Necesitan reposición</p><strong>${low().length}</strong><small>Por debajo del mínimo</small></div></article><article class="stat"><span class="stat-icon lavender">${icon("cart")}</span><div><p>Pedidos en curso</p><strong>${open.length}</strong><small>${state.cart.length} productos en el carrito</small></div></article><article class="stat"><span class="stat-icon sand">${icon("store")}</span><div><p>Valor estimado del stock</p><strong class="money-value">${money(value)}</strong><small>Lo que hay × el precio de compra de cada ficha</small></div></article></section>
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
    ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Disponible</th>${compact ? "" : "<th>Mín. / objetivo</th><th>Proveedor</th>"}<th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${items.map((p) => `<tr><td><div class="product-cell"><span class="product-icon ${p.category === "Gelatería" ? "sage" : p.category === "Cafetería" ? "sand" : p.category === "Postres" ? "rose" : "lavender"}">${icon(p.icon)}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.detail)}${compact ? "" : " · " + esc(zoneLabel[p.zone || "almacen"])}</small></div></div></td><td><strong>${num(p.stock)} <span class="unit">${p.unit}</span></strong>${pending(p.id) ? `<small class="incoming">+ ${num(pending(p.id))} en pedido</small>` : ""}</td>${compact ? "" : `<td>${num(p.min)} / ${num(p.target)} ${p.unit}</td><td>${esc(supplier(p.supplier).name)}</td>`}<td>${p.stock < p.min ? pill("Stock bajo", "peach") : pill("En orden", "sage")}</td><td>${compact ? `<button class="icon-button bordered" data-add="${p.id}" aria-label="Añadir ${esc(p.name)} al carrito">${icon("plus")}</button>` : `<div class="row-actions"><button class="text-button" data-count="${p.id}">Contar</button><button class="text-button" data-action="editProduct" data-product="${p.id}">Editar</button></div>`}</td></tr>`).join("")}</tbody></table></div>`
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
        btn(icon("check") + " Hoja de conteo", "countSheet") +
        btn(icon("photo") + " Cargar foto", "photo") +
        btn(icon("plus") + " Nuevo producto", "product", "primary"),
    ) +
    `<section class="panel"><div class="toolbar"><div class="tabs">${["Todos", "Stock bajo", "Gelatería", "Cafetería", "Postres", "Envases"].map((f) => `<button data-filter="${f}" class="tab ${filter === f ? "selected" : ""}">${f}${f === "Stock bajo" ? ` <span>${low().length}</span>` : ""}</button>`).join("")}</div><label class="search">${icon("search")}<input id="search" placeholder="Buscar producto…" value="${esc(query)}" aria-label="Buscar producto"></label></div>${productTable(items)}<div class="table-footer">${items.length} productos · cada cantidad en su unidad (kg, L o ud)<span>Guardado en este equipo</span></div></section>`
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
// The business day at a glance (core/plan.ts): facts from the ledger, nothing forecast.
function homeDay() {
  const d = alerts?.day;
  if (!d) return "";
  const t = d.totals;
  const busy = t.produced || t.sold || t.waste || t.gift;
  if (!busy && !d.toProduce.length && !d.yesterdayPending) return "";
  const cents = (n) => (n === null ? "No disponible" : money(n));
  const dayName = (x) => date(x + "T12:00:00Z");
  const produce = d.toProduce.length
    ? `<strong>Qué producir hoy</strong><span>${esc(
        d.toProduce
          .slice(0, 4)
          .map((r) => r.name + " " + num(r.suggest) + " kg")
          .join(", "),
      )}${d.toProduce.length > 4 ? "…" : ""}: lo que falta para los kilos que quieres tener. </span><button class="text-button" data-nav="production">Ir a Producción ${icon("arrow")}</button>`
    : "";
  const pending = d.yesterdayPending
    ? `<strong>El ${esc(dayName(d.yesterdayPending))} quedó sin confirmar</strong><span>Tiene producción o ventas apuntadas, pero su cierre no está confirmado. </span><button class="text-button" data-action="openDay" data-date="${esc(d.yesterdayPending)}">Revisarlo ${icon("arrow")}</button>`
    : "";
  return `${produce || pending ? `<div class="notice subtle home-notice">${icon("cake")}<div>${pending}${produce}</div></div>` : ""}${
    busy
      ? `<section class="stats" data-home-day><article class="stat"><span class="stat-icon sage">${icon("cake")}</span><div><p>Producido hoy</p><strong>${num(t.produced)} kg</strong><small>${esc(dayName(d.date))}${d.closed ? " · día cerrado" : ""}</small></div></article><article class="stat"><span class="stat-icon sand">${icon("store")}</span><div><p>Venta estimada de hoy</p><strong class="money-value">${cents(t.soldCents)}</strong><small>${t.soldCents === null ? "Falta escribir el valor de venta en el Recetario" : num(t.sold) + " kg × valor de venta"}</small></div></article><article class="stat"><span class="stat-icon peach">${icon("alert")}</span><div><p>Merma de hoy</p><strong>${num(t.waste)} kg</strong><small>${t.waste ? cents(t.wasteCents) + " de venta perdida" : "Sin merma apuntada"}</small></div></article><article class="stat"><span class="stat-icon lavender">${icon("box")}</span><div><p>Gelato que queda</p><strong>${num(t.remaining)} kg</strong><small>Para mañana</small></div></article></section>`
      : ""
  }`;
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
  const backupWarning = !backupInfo
    ? ""
    : backupInfo.stale
      ? "No hay copia de seguridad de las últimas 48 horas."
      : backupInfo.secondary?.error
        ? backupInfo.secondary.error
        : "";
  const rises = alerts?.prices || [];
  const dueZones = (alerts?.counts || []).filter((z) => z.due);
  const follow = alerts?.orders || [];
  const port = cruiseInfo?.enabled ? cruiseInfo.today : null;
  const ships = port && port.ships ? port : null;
  if (
    !ships &&
    !read &&
    !proposed &&
    !soon.length &&
    !backupWarning &&
    !rises.length &&
    !dueZones.length &&
    !follow.length
  )
    return "";
  return `<div class="notice subtle home-notice">${icon("alert")}<div>${ships ? `<strong>Hoy ${ships.ships === 1 ? "hay 1 crucero" : "hay " + ships.ships + " cruceros"} en Palma · impacto potencial ${esc(ships.impactLabel.toLowerCase())}</strong><span>${esc(ships.names.slice(0, 4).join(", "))}${ships.names.length > 4 ? "…" : ""}. ${ships.passengers === null ? "Pasajeros declarados: no disponible" : num(ships.passengers) + " pasajeros declarados al puerto"}${ships.firstArrival ? ", primera llegada " + ships.firstArrival : ""}${ships.lastDeparture ? ", última salida " + ships.lastDeparture : ""}. </span><button class="text-button" data-nav="cruises">Ver cruceros ${icon("arrow")}</button>` : ""}${backupWarning ? `<strong>${esc(backupWarning)}</strong><span>Revisa las copias en <button class="text-link" data-nav="settings">Configuración</button>.</span>` : ""}${
    follow.length
      ? `<strong>Pedidos que necesitan seguimiento</strong><span>${esc(follow.map((f) => f.text).join(" "))} </span><button class="text-button" data-nav="orders">Ver pedidos ${icon("arrow")}</button>`
      : ""
  }${
    rises.length
      ? `<strong>${rises.length} subida${rises.length === 1 ? "" : "s"} de precio en 30 días</strong><span>${esc(
          rises
            .slice(0, 3)
            .map((r) => `${r.name} +${num(r.pct)} % (${r.supplierName})`)
            .join(", "),
        )}${rises.length > 3 ? "…" : ""}. </span><button class="text-button" data-nav="suppliers">Ver proveedores ${icon("arrow")}</button>`
      : ""
  }${dueZones.length ? `<strong>Toca contar: ${esc(dueZones.map((z) => z.label + (z.ageDays === null ? " (nunca)" : " (hace " + z.ageDays + " días)")).join(", "))}</strong><span>Cuenta la zona con la hoja de conteo y el stock queda al día. </span><button class="text-button" data-action="countSheet">Abrir hoja de conteo ${icon("arrow")}</button>` : ""}${read ? `<strong>${read} mensaje${read === 1 ? "" : "s"} de proveedores que debes leer</strong><span>Falta de producto, cambios, preguntas o retrasos detectados por reglas. </span><button class="text-button" data-nav="messages" data-filter-messages="toread">Ver mensajes ${icon("arrow")}</button>` : ""}${proposed ? `<strong>${proposed} producción${proposed === 1 ? "" : "es"} por aprobar</strong><span>El consumo estimado no cambia el stock hasta que lo apruebes. </span><button class="text-button" data-nav="production">Ver producción ${icon("arrow")}</button>` : ""}${deliveries}</div></div>`;
}
function suppliers() {
  return (
    header(
      "Personas detrás de cada ingrediente.",
      "Tus proveedores y sus productos, reunidos en un solo lugar.",
      btn(icon("plus") + " Nuevo proveedor", "supplierEditor", "primary"),
    ) +
    `<div class="supplier-grid">${state.suppliers
      .map(
        (s) =>
          `<article class="panel supplier-card"><span class="supplier-avatar large ${s.color}">${esc(s.initials)}</span><h2>${esc(s.name)}</h2><p>${esc(s.category)}</p><div class="supplier-info">${icon("clock")} ${esc(s.delivery)}</div><div class="supplier-info">${icon("box")} ${state.products.filter((p) => p.supplier === s.id).length} productos en catálogo</div>${s.web ? `<div class="supplier-info">${icon("store")} <a class="text-link" href="${esc(s.web)}" target="_blank" rel="noopener noreferrer">Web de compra</a></div>` : ""}${(() => {
            const changes = state.prices
              .filter((e) => e.supplier === s.id)
              .slice(-3)
              .reverse();
            return changes.length
              ? `<div class="price-history"><small>Últimos cambios de precio</small>${changes
                  .map((e) => {
                    const p = product(e.product);
                    const up = e.to > e.from;
                    return `<div class="price-change ${up ? "up" : "down"}"><span>${esc(p ? p.name : "")}</span><strong>${money(e.from)} → ${money(e.to)}${e.from ? " (" + (up ? "+" : "") + num(Math.round(((e.to - e.from) / e.from) * 1000) / 10) + " %)" : ""}</strong><small>${date(e.at)}</small></div>`;
                  })
                  .join("")}</div>`
              : "";
          })()}<div class="supplier-card-footer">${btn("Editar", "supplierEditor", "secondary", `data-supplier="${s.id}"`)}${btn("Simular mensaje", "message", "secondary", `data-supplier="${s.id}"`)}</div></article>`,
      )
      .join(
        "",
      )}</div><div class="notice">${icon("store")}<div><strong>Compra en webs como Makro</strong><span>Guarda la web de compra en la ficha. Desde Compras podrás copiar la lista de ese proveedor y abrir su web; la compra la haces tú con tu cuenta y registras la entrega como siempre.</span></div></div>`
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
    `<section class="panel"><div class="panel-heading"><div><h2>Movimientos de inventario</h2><p>Mostrando ${Math.min(historyShown.movements, ledger.length)} de ${historyInfo?.movements ?? ledger.length} registrados</p></div>${pill("Guardado en SQLite", "sage")}</div>${
      ledger.length
        ? `<div class="table-wrap"><table><thead><tr><th>Producto y motivo</th><th>Tipo</th><th>Cambio</th><th>Antes → después</th><th>Acción</th></tr></thead><tbody>${ledger
            .slice(0, historyShown.movements)
            .map(
              (m) =>
                `<tr><td><strong>${esc(product(m.product).name)}</strong><small class="movement-reason">${esc(m.reason)} · ${date(m.at)} ${time(m.at)}</small></td><td>${pill(kinds[m.kind])}</td><td>${m.delta > 0 ? "+" : ""}${num(m.delta)} ${product(m.product).unit}</td><td>${num(m.before)} → ${num(m.after)}</td><td>${m.kind !== "receipt" && !m.reverses && !ledger.some((x) => x.reverses === m.id) ? btn("Revertir", "reverse", "secondary", `data-id="${m.id}"`) : pill(m.reverses ? "Compensación" : ledger.some((x) => x.reverses === m.id) ? "Revertido" : "Pedido")}</td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : '<div class="empty compact">Los nuevos conteos, entradas y salidas aparecerán aquí.</div>'
    }${moreHistory("movements", ledger.length)}</section>` +
    `<section class="panel activity-panel orders-panel"><div class="panel-heading"><h2>Actividad reciente</h2><p>${Math.min(historyShown.activity, state.activity.length)} de ${historyInfo?.activity ?? state.activity.length}</p></div>${state.activity
      .slice(0, historyShown.activity)
      .map(
        (a) =>
          `<div class="activity-row"><span class="activity-dot"></span><div><p>${esc(a.text)}</p><small>${date(a.at)} · ${time(a.at)}</small></div></div>`,
      )
      .join("")}${moreHistory("activity", state.activity.length)}</section>`
  );
}
// "Load more" for the two unbounded lists: first from what the UI already has, then from
// /api/history. Never shown when everything is on screen.
function moreHistory(kind, loaded) {
  const total = historyInfo?.[kind] ?? loaded;
  const visible = Math.min(historyShown[kind], loaded);
  if (visible >= total) return "";
  return `<div class="panel-bottom">${btn(`Mostrar más (${total - visible} anteriores)`, "moreHistory", "secondary", `data-kind="${kind}"`)}</div>`;
}
function settings() {
  return (
    header(
      "Un espacio que funciona a tu manera.",
      "Datos locales, copias de seguridad y un camino claro para crecer.",
    ) +
    `<div class="settings-grid"><section class="panel settings-card"><span class="stat-icon sage">${icon("shield")}</span><h2>Datos bajo tu control</h2><p>SQLite guarda las operaciones de forma consistente. Las fotos se almacenan por separado y se incluyen en las copias.</p><label class="path-label">CARPETA DE DATOS</label><code class="path">${esc(dataDir)}</code><div class="setting-actions">${btn(icon("download") + " Crear copia", "backup", "primary")}${btn("Exportar CSV", "exportCsv", "secondary")}${btn("Restaurar copia", "restore")}</div><p class="fineprint">Restaurar reemplaza los datos actuales. Se conserva una copia previa automáticamente.</p><p class="fineprint">Copia automática diaria en la carpeta backups (se conservan las 30 últimas automáticas). ${backupInfo?.last ? "Última: " + date(backupInfo.last) + " " + time(backupInfo.last) + "." : "Todavía no se ha creado."}${backupInfo?.warning ? " " + esc(backupInfo.warning) : ""}</p><h3 class="setting-subtitle">Copia secundaria</h3>${backupInfo?.secondary?.dir ? `<code class="path">${esc(backupInfo.secondary.dir)}</code><p class="fineprint">${backupInfo.secondary.error ? esc(backupInfo.secondary.error) : backupInfo.secondary.last ? "Última copia allí: " + date(backupInfo.secondary.last) + " " + time(backupInfo.secondary.last) + "." : "Todavía no se ha copiado nada."}</p>` : '<p class="fineprint">Sin carpeta secundaria. Si este disco falla se pierde todo: elige una carpeta en otro disco, un USB o una carpeta sincronizada (OneDrive, Drive).</p>'}<div class="setting-actions">${btn(backupInfo?.secondary?.dir ? "Cambiar carpeta" : "Elegir carpeta secundaria", "backupDirEditor", backupInfo?.secondary?.dir ? "secondary" : "primary")}${backupInfo?.secondary?.dir ? btn("Quitar", "backupDirClear", "secondary") : ""}</div></section><section class="panel settings-card"><span class="stat-icon lavender">${icon("leaf")}</span><h2>Inteligencia integrada</h2>${pill("Modelo local incluido", "sage")}<p>El modelo local propone el tipo de documento y contrasta la clasificación con el texto original. El OCR español sigue leyendo las fotos dentro del equipo.</p>${btn("Abrir IA local", "aiOpen", "primary")}<ul class="feature-list"><li>${icon("check")} Sin API de IA ni consumo de pago</li><li>${icon("check")} Inventario operativo sin internet</li><li>${icon("clock")} Lecturas revisables; sin acciones automáticas</li></ul></section><section class="panel settings-card"><h2>Archivo de fotos y documentos</h2><p>Fotos y PDF ordenados por proveedor y fecha del documento. La pantalla Documentos permite vincularlos a pedidos y aceptar propuestas.</p>${btn("Abrir Documentos", "openDocuments", "secondary")}${archiveWarning ? `<p role="alert">${esc(archiveWarning)}</p>` : ""}<code class="path">${esc(dataDir)} / proveedores</code>${btn(icon("photo") + " Cargar foto", "photo")}<div class="photo-grid">${
      [...state.photos]
        .sort(
          (a, b) =>
            (a.supplier || "").localeCompare(b.supplier || "") ||
            (b.documentDate || b.at).localeCompare(a.documentDate || a.at),
        )
        .map(
          (ph) =>
            `<figure><img src="${esc(ph.data || "/api/photos/" + ph.id)}" alt="${esc(ph.name)}"><figcaption><strong>${esc(ph.supplier ? supplier(ph.supplier).name : "Sin proveedor")}</strong><small>${esc(ph.documentDate || ph.at.slice(0, 10))}${ph.docType ? " · " + esc(aiTypes[ph.docType] || ph.docType).replace("Posible ", "") : ""}</small>${esc(ph.name)}<small>${esc(ph.note)}</small><div class="row-actions">${btn("Organizar", "organizePhoto", "secondary", `data-id="${ph.id}"`)}${ph.ocrText ? btn("Revisar texto con IA", "aiPhoto", "secondary", `data-id="${ph.id}"`) : ""}</div></figcaption></figure>`,
        )
        .join("") || '<p class="muted">Todavía no hay fotos guardadas.</p>'
    }</div></section><section class="panel settings-card"><span class="stat-icon sage">${icon("shield")}</span><h2>Recetario protegido</h2>${lockInfo?.enabled ? `<p>Las recetas piden contraseña. Estado: <strong>${lockInfo.unlocked ? "desbloqueado (30 min)" : "bloqueado"}</strong>.</p><div class="setting-actions">${btn("Bloquear ahora", "lockNow", "secondary")}${btn("Cambiar contraseña", "lockChange", "secondary")}${btn("Quitar contraseña", "lockRemove", "danger")}</div>` : `<p>Sin contraseña: cualquiera con la app abierta ve las recetas.</p>${btn("Poner contraseña", "lockSet", "primary")}`}<p class="fineprint">Protege la pantalla y bloquea crear, editar o producir con recetas. No cifra el disco.</p></section><section class="panel settings-card"><h2>Limpieza periódica</h2><p>Borra la actividad y las conversaciones de WhatsApp más antiguas que el plazo elegido (se conservan las 50 entradas más recientes). Los movimientos de stock y las copias no se tocan.</p><label class="field">Conservar<select id="retention-days">${[
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
      )}</select></label><div class="setting-actions">${btn("Limpiar ahora", "purgeNow", "secondary", retentionDays ? "" : "disabled")}</div><h3 class="setting-subtitle">Día de negocio</h3><p class="fineprint">Si cierras de madrugada, lo que apuntes antes de esta hora cuenta para el día anterior: abres el viernes y cierras el sábado a las 2:00, y sigue siendo viernes.</p><label class="field short">El día cambia a las<select id="day-change-hour">${[
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]
      .map(
        (h) =>
          `<option value="${h}" ${dayChangeHour === h ? "selected" : ""}>${h}:00${h === 0 ? " (medianoche)" : ""}</option>`,
      )
      .join(
        "",
      )}</select></label><h3 class="setting-subtitle">Recordatorio de conteo</h3><p class="fineprint">Resumen avisa cuando una zona lleva más días sin contar por completo.</p><label class="field">Contar cada<select id="count-days">${[
      [0, "Sin recordatorio"],
      [3, "3 días"],
      [7, "7 días (semanal)"],
      [14, "14 días"],
      [30, "30 días"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${countDays === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><p class="fineprint">La limpieza automática se ejecuta al abrir la app y cada seis horas. Antes existe siempre la copia automática diaria.</p></section><section class="panel settings-card"><h2>Cruceros en Palma</h2><p>Con internet, la app lee la previsión pública de escalas de la Autoridad Portuaria de Baleares (al abrir y cada pocas horas). Solo lee: no envía ningún dato tuyo. Sin internet muestra lo último guardado.</p><label class="check-row"><input type="checkbox" id="cruises-enabled" ${cruiseInfo?.enabled === false ? "" : "checked"}> Consultar los cruceros del puerto</label><div class="setting-actions">${btn("Umbrales del impacto", "cruiseThresholds", "secondary", cruiseInfo?.enabled === false ? "disabled" : "")}${btn("Restaurar copia del registro", "cruiseRestore", "secondary")}</div><p class="fineprint">${cruiseInfo?.updatedAt ? "Última actualización: " + date(cruiseInfo.updatedAt) + " " + time(cruiseInfo.updatedAt) + "." : "Todavía sin datos."} Registro en cruceros.sqlite dentro de la carpeta de datos; el histórico no se borra.</p></section><section class="panel settings-card"><h2>Lo que la app ha aprendido de tus correcciones</h2><p>Cuando corriges la lectura de un mensaje, la app recuerda la frase y aplica tu categoría a mensajes iguales o casi iguales. No entrena ningún modelo: son tus decisiones, y puedes olvidarlas aquí.</p>${
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
    }</section><section class="panel settings-card"><h2>Plantilla del pedido</h2><p>Es el texto que se envía por WhatsApp. Puedes cambiar saludo, despedida o firma; {lineas} se sustituye por los productos, {numero}, {negocio} y {proveedor} por sus valores.</p><pre class="template-preview">${esc(orderTemplate)}</pre><div class="setting-actions">${btn("Editar plantilla", "orderTemplateEditor", "secondary")}</div></section><section class="panel settings-card"><h2>Identidad del negocio</h2><p>El nombre y el lugar aparecen en la barra lateral, en los mensajes de pedido y en las exportaciones.</p><p><strong>${esc(state.business)}</strong>${state.place ? " · " + esc(state.place) : ""}</p>${btn("Editar identidad", "businessEditor", "secondary")}</section><section class="panel settings-card"><h2>Primeros pasos</h2><ol class="steps"><li><strong>Inventario</strong>: revisa productos, mínimos y presentaciones; registra el stock real con «Registrar stock».</li><li><strong>Proveedores</strong>: completa NIF, WhatsApp con prefijo (+34…) y otros nombres que aparezcan en sus documentos.</li><li><strong>Producción</strong>: crea tus recetas; cada día anota kilos producidos, aprueba el consumo y registra ventas y mermas.</li><li><strong>Compras</strong>: «Preparar reposición», revisa el carrito, autoriza y envía por WhatsApp; registra lo que llega en Control de entregas.</li><li><strong>WhatsApp</strong>: conecta por QR, autoriza los chats de tus proveedores y activa «Conectar al abrir».</li><li><strong>Mensajes</strong>: mira «Debes leer»; lo demás queda anotado. La IA local es opcional y solo propone.</li><li><strong>Copias</strong>: se hacen solas cada día; restaura desde aquí si hace falta.</li></ol></section><section class="panel settings-card"><h2>Sobre este prototipo</h2><p>GelatoStock · versión ${esc(appVersion)}</p><p>Datos de ejemplo persistentes. Compras y mensajes simulados. Los módulos futuros se detallan en los documentos de la carpeta del proyecto.</p><div class="notice inline">${icon("box")}<span>Esta instalación es independiente. Todavía no sincroniza con otros equipos.</span></div></section></div>`
  );
}
