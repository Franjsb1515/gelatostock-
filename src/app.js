let state,
  dataDir,
  page = "home",
  filter = "Todos",
  query = "",
  selectedMessage = null,
  busy = false,
  messageQuery = "",
  messageSupplier = "all",
  messageFilter = "all";
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    n / 100,
  );
const num = (n) =>
  new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(n);
const date = (v) =>
  new Date(v).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const time = (v) =>
  new Date(v).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4Z M3 7l9 4 9-4 M12 11v10 M7 5l10 4"/>',
  cart: '<path d="M3 3h2l3 13h11l2-9H6 M10 21h.01 M18 21h.01"/>',
  message:
    '<path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z M7 10h10 M7 14h6"/>',
  store: '<path d="M3 10h18l-2-6H5Z M4 10v11h16V10 M9 21v-7h6v7"/>',
  settings: '<path d="M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M5 12h14 m-5-5 5 5-5 5"/>',
  plus: '<path d="M12 5v14 M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  bell: '<path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4Z M10 21h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  coffee:
    '<path d="M4 9h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z M16 10h2a3 3 0 0 1 0 6h-2 M7 3v3 M12 3v3"/>',
  milk: '<path d="M8 3h8v4l2 3v11H6V10l2-3Z M8 7h8 M6 11h12"/>',
  ice: '<path d="m7 13 5 9 5-9Z M5 13h14a4 4 0 0 0-2-7 5 5 0 0 0-10 0 4 4 0 0 0-2 7Z"/>',
  cup: '<path d="M5 7h14l-2 14H7Z M4 7V4h16v3 M8 12h8"/>',
  cake: '<path d="M3 11h18v10H3Z M3 16c3-4 6 4 9 0s6 4 9 0 M7 11V7 M12 11V5 M17 11V7"/>',
  photo:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  shield: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z m-4 9 3 3 5-6"/>',
  close: '<path d="m6 6 12 12 M6 18 18 6"/>',
  alert: '<path d="m12 3 10 18H2Z M12 9v5 M12 17h.01"/>',
  download: '<path d="M12 3v12 m-5-5 5 5 5-5 M4 17v4h16v-4"/>',
  leaf: '<path d="M20 3C5 1 1 12 7 18s17 1 13-15Z M5 21 16 9"/>',
};
const icon = (name) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.box}</svg>`;
const btn = (label, action, cls = "secondary", extra = "") =>
  `<button class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;
const supplier = (id) => state.suppliers.find((s) => s.id === id);
const product = (id) => state.products.find((p) => p.id === id);
const pending = (id) =>
  state.orders
    .filter((o) => !["received", "cancelled"].includes(o.status))
    .reduce(
      (n, o) =>
        n +
        o.lines
          .filter((l) => l.product === id)
          .reduce((a, l) => a + l.packs * l.pack - l.received, 0),
      0,
    );
const needed = (p) =>
  Math.max(
    0,
    Math.ceil(
      Math.round((p.target - p.stock - pending(p.id)) * 1000) / 1000 / p.pack,
    ),
  );
const low = () => state.products.filter((p) => p.stock < p.min);
const pill = (label, color = "neutral") =>
  `<span class="pill ${color}">${esc(label)}</span>`;
