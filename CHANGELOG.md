# Registro de parches y sesiones

## 0.2.0 — 2026-09-07 · sesión 002

Migración de JSON a SQLite transaccional con copia previa y fotografías separadas. Núcleo TypeScript estricto con contratos Zod. Movimientos con motivo y corrección trazable, edición de productos/proveedores y cancelación pendiente. IDs persistentes con huella y detección de revisiones obsoletas. Escrituras incrementales sin reescribir el historial. Errores visibles dentro de los diálogos.

29 pruebas aprobadas y ejecutable Windows reconstruido y probado con reinicio. Informe: reports/2026-09-07-002-sqlite-typescript.md. Electron se conserva por la entrega comprobable; evaluar Tauri en el Mac real. No se incorporó IA ni conectores externos.

## 0.1.0 — 2026-09-07 · sesión 001

Primera entrega funcional del prototipo local. Interfaz de escritorio con resumen, inventario, compras, mensajes, proveedores, actividad y configuración. Datos de demostración persistentes, copias y fotos manuales. Pedidos simulados con recepción parcial y prevención de reintentos duplicados.

Se verificaron reglas de negocio, servidor local, ejecución Windows y persistencia tras reinicio. Se corrigieron durante la sesión icono de página ausente, legibilidad en ventanas bajas y validación de identificadores importados.

Detalles y evidencias: reports/2026-09-07-001-prototipo.md. La IA/OCR, WhatsApp, Makro y distribución Mac siguen pendientes.

Cada sesión futura debe añadir una entrada con problema, resultado, pruebas y referencia a su informe. No sobrescribir esta historia.
