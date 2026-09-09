# Sesión 025 · Mensajes por conversación, decisiones y guía en la app · versión 0.15.0

## Encargo
Tras 0.14.1 el usuario pidió: mejorar «enormemente» Mensajes y hacerla intuitiva; que quede claro que la app aprende a leer mensajes pero no aprende decisiones (aceptar una nata el lunes hoy no significa aceptarla siempre: otro día puede ir a Makro); una guía de uso dentro de la app junto al chat de dudas.

## Cambios
- Núcleo: campo decision/decidedAt en mensajes y acción decide (core/schema.ts, core/domain.ts). Marca leído y revisado, deja actividad, no toca pedidos ni stock (prueba en tests/domain.test.cjs).
- Servidor: tipo reply en POST /api/whatsapp. Busca el mensaje, exige canal WhatsApp y remitente, envía con whatsapp.send (getNumberId, waitUntilMsgSent, comprobación en la página, fallo visible) y registra la decisión «Respondido por WhatsApp: …». Prueba con cliente simulado en tests/server.test.cjs: rechaza mensajes de demostración (400), envía a 34910000001@c.us y cierra el mensaje.
- Interfaz (src/ui/views.js, actions.js, styles.css): «Qué hacer ahora» (hasta tres mensajes con lectura pendiente y botón «Ver todos» que activa el filtro «Debes leer»); filtros con etiquetas claras; conversaciones agrupadas por proveedor con recuento y sin leer; detalle con mensaje original, «Tu decisión», lectura por reglas, «Prioridad y pedido», bloque «Responder y decidir» (respuestas rápidas por categoría + «Escribir respuesta», «Decidir y cerrar», revisado, vincular), «Más opciones» plegado con segunda lectura, IA, corregir lectura, prioridad y relevancia, y aviso final sobre aprendizaje frente a decisión. Diálogo de corrección con el mismo aviso.
- Guía: scripts/build-guide.cjs compila docs/GUIA_USO.md a src/ui/guide.js (JSON, sin HTML), incluido en npm run build y en el ejecutable; guidePage() lo muestra con índice y Markdown mínimo escapado (h2, párrafos, listas). Entrada «Guía» en la navegación y en las migas. docs/GUIA_USO.md y src/ai-help.cjs actualizados con las funciones nuevas; el .js generado está en .prettierignore.
- Pruebas de escritorio y captura de diseño: abren «Más opciones» antes de pulsar los botones plegados.

## Verificación
- npm test: 112/112 (antes 110). npm run format:check: limpio.
- Captura propia work/shot-messages.cjs (no versionada) a 1440×900 y 1000×700: output/design/mensajes/01–09 sin errores de página: lista con tres proveedores, diálogo de decisión, mensaje decidido, diálogo de corrección, guía e índice.
- Evidencia final (npm run package:win y npm run test:desktop) al pie.

## Límites
- Las respuestas rápidas son plantillas fijas por categoría; el usuario puede editarlas antes de enviar pero no guardar plantillas propias.
- La respuesta real por WhatsApp con teléfono no se ha ejecutado en esta sesión (prohibido en pruebas automáticas); la ruta reutiliza el envío ya probado con los números del usuario en 0.9.3.
- La guía se compila en build: si se edita docs/GUIA_USO.md sin reconstruir, la app muestra la versión anterior.

## Siguiente paso
Que el usuario pruebe una respuesta rápida con sus números; plantillas editables; revisar con datos reales si «Qué hacer ahora» debe incluir también entregas previstas para hoy.

## Evidencia final
- npm test: 112 aprobadas (reports/tests-2026-09-09-v0150.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.15.0-win32-x64.
- npm run test:desktop: 11 PASS (completa). reports/desktop-smoke-2026-09-09-v0150.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/schema.ts
 M docs/GUIA_USO.md
 M docs/WHATSAPP_PROVEEDORES.md
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M src/ai-help.cjs
 M src/index.html
 M src/server.cjs
 M src/styles.css
 M src/ui/actions.js
 M src/ui/core.js
 M src/ui/views.js
 M tests/domain.test.cjs
 M tests/server.test.cjs
?? .prettierignore
?? reports/2026-09-09T21-28-12-338Z-mensajes-guia-decisiones.md
?? reports/design/0150-guia.png
?? reports/design/0150-mensajes-decidido.png
?? reports/design/0150-mensajes.png
?? reports/desktop-smoke-2026-09-09-v0150.txt
?? reports/tests-2026-09-09-v0150.txt
?? scripts/build-guide.cjs
?? src/ui/guide.js
```
