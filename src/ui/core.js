// Estado de la interfaz, utilidades, peticiones al servidor local y render principal.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
let waState = null,
  waAccount = "",
  waBusy = false;
let appVersion = "",
  backupInfo = null,
  historyInfo = null,
  replyDrafts = {},
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
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
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
    applyEnvelope(data);
    render();
    if (archiveWarning || msg) toast(archiveWarning || msg);
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
// Every server response carries the same envelope: state plus side information.
function applyEnvelope(data) {
  state = data.state;
  appVersion = data.version || appVersion;
  if (data.backup) backupInfo = data.backup;
  if (data.lock) lockInfo = data.lock;
  if (data.history) historyInfo = data.history;
  if (data.retentionDays !== undefined) retentionDays = data.retentionDays;
  if (data.dataDir) dataDir = data.dataDir;
  archiveWarning = data.archiveWarning;
}
async function reloadState() {
  applyEnvelope(await request("/api/state"));
  render();
}
function nav(to) {
  page = to;
  query = "";
  filter = "Todos";
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
  ai: "IA local",
  production: "Producción",
  recipes: "Recetario",
  weekly: "Resumen semanal",
  documents: "Documentos",
  guide: "Guía",
};
function header(title, description, actions = "") {
  // Rótulo por pantalla: el acento de color lo pone main.page-… en styles.css.
  const eyebrow =
    page === "home"
      ? "TU NEGOCIO, EN ORDEN"
      : (pageLabel[page] || "").toUpperCase();
  return `<div class="page-heading"><div><div class="eyebrow"><i class="dot"></i>${esc(eyebrow)}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
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
  splash.querySelector(".splash-place").textContent =
    state.place || "Tu negocio, en orden";
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
    documents,
    guide: guidePage,
  };
  dismissSplash();
  $("#app").innerHTML =
    `<aside class="sidebar"><a href="#" class="brand" data-nav="home"><span class="brand-row"><span class="brandmark">${icon("ice")}</span><span>gelato<span class="brand-light">stock</span></span></span><small>ARTE + GELATO · EN ORDEN</small></a><div class="workspace"><div class="workspace-icon">${esc(initials(state.business))}</div><div><strong>${esc(state.business)}</strong><small>${esc(state.place || "Tu negocio, en orden")}</small></div></div><div class="nav-label">MI NEGOCIO</div><nav>${[
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
      ["ai", "leaf", "IA local"],
      ["guide", "shield", "Guía"],
    ]
      .map(
        ([id, i, label]) =>
          `<button data-nav="${id}" class="nav-item ${page === id ? "active" : ""}">${icon(i)}<span>${label}</span>${id === "messages" && unread ? `<b class="nav-count">${unread}</b>` : ""}${id === "orders" && state.cart.length ? `<b class="nav-count">${state.cart.length}</b>` : ""}</button>`,
      )
      .join(
        "",
      )}</nav><div class="sidebar-bottom"><div class="local-card">${icon("shield")}<strong>Tu información se queda aquí</strong><p>Datos guardados en este equipo. Sin depender de internet.</p><span><i class="dot"></i> Almacenamiento local</span></div><button data-nav="settings" class="nav-item ${page === "settings" ? "active" : ""}">${icon("settings")}<span>Configuración</span></button><div class="profile"><span class="avatar">${esc(initials(state.business))}</span><div><strong>${esc(state.business)}</strong><small>GelatoStock · v${esc(appVersion)}</small></div></div></div></aside><main class="page-${esc(page)}"><header class="topbar"><div class="breadcrumb">${esc(state.business)} <span>/</span> ${esc(pageLabel[page] || "")}</div><div class="top-right"><span class="local-status"><i class="dot"></i> Modo local</span><button class="icon-button" aria-label="Ver mensajes" data-nav="messages">${icon("bell")}${unread ? '<i class="notification-dot"></i>' : ""}</button><span class="avatar small">${esc(initials(state.business))}</span></div></header><div class="content">${views[page]()}</div><footer>Hecho para ${esc(state.business)}${state.place ? ", " + esc(state.place) : ""}.<span>Pedidos reales solo por WhatsApp con tu confirmación</span></footer></main>`;
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

// Name shown on printed pages.
function businessName() {
  return state?.business || "GelatoStock";
}
