# Entrada para Claude · entrega vigente 0.22.0

Lee docs/PROMPT_MAESTRO_V2.md (prompt operativo), AGENTS.md, README.md, TODO.md, el último informe de reports/ y docs/IA_LOCAL_Y_SEGURIDAD.md. El usuario solicita revisión y mejoras justificadas, manteniendo trabajo en D y funcionamiento local. Ejecuta pruebas antes de proponer reescrituras.

## Directriz de mejora continua
Toda IA que lea este proyecto debe dejarlo mejor de lo que lo encontró: auditar (pruebas, formato, coherencia informe/parche/commit, código tocado), corregir al menos un hueco verificado con evidencia, no degradar garantías (abstenciones de IA, permisos, datos canónicos, copias) y actualizar los documentos de continuidad, incluido este y PROMPT_MAESTRO_V2.md, si llevan a error. Ninguna afirmación sin salida de comando o captura que la respalde. Detalle en docs/PROMPT_MAESTRO_V2.md, sección 3.

Núcleo TypeScript estricto en core/, salida build/ generada. Interfaz/servidor/Electron en src/. SQLite y attachments son canónicos; carpetas por proveedor son copias derivadas, no otra base editable. Preserva migración del JSON y datos existentes.

OCR español real para texto/proveedor de fotos. IA real Qwen3 0.6B Q4 para tipo propuesto y original mostrado por la app; no confundirla con las reglas de mensajes. Un resumen libre se descartó por alucinaciones en pruebas adversarias. La evidencia generada por el modelo se descarta; se muestra el inicio del original. Eso no garantiza que la etiqueta sea correcta. No permitir acciones del modelo. Binarios/modelos dentro del ejecutable; fuentes excluyen pesos, descargables con scripts/setup-ai-model.cjs y manifiesto fijado.

Control de entregas: cantidades recibidas en unidad base, solo incrementales; presentaciones del pedido son snapshots. No mezclar kg/L/ud ni sumar stock por envío. Pedidos todavía simulados.

WhatsApp: el usuario vinculó por QR y cambió entre sus dos números propios (2026-09-08). Desde 0.9.1 hay envío real de pedidos con vista previa, confirmación explícita, solo a chats autorizados y una vez por pedido; el usuario autorizó probarlo con sus propios números. Nunca enviar sin su confirmación en pantalla ni en pruebas automáticas. No exportar data/whatsapp/sessions ni historial privado. No auto-conectar QR por revisar la app.

Pruebas: npm test; npm run format:check; npm run package:win; npm run test:desktop. Esta última incluye inferencia real y tarda más que unitarias. node scripts/evaluate-ai.cjs --quick para cambios en IA (modelo real, conserva pass:false). GELATO_TEST_QR=1 solo con prueba explícita. Usa fixtures en work/, nunca borres datos reales para probar. Mac no validado. Revisar seguridad, firma de paquetes, almacenamiento y rendimiento con hardware/documentos reales antes de producción.

Cierre de sesión: informe nuevo + CHANGELOG + TODO + pruebas reales + reconstrucción del ejecutable si cambió src. Conservar informes anteriores y entregar ZIP sin datos, credenciales, node_modules ni binarios.

## Punto de continuidad 0.9.3
Lee reports/2026-09-08T18-40-07-473Z-diagnostico-whatsapp.md. Sesión 014: el usuario reportó que con QR conectado no llegaba nada en ninguna dirección (canal sin mensajes ni envíos). Se añadió resolución de remitentes LID, diagnóstico local del canal (data/whatsapp/diagnostico.log, visible en la app) y envío de prueba a chats autorizados. El registro real mostró recepción correcta (descartes por autorización de otra cuenta: cada cuenta vinculada tiene su lista) y envío silenciosamente fallido por chat inexistente para número@c.us; corregido resolviendo el id con getNumberId/LID y fallando de forma visible. Pendiente que el usuario repita la prueba.

