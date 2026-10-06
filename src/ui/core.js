// Estado de la interfaz, utilidades, peticiones al servidor local y render principal.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
let waState = null,
  waAccount = "",
  waBusy = false;
let appVersion = "",
  backupInfo = null,
  historyInfo = null,
  replyDrafts = {},
  alerts = null,
  catalog = {},
  countDays = 7,
  dayChangeHour = 5,
  orderTemplate = "",
  nudgeTemplate = "",
  replyTemplates = {},
  messageNotices = true,
  wasteReasons = {},
  chats = { bySupplier: {}, unlinked: 0, connected: false, ready: [] },
  cruiseInfo = null,
  weeklyData = null,
  weeklyWeek = "",
  weeklyBusy = false,
  historyShown = { movements: 50, activity: 50 },
  lockInfo = null,
  retentionDays = 0;
let state,
  dataDir,
  archiveWarning,
  page = location.hash === "#whatsapp" ? "whatsapp" : "home",
  filter = "Todos",
  query = "",
  selectedMessage = null,
  busy = false,
  messageQuery = "",
  messageSupplier = "all",
  messageFilter = "all",
  recipeQuery = "",
  recipeFamily = "all";
let orderFilter = "open";
let aiDraft = "",
  aiMode = "careful",
  aiBusy = false,
  aiResult = null,
  aiError = "",
  aiChat = [],
  aiChatUseDoc = true,
  aiChatError = "",
  aiSourcePhoto = "",
  aiReplyBusy = "",
  docSupplier = "all",
  docFilter = "all";
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
// Today's calendar date in local time (never toISOString, which is UTC).
// "AAAA-MM-DD" of a local date.
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Calendar arithmetic on "AAAA-MM-DD" (dates, not instants: no zone can move them a day).
const shiftDay = (day, n) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const todayLocal = () => ymd(new Date());
// Business day: before the change hour (05:00 by default) the shop is still on yesterday.
const businessToday = () => ymd(new Date(Date.now() - dayChangeHour * 3600000));
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
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18 M8 3v4 M16 3v4 M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01"/>',
  arrow: '<path d="M5 12h14 m-5-5 5 5-5 5"/>',
  plus: '<path d="M12 5v14 M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  bell: '<path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4Z M10 21h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  ship: '<path d="M3 17l2 4h14l2-4-9-3-9 3Z"/><path d="M6 15V9h12v6"/><path d="M10 9V5h4v4"/>',
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
// Marca Artello: trazos del logo original (build-assets/marca, sacados del .ai del usuario).
const artello = {
  mark: {
    w: 208.2,
    h: 185.6,
    d: "M146.8 117L117 87.3L130 74.3L159.7 104.1ZM74.3 130L104.1 100.2L133.8 130L104.1 159.7ZM35.5 35.5C50.8 20.1 75.8 20.1 91.1 35.5L78.8 47.8L35.5 91.1C20.1 75.8 20.1 50.8 35.5 35.5M91.1 61.4L104.1 48.4L117 61.4L104.1 74.3ZM78.2 74.3L91.1 87.3L61.4 117L48.4 104.1ZM172.7 35.5C188 50.8 188 75.8 172.7 91.1L129.4 47.8L117 35.5C132.4 20.1 157.3 20.1 172.7 35.5M185.6 22.5C163.1 0 126.6 0 104.1 22.5C81.6 0 45.1 0 22.5 22.5C0 45 0 81.5 22.5 104.1L47.8 129.4L91.1 172.7L91.1 172.7L104.1 185.6L160.3 129.4L172.7 117L172.7 117L185.6 104.1L185.6 104.1C208.2 81.5 208.2 45 185.6 22.5",
  },
  word: {
    w: 644.3,
    h: 177.6,
    d: "M278.2 22.7L261.5 22.7L261.5 6L313.2 6L313.2 22.7L296.5 22.7L296.5 173L278.2 173ZM366 173L323.3 173L323.3 6L363.2 6L363.2 22.7L341.7 22.7L341.7 76.5L361.1 76.5L361.1 94.4L341.7 94.4L341.7 156.3L366 156.3ZM380.5 173L380.5 6L398.8 6L398.8 156.3L418.7 156.3L418.7 173ZM428.3 173L428.3 6L446.6 6L446.6 156.3L466.5 156.3L466.5 173ZM555.5 160C516.2 160 484.3 128.1 484.3 88.8C484.3 49.5 516.2 17.6 555.5 17.6C594.8 17.6 626.7 49.5 626.7 88.8C626.7 128.1 594.8 160 555.5 160M555.5 0C506.4 0 466.7 39.8 466.7 88.8C466.7 137.9 506.4 177.6 555.5 177.6C604.6 177.6 644.3 137.9 644.3 88.8C644.3 39.8 604.6 0 555.5 0M155.2 109.6C155.3 109.7 155.4 109.8 155.5 109.9L155.2 109.9ZM197.9 17.2C223.2 17.2 243.8 37.8 243.8 63.1C243.8 88.5 223.2 109 197.9 109C172.5 109 152 88.5 152 63.1C152 37.8 172.5 17.2 197.9 17.2M261 63.1C261 28.3 232.7 0 197.9 0C181.4 0 166.4 6.3 155.2 16.6L155.2 6L136.9 6L136.9 46.9L136.9 63.1L136.9 79.3L136.9 173L155.2 173L155.2 110.3L244.2 176.2L255 161.3L205.3 125.8C236.7 122.1 261 95.4 261 63.1M18.3 94.3L18.3 57.7C18.3 36 36 18.3 57.7 18.3C79.4 18.3 97 36 97 57.7L97 94.3ZM115.3 57.7C115.3 25.8 89.5 0 57.7 0C25.8 0 0 25.8 0 57.7L0 93.5L0 173L18.3 173L18.3 112.6L97 112.6L97 173L115.3 173L115.3 93.5Z",
  },
};
const artelloSvg = (part, cls) =>
  `<svg class="${cls}" viewBox="0 0 ${artello[part].w} ${artello[part].h}" fill="currentColor" aria-hidden="true"><path d="${artello[part].d}"/></svg>`;
