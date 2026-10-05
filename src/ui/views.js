// Vistas: resumen, inventario, producción, Ayudante, compras, mensajes, proveedores, actividad y ajustes.
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
      "Stock, compras y proveedores en un mismo lugar.",
      btn(icon("photo") + " Cargar foto", "photo") +
        btn(icon("plus") + " Registrar stock", "count", "primary"),
    ) +
    `<section class="hero"><div class="hero-copy"><span class="hero-label">ARTELLO GELATO · HOY</span><h2>Más tiempo para crear.<br>Menos para contar.</h2><p>${low().length ? `Hay ${low().length} productos por debajo del mínimo.` : "Tu inventario está por encima de los mínimos."}</p>${btn("Preparar reposición " + icon("arrow"), "suggest")}</div><div class="hero-seal" aria-hidden="true">${artelloSeal()}</div></section>
 ${homeNotices()}${homeDay()}<section class="stats"><article class="stat"><span class="stat-icon sage">${icon("box")}</span><div><p>Productos en catálogo</p><strong>${state.products.length}</strong></div></article><article class="stat"><span class="stat-icon peach">${icon("alert")}</span><div><p>Necesitan reposición</p><strong>${low().length}</strong><small>Por debajo del mínimo</small></div></article><article class="stat"><span class="stat-icon lavender">${icon("cart")}</span><div><p>Pedidos en curso</p><strong>${open.length}</strong><small>${state.cart.length} productos en el carrito</small></div></article><article class="stat"><span class="stat-icon sand">${icon("store")}</span><div><p>Valor estimado del stock</p><strong class="money-value">${money(value)}</strong><small>Lo que hay × el precio de compra de cada ficha</small></div></article></section>
 <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Un vistazo al inventario</h2><p>Por debajo del mínimo.</p></div><button class="text-button" data-nav="stock">Ver inventario ${icon("arrow")}</button></div>${productTable(low().slice(0, 5), true)}</section><div class="right-stack"><section class="panel inbox-preview"><div class="panel-heading"><h2>Tu bandeja de entrada</h2><span class="count-bubble">${important.length}</span></div>${
   important.length
     ? important
         .slice(0, 2)
         .map(
           (m) =>
             `<button class="message-preview" data-open-message="${m.id}"><div class="message-top"><span class="supplier-avatar ${supplier(m.supplier).color}">${esc(supplier(m.supplier).initials)}</span><div><strong>${esc(supplier(m.supplier).name)}</strong><small>${time(m.at)} · ${m.channel === "whatsapp" ? "WhatsApp" : "Demostración"}</small></div><i class="unread-dot"></i></div>${pill("Importante", "peach")}<p>${esc(m.text)}</p><span class="text-link">Revisar mensaje ${icon("arrow")}</span></button>`,
         )
         .join("")
     : '<div class="empty compact">Sin mensajes importantes pendientes.</div>'
 }<button class="full-link" data-nav="messages">Abrir mensajes ${icon("arrow")}</button></section></div></div>`
  );
}
function productTable(items, compact = false) {
  return items.length
    ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Disponible</th>${compact ? "" : "<th>Mín. / objetivo</th><th>Proveedor</th>"}<th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${items.map((p) => `<tr><td><div class="product-cell"><span class="product-icon ${p.category === "Gelatería" ? "sage" : p.category === "Cafetería" ? "sand" : p.category === "Postres" ? "rose" : "lavender"}">${icon(p.icon)}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.detail)}${compact ? "" : " · " + esc(zoneLabel[p.zone || "almacen"])}</small></div></div></td><td><strong>${num(p.stock)} <span class="unit">${p.unit}</span></strong>${pending(p.id) ? `<small class="incoming">+ ${num(pending(p.id))} en pedido</small>` : ""}</td>${compact ? "" : `<td>${num(p.min)} / ${num(p.target)} ${p.unit}</td><td>${esc(supplier(p.supplier).name)}</td>`}<td>${p.stock < p.min ? pill("Stock bajo", "peach") : pill("En orden", "sage")}${(alerts?.waste || []).some((w) => w.product === p.id && w.over) ? " " + pill("Merma por encima", "peach") : ""}</td><td>${compact ? `<button class="icon-button bordered" data-add="${p.id}" aria-label="Añadir ${esc(p.name)} al carrito">${icon("plus")}</button>` : `<div class="row-actions"><button class="text-button" data-count="${p.id}">Contar</button><button class="text-button" data-action="editProduct" data-product="${p.id}">Editar</button><button class="text-button" data-action="altSuppliers" data-product="${p.id}">Otros proveedores${p.alternates.length ? " · " + p.alternates.length : ""}</button><button class="text-button" data-action="setWasteGoal" data-product="${p.id}">${p.wasteGoal ? `Merma: ${num(p.wasteGoal.value)} ${p.wasteGoal.mode === "pct" ? "%" : p.unit}` : "Objetivo de merma"}</button></div>`}</td></tr>`).join("")}</tbody></table></div>`
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
      "",
      btn(icon("plus") + " Entrada / salida", "movement", "primary") +
        btn(icon("check") + " Hoja de conteo", "countSheet") +
        btn(icon("photo") + " Cargar foto", "photo") +
        btn(icon("plus") + " Nuevo producto", "product", "primary"),
    ) +
    `<section class="panel"><div class="toolbar"><div class="tabs">${["Todos", "Stock bajo", "Gelatería", "Cafetería", "Postres", "Envases"].map((f) => `<button data-filter="${f}" class="tab ${filter === f ? "selected" : ""}">${f}${f === "Stock bajo" ? ` <span>${low().length}</span>` : ""}</button>`).join("")}</div><label class="search">${icon("search")}<input id="search" placeholder="Buscar producto…" value="${esc(query)}" aria-label="Buscar producto"></label></div>${productTable(items)}<div class="table-footer">${items.length} productos</div></section>`
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
  const short = d.minimum?.below || [];
  const negative = state.products.filter((p) => p.stock < 0);
  if (
    !busy &&
    !d.toProduce.length &&
    !d.yesterdayPending &&
    !short.length &&
    !negative.length
  )
    return "";
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
    ? `<strong>El ${esc(dayName(d.yesterdayPending))} quedó sin confirmar</strong><span>Tiene producción o ventas apuntadas. </span><button class="text-button" data-action="openDay" data-date="${esc(d.yesterdayPending)}">Revisarlo ${icon("arrow")}</button>`
    : "";
  const minimum = short.length
    ? `<strong>Por debajo del mínimo en la pesada de hoy</strong><span>${esc(
        short
          .slice(0, 4)
          .map((b) => b.name + " (faltan " + num(b.missing) + " kg)")
          .join(", "),
      )}${short.length > 4 ? "…" : ""}. </span><button class="text-button" data-action="calOpenDay" data-date="${esc(d.date)}">Ver la ficha ${icon("arrow")}</button>`
    : "";
  const below = negative.length
    ? `<strong>Stock en negativo tras producir</strong><span>${esc(
        negative
          .slice(0, 4)
          .map((p) => p.name + " " + num(p.stock) + " " + p.unit)
          .join(", "),
      )}${negative.length > 4 ? "…" : ""}: la app tenía menos de lo que se usó. Cuéntalo para corregirlo. </span><button class="text-button" data-nav="stock">Ir a Inventario ${icon("arrow")}</button>`
    : "";
  return `${produce || pending || minimum || below ? `<div class="notice subtle home-notice">${icon("cake")}<div>${below}${minimum}${pending}${produce}</div></div>` : ""}${
    busy
      ? `<section class="stats" data-home-day><article class="stat"><span class="stat-icon sage">${icon("cake")}</span><div><p>Producido hoy</p><strong>${num(t.produced)} kg</strong><small>${esc(dayName(d.date))}${d.closed ? " · día cerrado" : ""}</small></div></article><article class="stat"><span class="stat-icon sand">${icon("store")}</span><div><p>Venta estimada de hoy</p><strong class="money-value">${cents(t.soldCents)}</strong><small>${t.soldCents === null ? "Falta escribir el valor de venta en el Recetario" : num(t.sold) + " kg × valor de venta"}</small></div></article><article class="stat"><span class="stat-icon peach">${icon("alert")}</span><div><p>Merma de hoy</p><strong>${num(t.waste)} kg</strong><small>${t.waste ? cents(t.wasteCents) + " de venta perdida" : "Sin merma apuntada"}</small></div></article><article class="stat"><span class="stat-icon lavender">${icon("box")}</span><div><p>Gelato que queda</p><strong>${num(t.remaining)} kg</strong><small>Para mañana</small></div></article></section>`
      : ""
  }`;
}
// Un hecho con su fórmula: merma de los últimos días, lo que salió y el objetivo escrito.
function wasteOverText(w) {
  const salida = num(w.out) + " " + w.unit + " que salieron";
  const share = w.pct === null ? "" : " (" + num(w.pct) + " %)";
  const objetivo = num(w.goal) + " " + (w.mode === "pct" ? "%" : w.unit);
  return (
    w.name +
    ": " +
    num(w.waste) +
    " " +
    w.unit +
    " de merma en " +
    w.days +
    " días sobre " +
    salida +
    share +
    "; tu objetivo es " +
    objetivo +
    "."
  );
}
function homeNotices() {
  const read = toRead().length,
    proposed = proposedProductions().length;
  const soon = state.orders.filter(
    (o) =>
      o.expected &&
      ["sent", "partial"].includes(o.status) &&
      // De hoy a dentro de dos días; una entrega ya vencida no es «prevista en los próximos días».
      (new Date(o.expected + "T12:00:00Z") - Date.now()) / 86400000 >= -0.5 &&
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
  const wasteOver = (alerts?.waste || []).filter((w) => w.over);
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
    !follow.length &&
    !wasteOver.length
  )
    return "";
  return `<div class="notice subtle home-notice">${icon("alert")}<div>${ships ? `<strong>Hoy ${ships.ships === 1 ? "hay 1 crucero" : "hay " + ships.ships + " cruceros"} en Palma · impacto potencial ${esc(ships.impactLabel.toLowerCase())}</strong><span>${esc(ships.names.slice(0, 4).join(", "))}${ships.names.length > 4 ? "…" : ""}. ${ships.passengers === null ? "Pasajeros declarados: no disponible" : num(ships.passengers) + " pasajeros declarados al puerto"}${ships.firstArrival ? ", primera llegada " + ships.firstArrival : ""}${ships.lastDeparture ? ", última salida " + ships.lastDeparture : ""}. </span><button class="text-button" data-nav="cruises">Ver cruceros ${icon("arrow")}</button>` : ""}${backupWarning ? `<strong>${esc(backupWarning)}</strong><span>Revisa las copias en <button class="text-link" data-nav="settings">Configuración</button>.</span>` : ""}${
    follow.length
      ? `<strong>Pedidos que necesitan seguimiento</strong><span>${esc(follow.map((f) => f.text).join(" "))} </span>${(() => {
          const waiting = follow.find((f) => f.kind === "unanswered");
          return waiting
            ? `<button class="text-button" data-action="orderNudge" data-order="${esc(waiting.order)}">Reclamar respuesta de ${esc(waiting.number)} ${icon("arrow")}</button>`
            : "";
        })()}<button class="text-button" data-nav="orders">Ver pedidos ${icon("arrow")}</button>`
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
  }${wasteOver.length ? `<strong>Merma por encima de tu objetivo: ${esc(wasteOver.map((w) => w.name).join(", "))}</strong><span>${esc(wasteOver.map(wasteOverText).join(" "))} </span><button class="text-button" data-nav="stock">Ver inventario ${icon("arrow")}</button>` : ""}${dueZones.length ? `<strong>Toca contar: ${esc(dueZones.map((z) => z.label + (z.ageDays === null ? " (nunca)" : " (hace " + z.ageDays + " días)")).join(", "))}</strong><span> </span><button class="text-button" data-action="countSheet">Abrir hoja de conteo ${icon("arrow")}</button>` : ""}${read ? `<strong>${read} mensaje${read === 1 ? "" : "s"} de proveedores que debes leer</strong><span>Faltas de producto, cambios, preguntas o retrasos. </span><button class="text-button" data-nav="messages" data-filter-messages="toread">Ver mensajes ${icon("arrow")}</button>` : ""}${proposed ? `<strong>${proposed} producción${proposed === 1 ? "" : "es"} por aprobar</strong><span>El stock no cambia hasta que la apruebes. </span><button class="text-button" data-nav="production">Ver producción ${icon("arrow")}</button>` : ""}${deliveries}</div></div>`;
}
function suppliers() {
  return (
    header(
      "Personas detrás de cada ingrediente.",
      "Tus proveedores y lo que les compras.",
      btn(icon("plus") + " Nuevo proveedor", "supplierEditor", "primary"),
    ) +
    `<div class="supplier-grid">${state.suppliers
      .map(
        (s) =>
          `<article class="panel supplier-card"><span class="supplier-avatar large ${s.color}">${esc(s.initials)}</span><h2>${esc(s.name)}</h2><p>${esc(s.category)}</p><div class="supplier-info">${icon("clock")} ${esc(s.delivery)}</div><div class="supplier-info">${icon("box")} ${((n) => `${n} ${n === 1 ? "producto" : "productos"} en catálogo`)(state.products.filter((p) => p.supplier === s.id).length)}</div>${s.web ? `<div class="supplier-info">${icon("store")} <a class="text-link" href="${esc(s.web)}" target="_blank" rel="noopener noreferrer">Web de compra</a></div>` : ""}${(() => {
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
          })()}<div class="supplier-card-footer">${btn("Qué le compras", "supplierCatalog", "secondary", `data-supplier="${s.id}"`)}${btn("Editar", "supplierEditor", "secondary", `data-supplier="${s.id}"`)}${btn("Simular mensaje", "message", "secondary", `data-supplier="${s.id}"`)}</div></article>`,
      )
      .join(
        "",
      )}</div><div class="notice">${icon("store")}<div><strong>Compra en webs como Makro</strong><span>Guarda la web en la ficha del proveedor: desde Compras copias su lista y abres la web. La compra la haces tú.</span></div></div>`
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
      "Ninguna corrección borra el registro original.",
      btn("Entrada / salida", "movement", "primary"),
    ) +
    `<section class="panel"><div class="panel-heading"><div><h2>Movimientos de inventario</h2><p>Mostrando ${Math.min(historyShown.movements, ledger.length)} de ${historyInfo?.movements ?? ledger.length} registrados</p></div>${pill("Guardado en este equipo", "sage")}</div>${
      ledger.length
        ? `<div class="table-wrap"><table><thead><tr><th>Producto y motivo</th><th>Tipo</th><th>Cambio</th><th>Antes → después</th><th>Acción</th></tr></thead><tbody>${ledger
            .slice(0, historyShown.movements)
            .map(
              (m) =>
                `<tr><td><strong>${esc(product(m.product).name)}</strong><small class="movement-reason">${esc(m.reason)} · ${date(m.at)} ${time(m.at)}</small></td><td>${pill(kinds[m.kind])}</td><td>${m.delta > 0 ? "+" : ""}${num(m.delta)} ${product(m.product).unit}</td><td>${num(m.before)} → ${num(m.after)}</td><td>${reversible(m) && !ledger.some((x) => x.reverses === m.id) ? btn("Revertir", "reverse", "secondary", `data-id="${m.id}"`) : pill(m.reverses ? "Compensación" : ledger.some((x) => x.reverses === m.id) ? "Revertido" : "Pedido")}</td></tr>`,
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
      "Datos, copias de seguridad y ajustes.",
    ) +
    `<div class="settings-grid"><section class="panel settings-card"><span class="stat-icon sage">${icon("shield")}</span><h2>Datos bajo tu control</h2><p>Todo se guarda en este equipo. Las copias incluyen fotos y documentos.</p><label class="path-label">CARPETA DE DATOS</label><code class="path">${esc(dataDir)}</code><div class="setting-actions">${btn(icon("download") + " Crear copia", "backup", "primary")}${btn("Exportar CSV", "exportCsv", "secondary")}${btn("Restaurar copia", "restore")}</div><p class="fineprint">Restaurar reemplaza los datos actuales; antes se guarda una copia.</p><p class="fineprint">Copia automática cada día (se guardan las 30 últimas).${backupInfo?.last ? "Última: " + date(backupInfo.last) + " " + time(backupInfo.last) + "." : "Todavía no se ha creado."}${backupInfo?.warning ? " " + esc(backupInfo.warning) : ""}</p><h3 class="setting-subtitle">Copia secundaria</h3>${backupInfo?.secondary?.dir ? `<code class="path">${esc(backupInfo.secondary.dir)}</code><p class="fineprint">${backupInfo.secondary.error ? esc(backupInfo.secondary.error) : backupInfo.secondary.last ? "Última copia allí: " + date(backupInfo.secondary.last) + " " + time(backupInfo.secondary.last) + "." : "Todavía no se ha copiado nada."}</p>` : '<p class="fineprint">Sin copia secundaria: si este disco falla se pierde todo. Elige una carpeta en otro disco o un USB.</p>'}<div class="setting-actions">${btn(backupInfo?.secondary?.dir ? "Cambiar carpeta" : "Elegir carpeta secundaria", "backupDirEditor", backupInfo?.secondary?.dir ? "secondary" : "primary")}${backupInfo?.secondary?.dir ? btn("Quitar", "backupDirClear", "secondary") : ""}</div></section><section class="panel settings-card"><span class="stat-icon lavender">${icon("leaf")}</span><h2>Ayudante</h2>${pill("Incluido en el equipo", "sage")}<p>Lee textos de proveedores y propone qué son, sin salir de este equipo. Solo propone: no ejecuta acciones.</p>${btn("Abrir el Ayudante", "aiOpen", "primary")}</section><section class="panel settings-card"><h2>Archivo de fotos y documentos</h2><p>Fotos y PDF por proveedor y fecha. Se vinculan a pedidos en Documentos.</p>${btn("Abrir Documentos", "openDocuments", "secondary")}${archiveWarning ? `<p role="alert">${esc(archiveWarning)}</p>` : ""}<code class="path">${esc(dataDir)} / proveedores</code>${btn(icon("photo") + " Cargar foto", "photo")}<div class="photo-grid">${
      state.photos
        .filter((ph) => !ph.calendarDate)
        .sort(
          (a, b) =>
            (a.supplier || "").localeCompare(b.supplier || "") ||
            (b.documentDate || b.at).localeCompare(a.documentDate || a.at),
        )
        .map(
          (ph) =>
            `<figure><img src="${esc(ph.data || "/api/photos/" + ph.id)}" alt="${esc(ph.name)}"><figcaption><strong>${esc(ph.supplier ? supplier(ph.supplier).name : "Sin proveedor")}</strong><small>${esc(ph.documentDate || ph.at.slice(0, 10))}${ph.docType ? " · " + esc(aiTypes[ph.docType] || ph.docType).replace("Posible ", "") : ""}</small>${esc(ph.name)}<small>${esc(ph.note)}</small><div class="row-actions">${btn("Organizar", "organizePhoto", "secondary", `data-id="${ph.id}"`)}${ph.ocrText ? btn("Revisar texto con el Ayudante", "aiPhoto", "secondary", `data-id="${ph.id}"`) : ""}</div></figcaption></figure>`,
        )
        .join("") || '<p class="muted">Todavía no hay fotos guardadas.</p>'
    }</div></section><section class="panel settings-card"><span class="stat-icon sage">${icon("shield")}</span><h2>Recetario protegido</h2>${lockInfo?.enabled ? `<p>Las recetas piden contraseña. Estado: <strong>${lockInfo.unlocked ? "desbloqueado (30 min)" : "bloqueado"}</strong>.</p><div class="setting-actions">${btn("Bloquear ahora", "lockNow", "secondary")}${btn("Cambiar contraseña", "lockChange", "secondary")}${btn("Quitar contraseña", "lockRemove", "danger")}</div>` : `<p>Sin contraseña: cualquiera con la app abierta puede crear, editar o borrar recetas.</p>${btn("Poner contraseña", "lockSet", "primary")}`}<p class="fineprint">Protege el Recetario (crear, editar y borrar recetas, precios y costes). Producir sigue abierto para el equipo. No cifra el disco.</p></section><section class="panel settings-card"><h2>Limpieza periódica</h2><p>Borra la actividad y las conversaciones de WhatsApp más antiguas que el plazo (siempre quedan las 50 últimas). El stock y las copias no se tocan.</p><label class="field">Conservar<select id="retention-days">${[
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
      )}</select></label><div class="setting-actions">${btn("Limpiar ahora", "purgeNow", "secondary", retentionDays ? "" : "disabled")}</div><h3 class="setting-subtitle">Día de negocio</h3><p class="fineprint">Si cierras de madrugada: lo que apuntes antes de esta hora cuenta para el día anterior.</p><label class="field short">El día cambia a las<select id="day-change-hour">${[
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]
      .map(
        (h) =>
          `<option value="${h}" ${dayChangeHour === h ? "selected" : ""}>${h}:00${h === 0 ? " (medianoche)" : ""}</option>`,
      )
      .join(
        "",
      )}</select></label><h3 class="setting-subtitle">Recordatorio de conteo</h3><p class="fineprint">El Resumen avisa cuando una zona lleva más días sin contar.</p><label class="field">Contar cada<select id="count-days">${[
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
      )}</select></label></section><section class="panel settings-card"><h2>Cruceros en Palma</h2><p>La app lee por internet la previsión de escalas de la Autoridad Portuaria de Baleares. Solo lee: no envía ningún dato tuyo.</p><label class="check-row"><input type="checkbox" id="cruises-enabled" ${cruiseInfo?.enabled === false ? "" : "checked"}> Consultar los cruceros del puerto</label><div class="setting-actions">${btn("Umbrales del impacto", "cruiseThresholds", "secondary", cruiseInfo?.enabled === false ? "disabled" : "")}${btn("Restaurar copia del registro", "cruiseRestore", "secondary")}</div><p class="fineprint">${cruiseInfo?.updatedAt ? "Última actualización: " + date(cruiseInfo.updatedAt) + " " + time(cruiseInfo.updatedAt) + "." : "Todavía sin datos."}</p></section><section class="panel settings-card"><h2>Lo que la app ha aprendido de tus correcciones</h2><p>Cuando corriges la lectura de un mensaje, la app la recuerda para mensajes casi iguales. Aquí puedes olvidarlas.</p>${
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
    }</section><section class="panel settings-card"><h2>Plantilla del pedido</h2><p>El texto que se envía por WhatsApp. {lineas}, {numero}, {negocio} y {proveedor} se rellenan solos.</p><pre class="template-preview">${esc(orderTemplate)}</pre><div class="setting-actions">${btn("Editar plantilla", "orderTemplateEditor", "secondary")}</div></section><section class="panel settings-card"><h2>Plantilla del recordatorio</h2><p>El texto de «Reclamar respuesta». Puedes cambiarlo antes de cada envío; {numero} y {dias} se rellenan solos.</p><pre class="template-preview">${esc(nudgeTemplate)}</pre><div class="setting-actions">${btn("Editar plantilla", "nudgeTemplateEditor", "secondary")}</div></section><section class="panel settings-card"><h2>Respuestas rápidas</h2><p>Los botones para responder un mensaje de un toque.</p><p>${Object.keys(replyTemplates).length ? `${Object.keys(replyTemplates).length} con tu texto; el resto, el de origen.` : "Todas con el texto de origen."}</p><div class="setting-actions">${btn("Editar respuestas", "replyTemplatesEditor", "secondary")}</div></section><section class="panel settings-card"><h2>Aviso de mensajes nuevos</h2><p>Cuando un proveedor escribe por WhatsApp, aparece un recuadro con lo que dice y Windows te avisa.</p><label class="check-row"><input type="checkbox" id="message-notices" ${messageNotices ? "checked" : ""}> Avisar en cuanto llegue un mensaje</label><p class="fineprint">Sin aviso, los mensajes entran igual en Mensajes.</p></section><section class="panel settings-card"><h2>Identidad del negocio</h2><p>El nombre y el lugar salen en la app y en los mensajes de pedido.</p><p><strong>${esc(state.business)}</strong>${state.place ? " · " + esc(state.place) : ""}</p>${btn("Editar identidad", "businessEditor", "secondary")}</section><section class="panel settings-card"><h2>Primeros pasos</h2><ol class="steps"><li><strong>Inventario</strong>: revisa productos y mínimos y cuenta el stock real.</li><li><strong>Proveedores</strong>: completa su WhatsApp con prefijo (+34…).</li><li><strong>Producción</strong>: crea tus recetas; cada día apunta lo producido, las ventas y las mermas.</li><li><strong>Compras</strong>: prepara la reposición, autoriza y envía por WhatsApp; registra lo que llega.</li><li><strong>WhatsApp</strong>: conecta por QR y autoriza los chats de tus proveedores.</li><li><strong>Mensajes</strong>: mira «Debes leer»; lo demás queda anotado.</li><li><strong>Copias</strong>: se hacen solas cada día.</li></ol></section><section class="panel settings-card"><h2>Sobre esta versión</h2><p>ArtelloAPP · versión ${esc(appVersion)}</p><p>Un pedido solo se envía por WhatsApp cuando tú lo confirmas. Esta instalación no sincroniza con otros equipos.</p></section></div>`
  );
}
