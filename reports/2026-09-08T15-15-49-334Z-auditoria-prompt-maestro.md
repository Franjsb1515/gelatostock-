# Sesión 010 · Auditoría de 0.8.0, prompt maestro v2 y ajustes 0.8.1

## Objetivo
Auditar la entrega 0.8.0 (checklist, parches, mensajes de registro y TODO.md), redactar un prompt maestro mejorado para cualquier IA que continúe, incorporar una directriz de mejora continua en los documentos de continuidad y ejecutar ese prompt en la misma sesión con cambios mínimos verificados.

## Auditoría de la entrega 0.8.0
- Commit 452dcc4 y reports/patches/0001-feat-IA-local-Q4-...patch: idénticos (2909 líneas, mismas cabeceras). El .patch de sesión en reports/ omite archivos nuevos, como avisa el propio informe.
- Mensajes de registro: los cinco últimos commits tienen asunto claro pero sin cuerpo; el detalle vive en CHANGELOG.md y reports/. Coherente con AGENTS.md.
- npm test: 69/69 antes de cambios; npm run format:check correcto (work/audit-npm-test.txt, work/audit-format.txt).
- Ejecutable 0.8.0: runtime/models solo contiene qwen3 con model_q4.onnx; scripts/package.cjs copia únicamente el manifiesto. Modelos experimentales (minilm, qwen25, qwen3-17) solo en runtime de desarrollo, ignorados por Git.
- ZIP de fuentes 0.8.0: 99 archivos, sin data/, sessions, node_modules ni pesos. Faltaba AGENTS.md; el ZIP 0.8.1 lo incluye.
- Código IA (src/ai.cjs, ai-worker.cjs, ai-review.cjs): contrato estricto, evidencia del modelo descartada, un trabajo a la vez, timeout y cancelación correctos. Hallazgos:
  1. La comprobación de sumas solo aceptaba "IVA (21%)" con paréntesis y "Total"/"Total factura"/"Importe total": formatos frecuentes como "IVA 21%:" o "Total a pagar:" quedaban sin comprobar. Corregido con prueba nueva; se mantiene la abstención ante "IVA: 21%" sin importe y ante varias cuotas.
  2. El trabajador bloqueaba fetch, http/https, net y child_process, pero no tls, http2, dgram ni dns. Añadido. Sigue sin ser sandbox del sistema operativo: la dependencia nativa de ONNX queda fuera.
  3. scripts/evaluate-ai.cjs tenía el nombre "v08" y la etiqueta del modelo fijos. Ahora derivan de package.json y del manifiesto.
  4. El descuadre aritmético no bloquea la etiqueta (se calcula después de decidir bloqueo). Se mantiene: es deliberado y está probado ("coincidencia de lecturas no oculta importes incoherentes").
- Documentos: CHECKLIST_PRINCIPAL.md tenía estado 0.7 pero no 0.8; docs/TODO.md y PROMPT_MAESTRO.md decían que la app no existía. Se marcan como documentos de origen, sin modificar su contenido, y se añade el estado 0.8.1 con la evidencia disponible. Las casillas del checklist siguen abiertas porque exigen aceptación del negocio con datos reales.
- TODO.md raíz: coherente con el código. Actualizado a 0.8.1 (70 pruebas, auditoría hecha, sandbox real pendiente, arquitectura completa pendiente).

## Prompt maestro v2 y directriz
docs/PROMPT_MAESTRO_V2.md: papel, orden de lectura, directriz de mejora continua obligatoria, reglas no negociables, método por sesión, cómo informar calidad de IA, prioridades abiertas y autocomprobación. CLAUDE.md y AGENTS.md incorporan la directriz resumida y apuntan al prompt. La directriz pide auditar antes de construir, corregir al menos un hueco verificado con evidencia, no degradar garantías y corregir los propios prompts cuando induzcan a error.

## Cambios de código (0.8.1)
- src/ai-review.cjs: etiquetas "IVA 21%", "IVA (21 %)", "Cuota IVA 10%", "Total a pagar", "Importe a pagar".
- src/ai-worker.cjs: denegación adicional de tls, http2, dgram y dns (incluida la API de promesas).
- scripts/evaluate-ai.cjs: nombre y modelo por versión/manifiesto.
- tests/ai-review.test.cjs: prueba nueva de etiquetas y abstenciones.
- package.json, package-lock.json, ABRIR GELATOSTOCK.vbs: 0.8.1.

## Pruebas ejecutadas y resultados
- npm test: 70/70 aprobadas. reports/tests-2026-09-08-v081.txt.
- npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.8.1-win32-x64 creado; runtime/models solo qwen3.
- npm run test:desktop: 5 PASS con modelo real (entregas, factura, tarifa, cancelación, OCR/persistencia/reinicio). reports/desktop-smoke-2026-09-08-v081.txt.
- node scripts/evaluate-ai.cjs --quick con modelo real: 2/3 igual que en 0.8.0. Petición de factura: mensaje, lecturas coincidentes. Proforma: discrepancia entre lecturas, queda Por revisar (pass:false conservado). Factura con total incoherente: factura y descuadre detectado. Pico RSS 2.270 MiB; latencias 33–66 s en este recorrido (más lentas que las 25–30 s de 0.8.0, con otras cargas en la máquina). reports/ai-evaluation-v081-quick.json. Ese archivo se generó con un nombre defectuoso ("v-quick") por un escape mal escrito en el script; se corrigió el script y se renombró el archivo sin alterar su contenido.
- Los cambios de etiquetas no alteran esta evaluación: sus fixtures ya usaban el formato antiguo. El beneficio se prueba en tests/ai-review.test.cjs, no con el modelo.

## Limitaciones
- La auditoría cubrió el código de IA, el empaquetado y los documentos; no se revisó a fondo core/, servidor ni WhatsApp. Queda en TODO.md.
- El bloqueo de módulos de red es defensa en profundidad dentro de Node; la dependencia nativa de ONNX no está aislada.
- Sin corpus real: el 2/3 sigue siendo una evaluación sintética de desarrollo, no precisión.
- Mac y 8 GB sin medir. QR y recepción real sin probar con el teléfono del usuario.
- Sin commit: los cambios quedan en el árbol de trabajo para revisión del usuario; el .patch adjunto es git diff HEAD y no incluye los archivos nuevos (docs/PROMPT_MAESTRO_V2.md, este informe, evidencias v081). El ZIP sí los incluye.

## Siguiente paso
1. Revisar y confirmar commit de 0.8.1.
2. Corpus autorizado de documentos reales anonimizados y medición de cobertura/abstención/error por separado.
3. Prueba QR y recepción con el teléfono del usuario cuando lo autorice.
4. Seguir la directriz de mejora continua de docs/PROMPT_MAESTRO_V2.md en cada sesión.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M AGENTS.md
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M docs/CHECKLIST_PRINCIPAL.md
 M docs/IA_LOCAL_Y_SEGURIDAD.md
 M docs/PROMPT_MAESTRO.md
 M docs/TODO.md
 M package-lock.json
 M package.json
 M scripts/evaluate-ai.cjs
 M src/ai-review.cjs
 M src/ai-worker.cjs
 M tests/ai-review.test.cjs
?? docs/PROMPT_MAESTRO_V2.md
?? reports/2026-09-08T15-15-49-334Z-auditoria-prompt-maestro.md
?? reports/ai-evaluation-v081-quick.json
?? reports/desktop-smoke-2026-09-08-v081.txt
?? reports/tests-2026-09-08-v081.txt
```