// Sello del Resumen: el corazón de Artello dentro de dos aros con el nombre alrededor.
const artelloSeal = () =>
  `<svg class="seal" viewBox="0 0 120 120" aria-hidden="true"><circle class="seal-ring" cx="60" cy="60" r="57"/><circle class="seal-ring thin" cx="60" cy="60" r="43"/><path id="seal-path" fill="none" d="M60 60m-50 0a50 50 0 1 1 100 0a50 50 0 1 1-100 0"/><text class="seal-text"><textPath href="#seal-path" textLength="304" lengthAdjust="spacing">ARTELLO GELATO · GELATO CONTROL SYSTEM ·</textPath></text><svg x="37" y="40" width="46" height="41" viewBox="0 0 ${artello.mark.w} ${artello.mark.h}"><path fill="currentColor" d="${artello.mark.d}"/></svg></svg>`;
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
  irrelevant: "No afecta a tus pedidos",
  review: "Sin pedido identificado",
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
// Lo que puede cambiar solo mientras la pantalla está abierta (un WhatsApp que entra: el mensaje,
// su adjunto y la actividad). Si solo cambió eso, lo que la persona tiene delante sigue valiendo.
const incomingOnly = [
  "revision",
  "processed",
  "messages",
  "activity",
  "photos",
];
const sameExceptIncoming = (a, b) =>
  JSON.stringify({
    ...a,
    ...Object.fromEntries(incomingOnly.map((k) => [k, 0])),
  }) ===
  JSON.stringify({
    ...b,
    ...Object.fromEntries(incomingOnly.map((k) => [k, 0])),
  });
