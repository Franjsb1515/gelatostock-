// Vistas de IA local y Guía.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
function aiChatSection() {
  return `<section class="panel settings-card ai-chat"><h2>Dudas sobre la app o el texto</h2><p>Pregunta cómo usar GelatoStock o qué dice el texto del editor. Responde el mismo modelo local con una guía fija; no consulta tu inventario ni tus pedidos y no ejecuta acciones.</p><div class="ai-chat-log" aria-live="polite">${aiChat.map((m) => `<article class="ai-chat-msg ${m.role}"><strong>${m.role === "user" ? "Tú" : "IA local"}</strong><p class="${m.role === "assistant" ? "ai-chat-answer" : ""}">${esc(m.content)}</p>${m.excerpt ? `<small class="ai-chat-source">Según la guía: ${esc(m.excerpt)}</small>` : ""}</article>`).join("") || '<p class="muted">Ejemplo: «¿Qué hace Control de entregas?» · «¿Cómo hago una copia?» · y, si te apetece, «¿En qué se diferencia el gelato del helado?»</p>'}</div><label class="check"><input type="checkbox" id="ai-chat-doc" ${aiChatUseDoc ? "checked" : ""} ${aiBusy ? "disabled" : ""}> Usar el texto del editor como contexto</label><label class="field">Tu pregunta<textarea id="ai-chat-input" maxlength="1500" rows="3" ${aiBusy ? "disabled" : ""}></textarea></label><div class="setting-actions">${btn(aiBusy ? "Respondiendo en este equipo…" : "Preguntar a la IA local", "aiChatSend", "primary", aiBusy ? "disabled" : "")}${aiBusy ? btn("Detener", "aiCancel") : ""}${aiChat.length ? btn("Vaciar chat", "aiChatClear", "secondary") : ""}</div>${aiChatError ? `<p role="alert">${esc(aiChatError)}</p>` : ""}<small>Respuestas orientativas generadas en este equipo; pueden ser incorrectas o incompletas. El chat se conserva solo en esta ventana. Se envían al modelo los últimos 6 mensajes.</small></section>`;
}
function aiPage() {
  return (
    header(
      "Una segunda lectura, en tu equipo.",
      "Interpreta textos de proveedores sin enviar tus documentos a una IA externa.",
    ) +
    `<div class="settings-grid"><section class="panel settings-card"><h2>Texto que quieres revisar</h2><p>Pega un mensaje o abre el texto de una foto desde Configuración. Revisa el OCR antes de analizarlo. Para PDF todavía debes copiar el texto.</p><label class="field">Profundidad de lectura<select id="ai-mode" ${aiBusy ? "disabled" : ""}><option value="careful" ${aiMode === "careful" ? "selected" : ""}>Revisión reforzada · dos lecturas</option><option value="standard" ${aiMode === "standard" ? "selected" : ""}>Lectura simple · más rápida</option></select></label><label class="field">Documento o mensaje<textarea id="ai-text" class="ai-editor" maxlength="4000" ${aiBusy ? "disabled" : ""}>${esc(aiDraft)}</textarea></label><small>Máximo 4.000 caracteres. Se analiza únicamente este texto.</small><div class="setting-actions">${btn(aiBusy ? "Leyendo en este equipo…" : "Analizar con IA local", "aiAnalyze", "primary", aiBusy ? "disabled" : "")}${aiBusy ? btn("Detener lectura", "aiCancel") : ""}</div><p role="status">${aiBusy ? "Cargando el modelo y leyendo. Puede tardar hasta 4 minutos; puedes seguir usando otras pantallas." : "Modelo local incluido · sin pagos por uso"}</p>${aiError ? `<p role="alert">${esc(aiError)}</p>` : ""}</section><section class="panel settings-card"><span class="stat-icon sage">${icon("shield")}</span><h2>Lectura para revisar</h2>${aiResult ? `<div class="ai-result" id="ai-reading-result"><strong>${esc(aiTypes[aiResult.tipo])}</strong>${aiResult.invalid ? `<p>${esc(aiResult.reason)}</p>` : `<p>Inicio del texto original para contrastar:</p><blockquote>${esc(aiResult.evidencia)}</blockquote>`}${aiResult.rules ? `<p class="ai-readings"><strong>Reglas:</strong> ${esc(aiResult.rules.reason)} (confianza ${esc(aiResult.rules.confidence)}). <strong>Modelo:</strong> ${esc(aiTypes[aiResult.modelType] || "sin lectura").replace("Posible ", "")}.</p>` : ""}<p><strong>${aiResult.verification?.status === "agreement" ? "Dos lecturas del modelo coinciden · requiere revisión" : aiResult.verification?.status === "disagreement" ? "Las lecturas del modelo no coinciden · revisa el original" : "Una lectura del modelo · requiere revisión"}</strong></p>${(aiResult.warnings || []).map((w) => `<p class="ai-warning">${esc(w)}</p>`).join("")}${aiResult.arithmetic ? `<div class="ai-math"><strong>Comprobación de importes por la app</strong><p>${esc(aiResult.arithmetic.reason)}</p>${aiResult.arithmetic.status !== "not_checked" ? `<p>Base ${money(aiResult.arithmetic.base)} + IVA ${money(aiResult.arithmetic.tax)} = ${money(aiResult.arithmetic.expected)}<br>Total declarado: ${money(aiResult.arithmetic.total)}</p>` : ""}</div>` : ""}<small>${num(aiResult.milliseconds / 1000)} segundos · ${esc(aiResult.model)}</small>${aiSourcePhoto && state.photos.some((p) => p.id === aiSourcePhoto) && !aiResult.invalid ? `<div class="setting-actions">${btn("Confirmar este tipo en la foto", "aiSavePhotoType", "secondary")}<small>Queda guardado como tu decisión, no como la de la IA.</small></div>` : ""}</div>` : "<p>Al analizar verás un posible tipo de documento y el inicio del texto original.</p>"}<p>La IA puede equivocarse o inventar detalles. Contrasta su propuesta con el original. Una lista de precios no acredita una compra ni una recepción.</p><ul class="feature-list"><li>${icon("check")} No modifica stock ni registra facturas</li><li>${icon("check")} No compra, no envía mensajes y no abre enlaces</li><li>${icon("check")} Texto y resultado no se guardan en registros de IA</li></ul><small>El resultado se conserva en esta ventana hasta sustituirlo o cerrar la app. El documento original, si lo guardaste, permanece en su archivo.</small></section>${aiChatSection()}</div>`
  );
}
// Minimal, safe Markdown for the guide: headings, paragraphs, lists. Everything escaped.
function guideHtml(md) {
  const lines = md.split(/\r?\n/);
  let html = "",
    list = false;
  const close = () => {
    if (list) html += "</ul>";
    list = false;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      close();
      continue;
    }
    if (line.startsWith("# ")) {
      close();
      continue;
    }
    if (line.startsWith("## ")) {
      close();
      html += `<h2 id="guia-${esc(
        line
          .slice(3)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-"),
      )}">${esc(line.slice(3))}</h2>`;
      continue;
    }
    if (line.startsWith("- ")) {
      if (!list) html += "<ul>";
      list = true;
      html += `<li>${esc(line.slice(2))}</li>`;
      continue;
    }
    close();
    html += `<p>${esc(line)}</p>`;
  }
  close();
  return html;
}
function guidePage() {
  const sections = (typeof GUIDE_MD === "string" ? GUIDE_MD : "")
    .split(/\r?\n/)
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3));
  return (
    header(
      "Guía de uso",
      "Cómo funciona cada pantalla, qué cambia el stock y qué es solo una propuesta. El chat de IA local responde con esta misma guía.",
      btn("Abrir chat de dudas", "aiOpen", "primary"),
    ) +
    `<div class="guide-layout"><nav class="guide-index panel"><div class="panel-heading"><h2>Índice</h2></div><ul>${sections.map((s) => `<li><a href="#guia-${esc(s.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">${esc(s)}</a></li>`).join("")}</ul></nav><article class="guide-body panel">${typeof GUIDE_MD === "string" ? guideHtml(GUIDE_MD) : "<p>La guía no está disponible en este paquete.</p>"}</article></div>`
  );
}