const statusLabel = {
  pending: "Pendiente de envío",
  sent: "Envío simulado",
  partial: "Recepción parcial",
  received: "Recibido",
  cancelled: "Cancelado",
};
const relevanceLabel = {
  relevant: "Relacionado con un pedido",
  informational: "Información general",
  irrelevant: "No relevante",
  review: "Relevancia por revisar",
};
const priorityLabel = {
  important: "Importante",
  normal: "Informativo",
  low: "Promoción",
  review: "Por revisar",
};
async function request(url, body) {
  const r = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const error = Error(data.error || "No se pudo guardar.");
    error.status = r.status;
    throw error;
  }
  return data;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => $("#toast").classList.remove("show"),
    5000,
  );
}
async function mutate(a, msg) {
  if (busy) return false;
  busy = true;
  try {
    const data = await request("/api/action", {
      revision: state.revision,
      operationId: crypto.randomUUID(),
      ...a,
    });
    state = data.state;
    dataDir = data.dataDir;
    render();
    if (msg) toast(msg);
    return true;
  } catch (e) {
    if (e.status === 409) {
      try {
        const fresh = await request("/api/state");
        state = fresh.state;
        render();
      } catch {}
    }
    if ($("#modal").open && $("#form-error"))
      $("#form-error").textContent = e.message;
    else toast(e.message);
    return false;
  } finally {
    busy = false;
  }
}
function nav(to) {
  page = to;
  query = "";
  filter = "Todos";
  render();
}
function header(title, description, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">TU NEGOCIO, EN ORDEN</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function render() {
  const unread = state.messages.filter((m) => !m.read).length;
  const views = {
    home,
    stock,
    orders,
    messages,
    suppliers,
    activity,
    settings,
  };
  $("#app").innerHTML =
    `<aside class="sidebar"><a href="#" class="brand" data-nav="home"><span class="brandmark">${icon("ice")}</span><span>gelato<span class="brand-light">stock</span><small>EL ESPACIO DE TU NEGOCIO</small></span></a><div class="workspace"><div class="workspace-icon">G</div><div><strong>Gelato & Café</strong><small>Espacio de demostración</small></div></div><div class="nav-label">MI NEGOCIO</div><nav>${[
      ["home", "home", "Resumen"],
      ["stock", "box", "Inventario"],
      ["orders", "cart", "Compras"],
      ["messages", "message", "Mensajes"],
      ["suppliers", "store", "Proveedores"],
      ["activity", "clock", "Actividad"],
    ]
      .map(
        ([id, i, label]) =>
          `<button data-nav="${id}" class="nav-item ${page === id ? "active" : ""}">${icon(i)}<span>${label}</span>${id === "messages" && unread ? `<b class="nav-count">${unread}</b>` : ""}${id === "orders" && state.cart.length ? `<b class="nav-count">${state.cart.length}</b>` : ""}</button>`,
      )
      .join(
        "",
      )}</nav><div class="sidebar-bottom"><div class="local-card">${icon("shield")}<strong>Tu información se queda aquí</strong><p>Datos guardados en este equipo. Sin depender de internet.</p><span><i class="dot"></i> Almacenamiento local</span></div><button data-nav="settings" class="nav-item ${page === "settings" ? "active" : ""}">${icon("settings")}<span>Configuración</span></button><div class="profile"><span class="avatar">GC</span><div><strong>Mi negocio</strong><small>Prototipo · v0.3.0</small></div></div></div></aside><main><header class="topbar"><div class="breadcrumb">Mi negocio <span>/</span> ${{ home: "Resumen", stock: "Inventario", orders: "Compras", messages: "Mensajes", suppliers: "Proveedores", activity: "Actividad", settings: "Configuración" }[page]}</div><div class="top-right"><span class="local-status"><i class="dot"></i> Modo local</span><button class="icon-button" aria-label="Ver mensajes" data-nav="messages">${icon("bell")}${unread ? '<i class="notification-dot"></i>' : ""}</button><span class="avatar small">GC</span></div></header><div class="content">${views[page]()}</div><footer>Hecho para el ritmo de tu negocio.<span>Demostración · no envía pedidos reales</span></footer></main>`;
}
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
    `<section class="hero"><div class="hero-copy"><span class="hero-label"><i class="dot"></i> TU RESUMEN DE HOY</span><h2>Más tiempo para crear.<br>Menos para contar.</h2><p>${low().length ? `Hay ${low().length} productos por debajo del mínimo.<br>Prepará la reposición y seguí con tu día.` : "Tu inventario está por encima de los mínimos.<br>Todo listo para seguir con tu día."}</p>${btn("Preparar reposición " + icon("arrow"), "suggest", "cream")}</div><div class="hero-art" aria-hidden="true"><span class="art-orbit"></span><span class="art-dot"></span><div class="scoop scoop-one"></div><div class="scoop scoop-two"></div><div class="scoop scoop-three"></div><div class="gelato-cup"><span>g.</span></div><span class="art-caption">un poco de orden,<br>mucho gelato.</span></div></section>
 <section class="stats"><article class="stat"><span class="stat-icon sage">${icon("box")}</span><div><p>Productos en catálogo</p><strong>${state.products.length}</strong><small>Todo tu inventario</small></div></article><article class="stat"><span class="stat-icon peach">${icon("alert")}</span><div><p>Necesitan reposición</p><strong>${low().length}</strong><small>Por debajo del mínimo</small></div></article><article class="stat"><span class="stat-icon lavender">${icon("cart")}</span><div><p>Pedidos en curso</p><strong>${open.length}</strong><small>${state.cart.length} productos en el carrito</small></div></article><article class="stat"><span class="stat-icon sand">${icon("store")}</span><div><p>Valor estimado del stock</p><strong class="money-value">${money(value)}</strong><small>Precios de demostración</small></div></article></section>
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
    }<div class="panel-bottom">${btn(icon("plus") + " Añadir producto", "addcart")}</div></section><aside class="panel order-summary"><h2>Resumen del carrito</h2><div class="summary-row"><span>Productos</span><strong>${money(total)}</strong></div><div class="summary-row"><span>Envío e impuestos</span><span>Por confirmar</span></div><div class="summary-total"><span>Total estimado</span><strong>${money(total)}</strong></div><p>Los precios son ficticios. Se creará un pedido independiente por proveedor.</p>${btn("Revisar y autorizar " + icon("arrow"), "checkout", "primary full", state.cart.length ? "" : "disabled")}<small>Se guardará como pendiente de envío.</small></aside></div><section class="panel orders-panel"><div class="panel-heading"><div><h2>Seguimiento de pedidos</h2><p>Lo enviado y lo recibido, siempre separados.</p></div></div>${state.orders.length ? state.orders.map((o) => `<article class="order-row"><div><span class="order-number">${esc(o.number)}</span><h3>${esc(supplier(o.supplier).name)}</h3><small>${date(o.at)} · ${o.lines.length} productos · ${money(o.lines.reduce((n, l) => n + l.packs * l.price, 0))}</small></div><div class="order-status">${pill(statusLabel[o.status], o.status === "received" ? "sage" : o.status === "pending" ? "sand" : "lavender")}<small>Demostración</small></div><div>${o.status === "pending" ? btn("Simular envío", "send", "secondary", `data-order="${o.id}"`) + btn("Cancelar", "cancelOrder", "secondary", `data-order="${o.id}"`) : !["received", "cancelled"].includes(o.status) ? btn("Registrar recepción", "receive", "secondary", `data-order="${o.id}"`) : '<span class="received-check">' + icon("check") + (o.status === "cancelled" ? " Cancelado" : " Completado") + "</span>"}</div></article>`).join("") : '<div class="empty compact">Tus pedidos aparecerán aquí cuando autorices un carrito.</div>'}</section>`
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
        (messageFilter === "relevant" && x.relevance === "relevant")) &&
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
    `<div class="notice subtle">${icon("message")}<div><strong>Recepción por eventos · demostración local</strong><span>Clasificación por reglas sencillas. WhatsApp e IA todavía no están conectados.</span></div></div><div class="message-filters"><label class="field">Buscar mensajes<input id="message-search" type="search" value="${esc(messageQuery)}" placeholder="Texto o proveedor"></label><label class="field">Proveedor<select id="message-supplier"><option value="all">Todos los proveedores</option>${state.suppliers.map((s) => `<option value="${s.id}" ${messageSupplier === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label><label class="field">Mostrar<select id="message-filter">${Object.entries(
      {
        all: "Todos los mensajes",
        unread: "Sin leer",
        pending: "Sin revisar",
        important: "Importantes pendientes",
        relevant: "Relacionados con pedidos",
      },
    )
      .map(
        ([v, l]) =>
          `<option value="${v}" ${messageFilter === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label></div><section class="inbox-layout"><div class="conversation-list"><div class="conversation-heading">Bandeja de proveedores <span>${list.length} de ${state.messages.length}</span></div>${list.map((x) => `<button class="conversation ${m?.id === x.id ? "selected" : ""}" data-open-message="${x.id}"><span class="supplier-avatar ${supplier(x.supplier).color}">${esc(supplier(x.supplier).initials)}</span><div><div class="conversation-title"><strong>${esc(supplier(x.supplier).name)}</strong><small>${time(x.at)}</small></div><p>${esc(x.text)}</p><span class="mini-status">${x.reviewed ? "Revisado" : priorityLabel[x.priority]} · ${relevanceLabel[x.relevance]}</span></div>${!x.read ? '<i class="unread-dot"></i>' : ""}</button>`).join("")}</div><div class="message-detail">${m ? `<div class="detail-heading"><span class="supplier-avatar ${supplier(m.supplier).color}">${esc(supplier(m.supplier).initials)}</span><div><h2>${esc(supplier(m.supplier).name)}</h2><p>Mensaje de demostración · ${date(m.at)}, ${time(m.at)}</p></div>${pill(m.reviewed ? "Revisado" : priorityLabel[m.priority], m.reviewed ? "sage" : m.priority === "important" ? "peach" : "lavender")}</div><div class="message-body"><div class="message-label">MENSAJE ORIGINAL</div><div class="message-bubble">${esc(m.text)}</div><div class="interpretation"><div class="message-label">${icon("leaf")} LECTURA ASISTIDA POR REGLAS</div><h3>${esc(priorityLabel[m.priority])}</h3><p>${esc(m.reason)}</p><h3>${esc(relevanceLabel[m.relevance])}</h3><p>${esc(m.relevanceReason)}</p><div class="muted">${m.order ? "Vinculado a " + esc(state.orders.find((o) => o.id === m.order)?.number) : "Sin pedido vinculado. No se han modificado compras ni stock."}</div></div><div class="message-actions">${btn(m.reviewed ? "Mensaje revisado" : icon("check") + " Marcar revisado", "review", "primary", `data-id="${m.id}" ${m.reviewed ? "disabled" : ""}`)}${btn("Cambiar prioridad", "priority", "secondary", `data-id="${m.id}"`)}${btn("Corregir relevancia", "relevance", "secondary", `data-id="${m.id}"`)}${btn("Vincular pedido", "link", "secondary", `data-id="${m.id}"`)}</div><p class="fineprint">Revisar un mensaje no acepta sobrecostes ni sustituciones. La conexión real se añadirá en una siguiente etapa.</p></div>` : '<div class="empty">No hay mensajes que coincidan con estos filtros.</div>'}</div></section>`
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
    `<div class="settings-grid"><section class="panel settings-card"><span class="stat-icon sage">${icon("shield")}</span><h2>Datos bajo tu control</h2><p>SQLite guarda las operaciones de forma consistente. Las fotos se almacenan por separado y se incluyen en las copias.</p><label class="path-label">CARPETA DE DATOS</label><code class="path">${esc(dataDir)}</code><div class="setting-actions">${btn(icon("download") + " Crear copia", "backup", "primary")}${btn("Restaurar copia", "restore")}</div><p class="fineprint">Restaurar reemplaza los datos actuales. Se conserva una copia previa automáticamente.</p></section><section class="panel settings-card"><span class="stat-icon lavender">${icon("leaf")}</span><h2>Inteligencia integrada</h2>${pill("Pendiente de implementación", "sand")}<p>Este prototipo interpreta mensajes mediante reglas locales. No incluye un modelo de IA ni reconocimiento automático de fotos.</p><ul class="feature-list"><li>${icon("check")} Sin API de IA ni consumo de pago</li><li>${icon("check")} Inventario operativo sin internet</li><li>${icon("clock")} OCR y modelo local en una próxima etapa</li></ul></section><section class="panel settings-card"><h2>Archivo de fotos</h2><p>Guardá una referencia visual y cargá sus cantidades manualmente.</p>${btn(icon("photo") + " Cargar foto", "photo")}<div class="photo-grid">${state.photos.map((ph) => `<figure><img src="${esc(ph.data || "/api/photos/" + ph.id)}" alt="${esc(ph.name)}"><figcaption>${esc(ph.name)}<small>${esc(ph.note)}</small></figcaption></figure>`).join("") || '<p class="muted">Todavía no hay fotos guardadas.</p>'}</div></section><section class="panel settings-card"><h2>Sobre este prototipo</h2><p>GelatoStock · versión 0.3.0</p><p>Datos de ejemplo persistentes. Compras y mensajes simulados. Los módulos futuros se detallan en los documentos de la carpeta del proyecto.</p><div class="notice inline">${icon("box")}<span>Esta instalación es independiente. Todavía no sincroniza con otros equipos.</span></div></section></div>`
  );
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
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
    "Indicá cuánto hay ahora. Reemplaza el stock contado; no suma una entrada.",
    select(
      "Producto",
      "product",
      state.products.map((p) => [p.id, `${p.name} (${p.unit})`]),
      p.id,
    ) +
      field(
        "Cantidad disponible · unidad base",
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
    $("#modal-form input[name=value]").value = product(e.target.value).stock;
  });
}
function photo() {
  modal(
    "Cargar una foto",
    "Archivo local de referencia. En esta versión las cantidades se cargan manualmente.",
    `<label class="upload-zone">${icon("photo")}<strong>Elegí una foto de tu equipo</strong><span>JPG, PNG o WebP · hasta 5 MB</span><input name="photo" type="file" accept="image/png,image/jpeg,image/webp" required></label><div id="photo-preview"></div><label class="field">Nota<textarea name="note" placeholder="Por ejemplo: albarán de leche, revisar cantidades"></textarea></label><div class="notice inline">${icon("alert")}<span>No se ejecutará OCR ni se modificará stock automáticamente.</span></div>`,
    async (f) => {
      const file = f.get("photo");
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 5000000
      )
        throw Error("Usá JPG, PNG o WebP de hasta 5 MB.");
      const data = await readFile(file);
      return mutate(
        { type: "photo", name: file.name, data, note: f.get("note") },
        "Foto guardada. Podés verla en Configuración.",
      );
    },
    "Guardar foto",
  );
  $("#modal-form input[type=file]").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (
      file &&
      file.size <= 5000000 &&
      ["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      $("#photo-preview").innerHTML =
        `<img class="photo-preview" src="${esc(await readFile(file))}" alt="Vista previa de la foto">`;
  });
}
const readFile = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(Error("No se pudo leer el archivo."));
    r.readAsDataURL(file);
  });
