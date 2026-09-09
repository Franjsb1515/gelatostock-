// Escuchadores de clic, entrada y cambio; arranque de la aplicación.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
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
  } else if (el.dataset.filterMessages) {
    messageFilter = el.dataset.filterMessages;
    nav("messages");
    return;
  } else if (el.dataset.openMessage) {
    selectedMessage = el.dataset.openMessage;
    page = "messages";
    await mutate({ type: "read", id: selectedMessage });
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "ai-text") {
    aiDraft = e.target.value;
    aiResult = null;
    $("#ai-reading-result")?.remove();
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "ai-mode") {
    aiMode = e.target.value;
    aiResult = null;
    aiError = "";
    render();
    return;
  }
  if (e.target.id === "retention-days") {
    try {
      const data = await request("/api/maintenance", {
        type: "retention",
        days: Number(e.target.value),
      });
      retentionDays = data.retentionDays;
      render();
      toast(
        retentionDays
          ? "Limpieza automática cada " + retentionDays + " días."
          : "Limpieza automática desactivada.",
      );
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  if (e.target.id === "wa-account") {
    waAccount = e.target.value;
    waState = null;
    await refreshWhatsApp();
    return;
  }
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
    appVersion = data.version || appVersion;
    if (data.backup) backupInfo = data.backup;
    dataDir = data.dataDir;
    archiveWarning = data.archiveWarning;
    history.replaceState(null, "", "/");
    render();
  })
  .catch((e) => {
    $("#app").innerHTML =
      `<div class="empty"><h1>No se pudo abrir el inventario</h1><p>${esc(e.message)}</p><p>Cerrá y volvé a abrir la aplicación. No se han reemplazado tus datos.</p></div>`;
  });
