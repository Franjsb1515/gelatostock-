# Sesión 027 · IA local con reglas primero, más rápida, y compra en webs · versión 0.16.0

## Encargo
El usuario aceptó hacer la compra en webs (Makro u otras) sin tener cuentas todavía y pidió subir la IA local a 8/10 como mínimo.

## Diagnóstico previo (medido)
- Línea base 0.15.1, corpus de 11 documentos: 10/11 · 21 s por lectura reforzada (proforma fallaba; reports/ai-evaluation-v0151.json).
- Tiempo: cada trabajo creaba un trabajador y cargaba el modelo (5–7 s); el modelo escribía 45–65 tokens de «evidencia» que nunca se mostraban; 2 hilos. Lecturas reforzadas de 23–61 s en las pruebas de escritorio.
- Chat: prompt con toda la guía (≈4.500 caracteres) y sin evaluación.

## Cambios
- Reglas primero para documentos (src/ai-review.cjs classifyDocument) con normalización de OCR; modelo como segunda opinión; contrato de reviewReading actualizado (tres pruebas cambiadas, ver docs/IA_LOCAL_Y_SEGURIDAD.md). Corpus 2 de 40 documentos (tests/fixtures/ai-documents-2.json) y prueba de regresión de reglas sobre los 51.
- Trabajador persistente (src/ai.cjs ensureWorker/terminateWorker, idle 3 min), hilos 2–4 según CPU (GELATO_AI_THREADS), salida del modelo {"tipo"} con 24 tokens.
- Chat: src/ai-guide.cjs (recuperación de párrafos con sinónimos, prompt más corto y respuesta fija cuando no cubre); evaluación --chat con tests/fixtures/ai-chat.json.
- scripts/evaluate-ai.cjs: modos --docs2, --chat, --replies con tiempos y aciertos de reglas, modelo y combinado.
- Pantalla IA local: muestra «Reglas: … (confianza) · Modelo: …».
- Compra en webs: campo web (https) en proveedores, enlace en la ficha, «Lista para …» en el carrito con copia y apertura de la web; Electron abre solo webs guardadas. Guía y chat actualizados.

## Resultados
- Documentos (51, sintéticos): 51/51 combinado · reglas 51/51 · modelo solo 38/51 · 6.4 s por lectura reforzada.
- Chat (16 preguntas): 16/16 · 0.6 s por respuesta.
- Respuestas de proveedores (12): modelo 7/12 · reglas 12/12 · 7.1 s.
- Pruebas unitarias: 117. Evidencia final al pie.

## Límites honestos
- Los corpus los escribió la misma sesión que las reglas: sirven como regresión, no como medida de precisión real. Faltan documentos y mensajes reales del negocio.
- El modelo 0.6B sigue siendo lento en chat (10–25 s) y manipulable; por eso no decide nada y las reglas mandan.
- La compra en webs no se automatiza: sin API pública, con cuenta y pago de la persona. Cuando tenga cuenta, solo hay que guardar la web en la ficha.

## Evidencia final
- npm test: 118 aprobadas (reports/tests-2026-09-09-v0160.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.16.0-win32-x64.
- npm run test:desktop: 11 PASS (completa). reports/desktop-smoke-2026-09-09-v0160.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/schema.ts
 M docs/GUIA_USO.md
 M docs/IA_LOCAL_Y_SEGURIDAD.md
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M scripts/evaluate-ai.cjs
 M src/ai-help.cjs
 M src/ai-review.cjs
 M src/ai-worker.cjs
 M src/ai.cjs
 M src/desktop.cjs
 M src/server.cjs
 M src/styles.css
 M src/ui/actions-extended.js
 M src/ui/actions.js
 M src/ui/guide.js
 M src/ui/views.js
 M tests/ai-review.test.cjs
 M tests/ai.test.cjs
 M tests/domain.test.cjs
?? reports/2026-09-09T23-43-12-728Z-ia-reglas-primero-y-webs.md
?? reports/ai-chat-v0160.json
?? reports/ai-evaluation-v0151.json
?? reports/ai-evaluation-v0160-docs2.json
?? reports/ai-replies-v0160.json
?? reports/design/0160-ia-reglas.png
?? reports/design/0160-lista-web.png
?? reports/design/0160-proveedores.png
?? reports/desktop-smoke-2026-09-09-v0160.txt
?? reports/tests-2026-09-09-v0160.txt
?? src/ai-guide.cjs
?? tests/fixtures/ai-chat.json
?? tests/fixtures/ai-documents-2.json
```
