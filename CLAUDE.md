# Entrada para Claude · entrega vigente 0.7.0

Lee AGENTS.md, README.md, TODO.md, el último informe de reports/ y docs/IA_LOCAL_Y_SEGURIDAD.md. El usuario solicita revisión y mejoras justificadas, manteniendo trabajo en D y funcionamiento local. Ejecuta pruebas antes de proponer reescrituras.

Núcleo TypeScript estricto en core/, salida build/ generada. Interfaz/servidor/Electron en src/. SQLite y attachments son canónicos; carpetas por proveedor son copias derivadas, no otra base editable. Preserva migración del JSON y datos existentes.

OCR español real para texto/proveedor de fotos. IA real Qwen3 0.6B Q8 para tipo propuesto y fragmento contrastado; no confundirla con las reglas de mensajes. Un resumen libre se descartó por alucinaciones en pruebas adversarias. La evidencia literal no garantiza que la etiqueta sea correcta. No permitir acciones del modelo. Binarios/modelos dentro del ejecutable; fuentes excluyen pesos, descargables con scripts/setup-ai-model.cjs y manifiesto fijado.

Control de entregas: cantidades recibidas en unidad base, solo incrementales; presentaciones del pedido son snapshots. No mezclar kg/L/ud ni sumar stock por envío. Pedidos todavía simulados.

WhatsApp experimental: QR real probado sin vincular cuenta. Recepción/cambio de dos números reales pendientes de prueba con el usuario. No exportar data/whatsapp/sessions ni historial privado. QR aplazado en esta sesión a petición del usuario; no auto-conectar por revisar la app.

Pruebas: npm test; npm run format:check; npm run package:win; npm run test:desktop. Esta última incluye inferencia real y tarda más que unitarias. GELATO_TEST_QR=1 solo con prueba explícita. Usa fixtures en work/, nunca borres datos reales para probar. Mac no validado. Revisar seguridad, firma de paquetes, almacenamiento y rendimiento con hardware/documentos reales antes de producción.

Cierre de sesión: informe nuevo + CHANGELOG + TODO + pruebas reales + reconstrucción del ejecutable si cambió src. Conservar informes anteriores y entregar ZIP sin datos, credenciales, node_modules ni binarios.