async function mutate(a, msg, retried = false) {
  if (busy) return false;
  busy = true;
  try {
    const data = await request("/api/action", {
      revision: state.revision,
      operationId: crypto.randomUUID(),
      ...a,
    });
    applyEnvelope(data);
    render();
    if (archiveWarning || msg) toast(archiveWarning || msg);
    return true;
  } catch (e) {
    if (e.status === 409) {
      try {
        const fresh = await request("/api/state");
        // Solo entró un mensaje: se repite la operación con la revisión nueva, sin molestar.
        if (!retried && sameExceptIncoming(state, fresh.state)) {
          applyEnvelope(fresh);
          busy = false;
          return await mutate(
            a.revision === undefined ? a : { ...a, revision: state.revision },
            msg,
            true,
          );
        }
        // Cambió algo de verdad: se guarda lo nuevo para el siguiente intento, pero la pantalla
        // no se redibuja ahora (se perdería lo escrito); se redibuja al cambiar de pantalla.
        applyEnvelope(fresh);
        staleState = true;
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
// Every server response carries the same envelope: state plus side information.
function applyEnvelope(data) {
  state = data.state;
  appVersion = data.version || appVersion;
  if (data.backup) backupInfo = data.backup;
  if (data.lock) lockInfo = data.lock;
  if (data.history) historyInfo = data.history;
  if (data.retentionDays !== undefined) retentionDays = data.retentionDays;
  if (data.countDays !== undefined) countDays = data.countDays;
  if (data.dayChangeHour !== undefined) dayChangeHour = data.dayChangeHour;
  if (data.orderTemplate !== undefined) orderTemplate = data.orderTemplate;
  if (data.nudgeTemplate !== undefined) nudgeTemplate = data.nudgeTemplate;
  if (data.replyTemplates !== undefined) replyTemplates = data.replyTemplates;
  if (data.messageNotices !== undefined) messageNotices = data.messageNotices;
  if (data.wasteReasons) wasteReasons = data.wasteReasons;
  if (data.chats) chats = data.chats;
  if (data.alerts) alerts = data.alerts;
  if (data.catalog) catalog = data.catalog;
  if (data.pricelist) priceCompare = data.pricelist;
  if (data.cartAdvice) cartHints = data.cartAdvice;
  if (data.cruises) cruiseInfo = data.cruises;
  if (data.dataDir) dataDir = data.dataDir;
  archiveWarning = data.archiveWarning;
  // Con el estado recién traído, el mensaje más nuevo ya está a la vista: deja de ser «nuevo».
  pulseSeen = state?.messages?.[0]?.id || "";
  staleState = false;
}
async function reloadState() {
  applyEnvelope(await request("/api/state"));
  render();
}
function nav(to) {
  page = to;
  query = "";
  filter = "Todos";
  // Si mientras tanto ha entrado algo (un mensaje de WhatsApp), esta pantalla se dibuja ya
  // con lo nuevo. Refrescar aquí y no en medio de un formulario evita perder lo escrito.
  if (staleState) {
    reloadState().catch(() => render());
    return;
  }
  render();
}
const pageLabel = {
  home: "Resumen",
  stock: "Inventario",
  orders: "Compras",
  messages: "Mensajes",
  whatsapp: "WhatsApp",
  suppliers: "Proveedores",
  activity: "Actividad",
  settings: "Configuración",
  ai: "Ayudante",
  production: "Producción",
  recipes: "Recetario",
  weekly: "Resumen semanal",
  calendar: "Calendario",
  cruises: "Cruceros",
  documents: "Documentos",
  guide: "Guía",
};
function header(title, description, actions = "") {
  // Rótulo por pantalla: el acento de color lo pone main.page-… en styles.css.
  const eyebrow =
    page === "home"
      ? "GELATO CONTROL SYSTEM"
      : (pageLabel[page] || "").toUpperCase();
  return `<div class="page-heading"><div><div class="eyebrow"><i class="dot"></i>${esc(eyebrow)}</div><h1>${title}</h1>${description ? `<p>${description}</p>` : ""}</div><div class="heading-actions">${actions}</div></div>`;
}
const initials = (name) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "G";
let splashDone = false;
function dismissSplash() {
  if (splashDone) return;
  splashDone = true;
  const splash = $("#splash");
  if (!splash) return;
  // The splash shows the business name and place from the data, then fades.
  splash.querySelector(".splash-name").textContent = state.business;
  splash.querySelector(".splash-place").textContent = state.place || "";
  setTimeout(() => {
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 700);
  }, 1400);
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
    whatsapp,
    ai: aiPage,
    production,
    recipes: recipeBook,
    weekly: weeklyPage,
    calendar: calendarPage,
    cruises: cruisePage,
    documents,
    guide: guidePage,
  };
  dismissSplash();
  $("#app").innerHTML =
    `<aside class="sidebar"><a href="#" class="brand" data-nav="home"><span class="brand-row" aria-label="ArtelloAPP">${artelloSvg("mark", "brandmark")}${artelloSvg("word", "brandword")}<span class="brand-light">APP</span></span><small>GELATO CONTROL SYSTEM</small></a><div class="workspace"><div class="workspace-icon">${esc(initials(state.business))}</div><div><strong>${esc(state.business)}</strong>${state.place ? `<small>${esc(state.place)}</small>` : ""}</div></div><div class="nav-label">MI NEGOCIO</div><nav>${[
      ["home", "home", "Resumen"],
      ["stock", "box", "Inventario"],
      ["orders", "cart", "Compras"],
      ["production", "ice", "Producción"],
      ["recipes", "cake", "Recetario"],
      ["messages", "message", "Mensajes"],
      ["whatsapp", "message", "WhatsApp"],
      ["suppliers", "store", "Proveedores"],
      ["documents", "photo", "Documentos"],
      ["activity", "clock", "Actividad"],
      ["weekly", "check", "Semana"],
      ["calendar", "calendar", "Calendario"],
      ["cruises", "ship", "Cruceros"],
      ["ai", "leaf", "Ayudante"],
      ["guide", "shield", "Guía"],
    ]
      .map(
        ([id, i, label]) =>
          `<button data-nav="${id}" class="nav-item ${page === id ? "active" : ""}">${icon(i)}<span>${label}</span>${id === "messages" && unread ? `<b class="nav-count">${unread}</b>` : ""}${id === "orders" && state.cart.length ? `<b class="nav-count">${state.cart.length}</b>` : ""}</button>`,
      )
      .join(
        "",
      )}</nav><div class="sidebar-bottom"><div class="local-card">${icon("shield")}<strong>Tu información se queda aquí</strong><p>Datos guardados en este equipo. Sin depender de internet.</p><span><i class="dot"></i> Almacenamiento local</span></div><button data-nav="settings" class="nav-item ${page === "settings" ? "active" : ""}">${icon("settings")}<span>Configuración</span></button><div class="profile"><span class="avatar">${esc(initials(state.business))}</span><div><strong>${esc(state.business)}</strong><small>ArtelloAPP · v${esc(appVersion)}</small></div></div></div></aside><main class="page-${esc(page)}"><header class="topbar"><div class="breadcrumb">${esc(state.business)} <span>/</span> ${esc(pageLabel[page] || "")}</div><div class="top-right"><span class="local-status"><i class="dot"></i> Modo local</span><button class="icon-button" aria-label="Ver mensajes" data-nav="messages">${icon("bell")}${unread ? '<i class="notification-dot"></i>' : ""}</button><span class="avatar small">${esc(initials(state.business))}</span></div></header><div class="content">${views[page]()}</div><footer>Hecho para ${esc(state.business)}${state.place ? ", " + esc(state.place) : ""}.<span>Pedidos reales solo por WhatsApp con tu confirmación</span></footer></main>`;
}
async function refreshWhatsApp() {
  if (page !== "whatsapp" || waBusy || document.querySelector("#modal")?.open)
    return;
  try {
    const next = await request(
      "/api/whatsapp" +
        (waAccount ? "?account=" + encodeURIComponent(waAccount) : ""),
    );
    if (JSON.stringify(next) !== JSON.stringify(waState)) {
      waState = next;
      render();
    }
  } catch {
    /* Retain last visible state; next poll retries. */
  }
}
setInterval(refreshWhatsApp, 2000);
// ¿Ha llegado algo? Pregunta barata cada cinco segundos (revisión y lectura del último
// mensaje, sin su texto). No redibuja la pantalla sola: si hay un mensaje nuevo aparece el
// aviso de abajo, y lo demás espera al siguiente cambio de pantalla (nav).
let pulseSeen = "",
  staleState = false,
  incomingId = "";
async function pulse() {
  if (!state || busy || $("#modal")?.open) return;
  try {
    const p = await request("/api/pulse");
    if (p.notices !== undefined) messageNotices = p.notices;
    if (p.revision !== state.revision) staleState = true;
    if (!messageNotices) return;
    if (p.last && p.last.id !== pulseSeen && !p.last.read) showIncoming(p.last);
  } catch {
    /* Sin conexión con el servidor local: se reintenta en el siguiente latido. */
  }
}
setInterval(pulse, 5000);
function showIncoming(last) {
  const bar = $("#incoming");
  if (!bar || incomingId === last.id) return;
  incomingId = last.id;
  bar.innerHTML = `<div class="incoming-bar"><div class="incoming-text"><strong>Mensaje nuevo de ${esc(last.supplier || "un proveedor")}</strong><p>${esc(last.label)}${last.needsReading ? " · hay que leerlo" : " · queda anotado"}</p></div><div class="incoming-actions">${btn("Abrir el mensaje", "incomingOpen", "primary")}${btn("Ahora no", "incomingHide", "secondary")}</div></div>`;
  bar.hidden = false;
}
function hideIncoming(seen) {
  const bar = $("#incoming");
  if (!bar) return;
  if (seen) pulseSeen = incomingId || pulseSeen;
  incomingId = "";
  bar.hidden = true;
  bar.innerHTML = "";
}

// Name shown on printed pages.
// «Revertir» no se ofrece en las líneas del cierre del día ni en el gelato hecho en una producción:
// se corrigen desde su sitio (mismo criterio que la acción reverse de core/domain.ts).
const closeLinePattern =
  /^(Venta del día|Invitación o consumo del día|Merma del día) \d{4}-\d{2}-\d{2}/;
const reversible = (m) =>
  m.kind !== "receipt" &&
  m.kind !== "output" &&
  !m.reverses &&
  !(["exit", "waste"].includes(m.kind) && closeLinePattern.test(m.reason));
function businessName() {
  return state?.business || "ArtelloAPP";
}

// De dónde sale cada precio del catálogo de un proveedor.
const priceSourceLabel = {
  edit: "escrito a mano",
  document: "de un documento",
  message: "de un mensaje",
  list: "de la lista de precios",
};

const zoneLabel = {
  vitrina: "Pozzetti",
  camara: "Cámara",
  congelador: "Congelador",
  almacen: "Almacén",
  obrador: "Obrador",
  barra: "Barra",
  otra: "Otra zona",
};