async function action(name, el) {
  if (await extendedAction(name, el)) return;
  if (name === "close") {
    $("#modal").close();
    return;
  }
  if (name === "count") {
    count();
    return;
  }
  if (name === "photo") {
    photo();
    return;
  }
  if (name === "suggest") {
    if (await mutate({ type: "suggest" }, "Reposición añadida al carrito."))
      nav("orders");
    return;
  }
  if (name === "addcart") {
    modal(
      "Añadir al carrito",
      "Elegí el producto y la cantidad de paquetes.",
      select(
        "Producto",
        "product",
        state.products.map((p) => [
          p.id,
          `${p.name} · ${p.pack} ${p.unit}/paquete`,
        ]),
      ) +
        field(
          "Paquetes",
          "packs",
          1,
          "number",
          'min="1" max="10000" step="1" required',
        ),
      async (f) =>
        mutate(
          {
            type: "cart",
            product: f.get("product"),
            packs: Number(f.get("packs")),
          },
          "Carrito actualizado.",
        ),
    );
    return;
  }
  if (name === "product") {
    modal(
      "Nuevo producto",
      "Definí su unidad base y cómo lo comprás.",
      `<div class="form-grid">${field("Nombre", "name", "", "text", 'required maxlength="100"')}${field("Presentación / detalle", "detail", "", "text", 'maxlength="200"')}${select(
        "Categoría",
        "category",
        ["Gelatería", "Cafetería", "Postres", "Envases"].map((x) => [x, x]),
      )}${select("Unidad base", "unit", [
        ["kg", "Kilogramos"],
        ["L", "Litros"],
        ["ud", "Unidades"],
      ])}${field("Stock actual", "stock", 0, "number", 'min="0" max="1000000" step="0.001" required')}${field("Stock mínimo", "min", 0, "number", 'min="0" max="1000000" step="0.001" required')}${field("Stock objetivo", "target", 1, "number", 'min="0" max="1000000" step="0.001" required')}${field("Unidades base por paquete", "pack", 1, "number", 'min="0.001" max="1000000" step="0.001" required')}${field("Precio estimado por paquete (€)", "price", 0, "number", 'min="0" max="1000000" step="0.01" required')}${select(
        "Proveedor de demostración",
        "supplier",
        state.suppliers.map((s) => [s.id, s.name]),
      )}</div>`,
      async (f) => {
        const a = Object.fromEntries(f);
        for (const k of ["stock", "min", "target", "pack"]) a[k] = Number(a[k]);
        a.price = Math.round(Number(a.price) * 100);
        return mutate({ type: "product", ...a }, "Producto creado.");
      },
    );
    return;
  }
  if (name === "checkout") {
    const revision = state.revision;
    modal(
      "Autorizar pedidos de demostración",
      "No se enviará ningún mensaje ni se realizará ningún pago.",
      `<p>Se crearán ${new Set(state.cart.map((l) => product(l.product).supplier)).size} pedidos pendientes de envío.</p><div class="review-total">Total estimado <strong>${money(state.cart.reduce((n, l) => n + l.packs * product(l.product).price, 0))}</strong></div><p class="fineprint">Envío e impuestos por confirmar. En el siguiente paso podrás simular el envío.</p>`,
      async () =>
        mutate(
          { type: "authorize", revision },
          "Pedidos de demostración creados.",
        ),
      "Autorizar demostración",
    );
    return;
  }
  if (name === "send") {
    await mutate(
      { type: "send", order: el.dataset.order },
      "Envío simulado. No se contactó al proveedor.",
    );
    return;
  }
  if (name === "receive") {
    const o = state.orders.find((o) => o.id === el.dataset.order);
    modal(
      "Registrar recepción · " + o.number,
      "Ingresá solo lo que llegó en esta entrega. El resto quedará pendiente.",
      o.lines
        .map((l) => {
          const p = product(l.product);
          const rem = Math.round((l.packs * l.pack - l.received) * 1000) / 1000;
          return field(
            `${p.name} · quedan ${num(rem)} ${p.unit}`,
            l.product,
            0,
            "number",
            `min="0" max="${rem}" step="0.001" required`,
          );
        })
        .join(""),
      async (f) =>
        mutate(
          {
            type: "receive",
            order: o.id,
            lines: [...f].map(([product, value]) => ({
              product,
              value: Number(value),
            })),
          },
          "Recepción guardada y stock actualizado.",
        ),
    );
    return;
  }
  if (name === "message") {
    modal(
      "Simular un mensaje entrante",
      "Probá la bandeja y los avisos. Este evento se genera únicamente en el equipo.",
      select(
        "Proveedor",
        "supplier",
        state.suppliers.map((s) => [s.id, s.name]),
        el.dataset.supplier,
      ) +
        `<label class="field">Mensaje del proveedor<textarea name="text" maxlength="5000" required>Hola, solo quedan dos cajas. La entrega del resto será mañana.</textarea></label><p class="fineprint">Las reglas detectan expresiones como «sin stock», «entrega» o «promoción». No hay IA conectada.</p>`,
      async (f) => {
        const ok = await mutate(
          { type: "message", supplier: f.get("supplier"), text: f.get("text") },
          "Nuevo mensaje de demostración recibido.",
        );
        if (ok) {
          messageQuery = "";
          messageSupplier = "all";
          messageFilter = "all";
          selectedMessage = state.messages[0].id;
          nav("messages");
        }
        return ok;
      },
      "Recibir mensaje de prueba",
    );
    return;
  }
  if (name === "review") {
    await mutate({ type: "review", id: el.dataset.id }, "Mensaje revisado.");
    return;
  }
  if (name === "priority") {
    const m = state.messages.find((m) => m.id === el.dataset.id);
    modal(
      "Cambiar prioridad",
      "Tu corrección queda registrada.",
      select(
        "Prioridad",
        "priority",
        Object.entries(priorityLabel),
        m.priority,
      ),
      async (f) =>
        mutate(
          { type: "priority", id: m.id, priority: f.get("priority") },
          "Prioridad actualizada.",
        ),
    );
    return;
  }
  if (name === "relevance") {
    const m = state.messages.find((m) => m.id === el.dataset.id);
    modal(
      "Corregir relevancia",
      "La prioridad y el texto original se conservan.",
      select(
        "Relevancia",
        "relevance",
        Object.entries(relevanceLabel),
        m.relevance,
      ) +
        '<label class="field">Motivo de la clasificación<textarea name="reason" maxlength="500" required></textarea></label>',
      async (f) =>
        mutate(
          {
            type: "relevance",
            id: m.id,
            relevance: f.get("relevance"),
            reason: f.get("reason"),
          },
          "Relevancia actualizada.",
        ),
    );
    return;
  }
  if (name === "link") {
    const m = state.messages.find((m) => m.id === el.dataset.id);
    const list = state.orders.filter((o) => o.supplier === m.supplier);
    if (!list.length) {
      toast("Todavía no hay pedidos de este proveedor para vincular.");
      return;
    }
    modal(
      "Vincular a un pedido",
      "Solo se muestran pedidos del mismo proveedor.",
      select(
        "Pedido",
        "order",
        list.map((o) => [o.id, o.number]),
      ),
      async (f) =>
        mutate(
          { type: "link", id: m.id, order: f.get("order") },
          "Mensaje vinculado.",
        ),
    );
    return;
  }
  if (name === "backup") {
    try {
      const r = await request("/api/backup", {});
      modal(
        "Copia de seguridad creada",
        "Incluye los datos y las fotos guardadas.",
        `<code class="path">${esc(r.path)}</code>`,
        async () => true,
        "Listo",
      );
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (name === "restore") {
    modal(
      "Restaurar una copia",
      "Reemplaza los datos de demostración actuales. Guardaremos una copia previa.",
      `<label class="field">Archivo de copia (.json)<input type="file" name="backup" accept=".json,application/json" required></label><label class="check-label"><input type="checkbox" required> Entiendo que se reemplazarán los datos actuales.</label>`,
      async (f) => {
        const file = f.get("backup");
        if (file.size > 100000000) throw Error("La copia supera 100 MB.");
        const data = JSON.parse(await file.text());
        const r = await request("/api/restore", {
          backup: data,
          revision: state.revision,
        });
        state = r.state;
        render();
        toast("Copia restaurada.");
      },
      "Restaurar datos",
    );
    return;
  }
}
document.addEventListener("click", async (e) => {
  const el = e.target.closest("button,a");
  if (!el) return;
  if (el.dataset.nav) {
    e.preventDefault();
    nav(el.dataset.nav);
  } else if (el.dataset.action) {
    await action(el.dataset.action, el);
  } else if (el.dataset.filter) {
    filter = el.dataset.filter;
    render();
  } else if (el.dataset.count) {
    count(el.dataset.count);
  } else if (el.dataset.add) {
    const p = product(el.dataset.add);
    await mutate(
      { type: "cart", product: p.id, packs: Math.max(1, needed(p)) },
      "Producto añadido al carrito.",
    );
  } else if (el.dataset.remove) {
    await mutate(
      { type: "cart", product: el.dataset.remove, packs: 0 },
      "Producto retirado.",
    );
  } else if (el.dataset.openMessage) {
    selectedMessage = el.dataset.openMessage;
    page = "messages";
    await mutate({ type: "read", id: selectedMessage });
  }
});
document.addEventListener("change", async (e) => {
  if (["message-supplier", "message-filter"].includes(e.target.id)) {
    const id = e.target.id;
    if (id === "message-supplier") messageSupplier = e.target.value;
    else messageFilter = e.target.value;
    selectedMessage = null;
    render();
    document.getElementById(id).focus();
    return;
  }
  if (e.target.dataset.cart)
    await mutate(
      {
        type: "cart",
        product: e.target.dataset.cart,
        packs: Number(e.target.value),
      },
      "Cantidad actualizada.",
    );
});
document.addEventListener("input", (e) => {
  if (e.target.id === "message-search") {
    const pos = e.target.selectionStart;
    messageQuery = e.target.value;
    selectedMessage = null;
    render();
    $("#message-search").focus();
    $("#message-search").setSelectionRange(pos, pos);
    return;
  }
  if (e.target.id === "search") {
    const pos = e.target.selectionStart;
    query = e.target.value;
    render();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
  }
});
request("/api/state")
  .then((data) => {
    state = data.state;
    dataDir = data.dataDir;
    history.replaceState(null, "", "/");
    render();
  })
  .catch((e) => {
    $("#app").innerHTML =
      `<div class="empty"><h1>No se pudo abrir el inventario</h1><p>${esc(e.message)}</p><p>Cerrá y volvé a abrir la aplicación. No se han reemplazado tus datos.</p></div>`;
  });
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
        field(
          "Cantidad en unidad base",
          "value",
          1,
          "number",
          'min="0.001" max="1000000" step="0.001" required',
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