## Punto de continuidad 0.9.1
Lee reports/2026-09-08T18-16-51-221Z-envio-whatsapp-real.md. Sesión 013: envío real por WhatsApp (src/whatsapp.cjs send, tabla sent, acción send con dispatch, /api/whatsapp preview/send, botón en Control de entregas). Probado con cliente simulado; la prueba con teléfono real la hace el usuario. 85 pruebas.

## Punto de continuidad 0.9.0
Lee reports/2026-09-08T16-18-04-876Z-recetas-produccion-respuestas.md. Sesión 012: recetas/producción (consumo estimado por reglas, aprobado y corregible por la persona; producto terminado; hoja diaria; SQLite user_version 2) y lectura de respuestas de proveedores por reglas en core/messages.ts con segunda lectura opcional del modelo (acción aiNote, solo anota). Precisión en respuestas: reglas afinadas con corpus de 80 (60 desarrollo + 20 reservado, 75 % en la primera pasada) son la lectura principal; los modelos locales miden 55/80 (0.6B) y 36/80 (1.7B) y son manipulables: no sustituir reglas por modelo sin cifras. Auditoría de seguridad con sonda work/attack.cjs 26/26; clave fuera de la URL; caché validada del estado. Decisiones del usuario: descuento solo tras aprobación; producto terminado sí; la IA debe entender respuestas libres, por eso reglas + modelo; QR de WhatsApp aplazado. 80 pruebas.

## Punto de continuidad 0.8.2
Lee reports/2026-09-08T15-51-40-496Z-chat-dudas-ia.md y, antes, reports/2026-09-08T15-15-49-334Z-auditoria-prompt-maestro.md. Sesión 011 añadió el chat de dudas (src/ai-help.cjs guía fija; src/ai.cjs chat(); ruta /api/ai/chat) sin acceso a datos ni acciones. Un intento de reforzar los prompts para proforma/abono empeoró la evaluación completa (7/11 frente a 10/11): se conservan los prompts originales; reports/ai-evaluation-v082.json es la línea base de 11 casos y ai-evaluation-v082-prompts-explicitos.json el intento descartado. Cambiar prompts exige repetir esa evaluación. La versión ya se lee de package.json en servidor e interfaz. 72 pruebas.

 Sesión 010 auditó la entrega 0.8.0 de ChatGPT: parche de commit idéntico a 452dcc4, 69/69 pruebas y formato correctos, código de IA revisado. Cambios mínimos: etiquetas habituales de IVA/total en la comprobación aritmética (menos abstenciones sin ampliar interpretación), bloqueo adicional de tls/http2/dgram/dns en el trabajador (sigue sin ser sandbox de SO) y nombre de evaluación por versión. 70 pruebas.

Q4 fue elegido tras comparar variantes: no asumir que un modelo mayor será mejor en este equipo. Experimentos descartados quedan en work/runtime de desarrollo, excluidos del ejecutable y ZIP de fuentes; scripts/package.cjs copia solo el modelo definido en el manifiesto. No incluir modelos ajenos al manifiesto al empaquetar.

Doble lectura del mismo modelo con prompts distintos, sin independencia estadística. src/ai-review.cjs contiene reglas, NO razonamiento neuronal. La coincidencia no da permiso para actuar. Control monetario limitado a un esquema base/cuota/total sin otros conceptos; no es validación fiscal.

Evaluación completa 0.8.2: 10/11 con los prompts vigentes, ningún error aceptado; proforma queda Por revisar y el archivo conserva pass:false deliberadamente; no ocultar abstenciones ni llamar a eso exactitud perfecta. Pruebas de seguridad/funcionamiento son distintas de métricas de calidad de clasificación. Sigue pendiente razonamiento general avanzado y corpus representativo.

El usuario pide respuestas MUY breves en chat; informes técnicos completos en estos documentos. Antes de cambiar archivos, comprobar git status para evitar pisar cambios de otro colaborador.
