// Pantalla y acciones del canal WhatsApp (conexión, chats autorizados, envíos de prueba).
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
function whatsapp() {
  const w = waState;
  if (!w) {
    setTimeout(refreshWhatsApp, 0);
    return header("WhatsApp de proveedores", "Cargando conexión local…");
  }
  const names = {
    disconnected: "Desconectado",
    starting: "Preparando conexión…",
    qr: "Escanea el QR",
    connected: "Conectado",
    closing: "Cerrando sesión…",
    error: "Revisar conexión",
  };
  return (
    header(
      "WhatsApp de proveedores",
      "WhatsApp normal o Business · se conecta leyendo un código QR con el teléfono (función todavía en pruebas)",
    ) +
    `<section class="panel settings-card"><h2>${esc(names[w.status] || w.status)}</h2><p>Cuenta conectada: <strong>${esc(w.activePhone || "Ninguna")}</strong></p><p class="fineprint">Solo entran en la app los chats que autorices. WhatsApp Web, por su cuenta, puede guardar en este ordenador una copia de toda la cuenta. Hace falta internet y tener la app abierta. Solo se envía lo que confirmes en pantalla.</p>${w.error ? `<p role="alert">${esc(w.error)}</p>` : ""}${w.qr ? `<img src="${esc(w.qr)}" alt="QR para vincular WhatsApp" width="280" height="280"><p>En tu teléfono: WhatsApp → Dispositivos vinculados → Vincular un dispositivo.</p>` : ""}<div class="setting-actions">${btn("Conectar por QR", "waConnect", "primary", ["connected", "starting", "qr", "closing"].includes(w.status) ? "disabled" : "")}${btn("Cerrar sesión / cambiar número", "waDisconnect", "secondary", w.status === "closing" ? "disabled" : "")}${btn(w.autoConnect ? "Mantener la sesión al abrir: sí" : "Mantener la sesión al abrir: no", "waAutoconnect", "secondary")}</div><p class="fineprint">La app recuerda la sesión y se conecta sola al abrir, hasta que pulses «Cerrar sesión / cambiar número».</p></section>
 <section class="panel settings-card"><h2>Chats autorizados para esta cuenta</h2><p>Para que los mensajes de un chat lleguen a Mensajes, autorízalo eligiendo un <strong>proveedor registrado</strong>. No se importa el historial anterior a la conexión.</p>${w.status === "connected" && w.account === w.activeAccount ? btn("Autorizar chat", "waAllow", "primary") + (w.allowed.length ? btn("Enviar mensaje de prueba", "waSendText", "secondary") + btn("Recuperar mensajes recientes", "waRecover", "secondary") : "") : ""}<div>${w.allowed.map((c) => `<p><strong>${esc(c.label)}</strong> · ${esc(c.phone)} · ${c.supplier ? "sus mensajes entran en Mensajes" : "<strong>no entra en Mensajes</strong>: es un chat sin proveedor, y sus mensajes solo se ven aquí"} ${w.account === w.activeAccount ? btn("Quitar la autorización", "waRevoke", "secondary", `data-phone="${esc(c.phone)}"`) : ""}</p>`).join("") || '<p class="muted">Sin chats autorizados.</p>'}</div></section>
 <section class="panel settings-card"><h2>Por qué no ha entrado un mensaje</h2><p class="fineprint">La app apunta aquí lo que pasa con la conexión y con cada mensaje, para saber por qué uno no ha entrado. No guarda el texto de los mensajes.</p>${(w.diagnostics || []).length ? `<pre class="diag">${esc((w.diagnostics || []).join("\n"))}</pre>` : '<p class="muted">Nada que apuntar todavía.</p>'}</section>
 <section class="panel settings-card"><h2>Mensajes de esta cuenta de WhatsApp</h2><label class="field">Cuenta<select id="wa-account"><option value="">La conectada ahora (o la última)</option>${w.accounts.map((a) => `<option value="${a.id}" ${waAccount === a.id ? "selected" : ""}>${esc(a.phone)}</option>`).join("")}</select></label><p>Últimos mensajes recibidos y enviados de esta cuenta.</p>${
   [...w.messages, ...(w.sent || []).map((m) => ({ ...m, outgoing: true }))]
     .sort((a, b) => (a.at < b.at ? 1 : -1))
     .map((m) =>
       m.outgoing
         ? `<article class="message-bubble outgoing"><strong>Tú → ${esc(w.allowed.find((c) => c.phone === m.recipient)?.label || m.recipient)}</strong><small> · ${esc(m.recipient)} · ${date(m.at)} ${time(m.at)}${m.order_id ? " · pedido enviado" : ""}</small><p>${esc(m.text)}</p></article>`
         : `<article class="message-bubble"><strong>${esc(w.allowed.find((c) => c.phone === m.sender)?.label || m.sender)}</strong><small> · ${esc(m.sender)} · ${date(m.at)} ${time(m.at)}</small><p>${esc(m.text)}</p>${m.interpretation ? `<div class="wa-reading">${pill(replyLabel[m.interpretation.category], m.interpretation.needsReading ? "peach" : "sage")} <small>${esc(m.interpretation.summary)}</small></div>` : ""}${m.text ? btn("Leer con el Ayudante", "aiWhatsApp", "secondary", `data-id="${esc(m.id)}"`) : ""}${m.file ? `<small>${esc(m.name)}</small><code class="path">${esc(dataDir)}/whatsapp/${esc(m.file)}</code>` : ""}</article>`,
     )
     .join("") || '<p class="muted">Sin mensajes importados de esta cuenta.</p>'
 }</section>
 <section class="panel settings-card"><h2>Historial de sesiones y cambios de número</h2>${btn("Crear copia de WhatsApp", "waBackup")}<p class="fineprint">Incluye conversaciones y adjuntos. Es independiente de la copia del inventario.</p>${w.history.map((e) => `<p>${date(e.at)} ${time(e.at)} · ${esc(e.text)}</p>`).join("") || '<p class="muted">Todavía no se ha vinculado ninguna cuenta.</p>'}</section>`
  );
}
async function whatsappAction(name, el) {
  if (name === "waBackup") {
    try {
      const result = await request("/api/whatsapp", { type: "backup" });
      modal(
        "Copia de WhatsApp creada",
        "Guarda la carpeta completa. La conexión con WhatsApp no se incluye: tras restaurarla habrá que volver a leer el QR.",
        `<code class="path">${esc(result.path)}</code>`,
        async () => true,
        "Listo",
      );
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (name === "waSendText") {
    modal(
      "Enviar un mensaje de prueba",
      "Se envía exactamente este texto al chat autorizado que elijas, desde la cuenta conectada.",
      select(
        "Destinatario autorizado",
        "phone",
        waState.allowed.map((c) => [c.phone, c.label + " · " + c.phone]),
      ) +
        `<label class="field">Texto<textarea name="text" maxlength="4000" required>Prueba desde ArtelloAPP. Responde a este mensaje para comprobar la recepción.</textarea></label>`,
      async (f) => {
        waState = await request("/api/whatsapp", {
          type: "sendText",
          phone: f.get("phone"),
          text: f.get("text"),
        });
        render();
        toast(
          "Mensaje enviado. Si no llega, mira «Por qué no ha entrado un mensaje» en esta pantalla.",
        );
        return true;
      },
      "Enviar ahora",
    );
    return;
  }
  if (name === "waRecover") {
    try {
      const r = await request("/api/whatsapp", { type: "recover" });
      waState = r;
      render();
      toast(
        r.imported
          ? r.imported + " mensaje(s) recuperado(s) del historial reciente."
          : "No había mensajes nuevos en el historial reciente de los chats autorizados.",
      );
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (name === "waAutoconnect") {
    try {
      waState = await request("/api/whatsapp", {
        type: "autoconnect",
        enabled: !waState.autoConnect,
      });
      render();
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (name === "waAllow") {
    modal(
      "Autorizar un chat",
      "Solo entrarán los mensajes de este número, con la cuenta conectada ahora. Si no eliges proveedor, se verán solo en esta pantalla y no en Mensajes.",
      select("Proveedor registrado (opcional)", "supplier", [
        ["", "Otro contacto"],
        ...state.suppliers.filter((p) => p.whatsapp).map((p) => [p.id, p.name]),
      ]) +
        field(
          "Número internacional",
          "phone",
          "",
          "tel",
          'placeholder="+34…" maxlength="40"',
        ) +
        field("Nombre del contacto", "label", "", "text", 'maxlength="100"'),
      async (f) => {
        waState = await request("/api/whatsapp", {
          type: "allow",
          ...Object.fromEntries(f),
        });
        render();
        return true;
      },
    );
    return;
  }
  if (name === "waDisconnect") {
    modal(
      "Cerrar sesión y cambiar número",
      "Se conserva el historial de cada cuenta. La próxima conexión mostrará un nuevo QR.",
      "<p>Queda apuntado en el historial de esta pantalla. Después podrás conectar otro número.</p>",
      async () => {
        waState = await request("/api/whatsapp", { type: "disconnect" });
        waAccount = "";
        render();
        return true;
      },
      "Cerrar sesión",
    );
    return;
  }
  waBusy = true;
  try {
    waState = await request(
      "/api/whatsapp",
      name === "waConnect"
        ? { type: "connect" }
        : { type: "allow", remove: true, phone: el.dataset.phone },
    );
    waAccount = "";
    render();
  } catch (e) {
    toast(e.message);
  } finally {
    waBusy = false;
  }
}
