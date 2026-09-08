# Entrada para Claude · entrega vigente 0.8.0

Lee AGENTS.md, README.md, TODO.md, el último informe de reports/ y docs/IA_LOCAL_Y_SEGURIDAD.md. El usuario solicita revisión y mejoras justificadas, manteniendo trabajo en D y funcionamiento local. Ejecuta pruebas antes de proponer reescrituras.

Núcleo TypeScript estricto en core/, salida build/ generada. Interfaz/servidor/Electron en src/. SQLite y attachments son canónicos; carpetas por proveedor son copias derivadas, no otra base editable. Preserva migración del JSON y datos existentes.

OCR español real para texto/proveedor de fotos. IA real Qwen3 0.6B Q4 para tipo propuesto y original mostrado por la app; no confundirla con las reglas de mensajes. Un resumen libre se descartó por alucinaciones en pruebas adversarias. La evidencia generada por el modelo se descarta; se muestra el inicio del original. Eso no garantiza que la etiqueta sea correcta. No permitir acciones del modelo. Binarios/modelos dentro del ejecutable; fuentes excluyen pesos, descargables con scripts/setup-ai-model.cjs y manifiesto fijado.

Control de entregas: cantidades recibidas en unidad base, solo incrementales; presentaciones del pedido son snapshots. No mezclar kg/L/ud ni sumar stock por envío. Pedidos todavía simulados.

WhatsApp experimental: QR real probado sin vincular cuenta. Recepción/cambio de dos números reales pendientes de prueba con el usuario. No exportar data/whatsapp/sessions ni historial privado. QR aplazado en esta sesión a petición del usuario; no auto-conectar por revisar la app.

Pruebas: npm test; npm run format:check; npm run package:win; npm run test:desktop. Esta última incluye inferencia real y tarda más que unitarias. GELATO_TEST_QR=1 solo con prueba explícita. Usa fixtures en work/, nunca borres datos reales para probar. Mac no validado. Revisar seguridad, firma de paquetes, almacenamiento y rendimiento con hardware/documentos reales antes de producción.

Cierre de sesión: informe nuevo + CHANGELOG + TODO + pruebas reales + reconstrucción del ejecutable si cambió src. Conservar informes anteriores y entregar ZIP sin datos, credenciales, node_modules ni binarios.

## Punto de continuidad 0.8
Lee reports/2026-09-08T09-40-35-511Z-ia-reforzada.md. Q4 fue elegido tras comparar variantes: no asumir que un modelo mayor será mejor en este equipo. Experimentos descartados quedan en work/runtime de desarrollo, excluidos del ejecutable y ZIP de fuentes; scripts/package.cjs copia solo el modelo definido en el manifiesto. No incluir modelos ajenos al manifiesto al empaquetar.

Doble lectura del mismo modelo con prompts distintos, sin independencia estadística. src/ai-review.cjs contiene reglas, NO razonamiento neuronal. La coincidencia no da permiso para actuar. Control monetario limitado a un esquema base/cuota/total sin otros conceptos; no es validación fiscal.

Evaluación rápida: 2/3 clasificaciones exactas; proforma quedó Por revisar. El archivo conserva pass:false deliberadamente; no ocultar abstenciones ni llamar a eso exactitud perfecta. Pruebas de seguridad/funcionamiento son distintas de métricas de calidad de clasificación. El modo de razonamiento largo en Qwen3 1.7B se descartó por latencia. Sigue pendiente razonamiento general avanzado y corpus representativo.

El usuario pide respuestas MUY breves en chat; informes técnicos completos en estos documentos. Antes de cambiar archivos, comprobar git status para evitar pisar cambios de otro colaborador.
