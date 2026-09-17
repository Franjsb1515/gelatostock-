// Scales the quantities shown in a recipe sheet to the kilos typed. Display only: no state changes.
function scaleRecipe(id, kilos) {
  const r = state.recipes.find((x) => x.id === id);
  if (!r || !(kilos > 0)) return;
  const factor = kilos / r.yield;
  for (const el of document.querySelectorAll(
    `[data-scaled="${CSS.escape(id)}"]`,
  )) {
    const q = Number(el.dataset.base) * factor;
    el.textContent = `${num(el.dataset.unit === "ud" ? Math.ceil(q) : Math.round(q * 1000) / 1000)} ${el.dataset.unit}`;
  }
  const label = document.querySelector(
    `[data-scale-label="${CSS.escape(id)}"]`,
  );
  if (label) label.textContent = num(kilos);
}
// Escuchadores de clic, entrada y cambio; arranque de la aplicación.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
document.addEventListener("click", async (e) => {
  const el = e.target.closest("button,a");
  if (!el) return;
  if (el.dataset.step) {
    const input = el.parentElement.querySelector("input");
    if (!input) return;
    const by = Number(input.dataset.stepBy || input.step || 1) || 1;
    const min = input.min === "" ? -Infinity : Number(input.min);
    const max = input.max === "" ? Infinity : Number(input.max);
    const decimals = String(by).includes(".")
      ? String(by).split(".")[1].length
      : 0;
    const next = Math.min(
      max,
      Math.max(
        min,
        Number(
          ((Number(input.value) || 0) + Number(el.dataset.step) * by).toFixed(
            decimals,
          ),
        ),
      ),
    );
    input.value = next;
    if (input.dataset.scale) scaleRecipe(input.dataset.scale, next);
    if (input.dataset.cart)
      await mutate(
        { type: "cart", product: input.dataset.cart, packs: next },
        next === 0 ? "Producto retirado." : "Cantidad actualizada.",
      );
    return;
  }
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
    const m = state.messages.find((x) => x.id === selectedMessage);
    // Filters must not hide the message the person just asked to open.
    if (m && !messageMatches(m)) {
      messageSupplier = "all";
      messageFilter = "all";
      messageQuery = "";
    }
    page = "messages";
    if (m && !m.read) await mutate({ type: "read", id: selectedMessage });
    else render();
    document
      .querySelector(".message-detail")
      ?.scrollIntoView({ block: "start" });
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "reply-text") {
    const id = e.target
      .closest(".message-detail")
      ?.querySelector("[data-action=sendReply]")?.dataset.id;
    if (id) replyDrafts[id] = e.target.value;
  }
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
  if (e.target.id === "doc-supplier" || e.target.id === "doc-filter") {
    if (e.target.id === "doc-supplier") docSupplier = e.target.value;
    else docFilter = e.target.value;
    render();
    return;
  }
  if (e.target.id === "count-zone") {
    const rows = document.getElementById("count-rows");
    if (rows) rows.innerHTML = countRows(e.target.value);
    return;
  }
  if (e.target.id === "cruise-status") {
    cruiseStatus = e.target.value;
    try {
      await searchCruises();
    } catch (err) {
      toast(err.message);
    }
    render();
    return;
  }
  if (e.target.id === "cruise-impact-only") {
    cruiseImpactOnly = e.target.checked;
    render();
    return;
  }
  if (e.target.id === "cruises-enabled") {
    try {
      applyEnvelope(
        await request("/api/maintenance", {
          type: "cruises",
          enabled: e.target.checked,
        }),
      );
      cruiseDash = null;
      render();
      toast(
        e.target.checked
          ? "Consulta de cruceros activada."
          : "Consulta de cruceros desactivada: la app no sale a internet.",
      );
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  if (e.target.id === "count-days") {
    try {
      applyEnvelope(
        await request("/api/maintenance", {
          type: "countDays",
          days: Number(e.target.value),
        }),
      );
      render();
      toast(
        countDays
          ? "Recordatorio de conteo cada " + countDays + " días."
          : "Recordatorio de conteo desactivado.",
      );
    } catch (err) {
      toast(err.message);
    }
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
  if (e.target.id === "recipe-family") {
    recipeFamily = e.target.value;
    render();
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
  if (e.target.id === "cruise-search") {
    cruiseQuery = e.target.value;
    const pos = e.target.selectionStart;
    clearTimeout(window.cruiseSearchTimer);
    window.cruiseSearchTimer = setTimeout(async () => {
      try {
        await searchCruises();
      } catch (err) {
        toast(err.message);
      }
      if (page !== "cruises") return;
      render();
      const box = $("#cruise-search");
      if (box) {
        box.focus();
        box.setSelectionRange(pos, pos);
      }
    }, 250);
    return;
  }
  if (e.target.id === "recipe-search") {
    recipeQuery = e.target.value;
    const pos = e.target.selectionStart;
    render();
    $("#recipe-search").focus();
    $("#recipe-search").setSelectionRange(pos, pos);
    return;
  }
  if (e.target.dataset.scale) {
    scaleRecipe(e.target.dataset.scale, Number(e.target.value));
    return;
  }
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
