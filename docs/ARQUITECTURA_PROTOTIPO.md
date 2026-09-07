# Arquitectura vigente — 0.2.0

## Decisión y razones

Mantener Electron 44.2.0 para la entrega verificable actual; migrar el núcleo a TypeScript estricto y la persistencia a SQLite. Esta recomendación prioriza integridad, recuperación y mantenibilidad. No existe un lenguaje universalmente más profesional: importa qué se puede medir y mantener. No se recomienda una reescritura por estética.

Tauri + TypeScript + Rust + SQLite es candidato para reducir el peso de distribución. No se ha implementado: este entorno no dispone del toolchain Rust y no permite medir el Mac del usuario. Claude debe comparar tamaño, arranque, memoria en reposo y con OCR/modelo, empaquetado, accesibilidad y mantenimiento antes de cambiar. Requisitos oficiales: https://v2.tauri.app/start/prerequisites/ .

## Componentes

- core/schema.ts: contratos Zod e inferencia de tipos; validación de datos importados y acciones.
- core/domain.ts y core/seed.ts: reglas y datos de demostración, sin llamadas de red.
- core/store.ts: node:sqlite, transacciones, migración y adjuntos. SQLite está incluido en Electron; no hay complemento nativo externo que recompilar. API: https://nodejs.org/api/sqlite.html .
- build/: JavaScript generado por TypeScript; no editar a mano.
- src/domain.cjs: puente para compatibilidad de pruebas.
- src/server.cjs: HTTP loopback autenticado; exige revisión e identificador para acciones.
- src/desktop.cjs: ventana aislada; src/app.js y CSS/HTML: interfaz actual.

TypeScript estricto cubre el núcleo, no toda la aplicación. NodeIntegration desactivado, contextIsolation y sandbox activos. Cookie HttpOnly/SameSite, validación de origen para escrituras y recursos del renderer locales. No hay secretos de proveedores en esta versión.

## Persistencia

SQLite con WAL, synchronous FULL, claves foráneas, comprobación de integridad al abrir y BEGIN IMMEDIATE para mutaciones. Tablas de productos, proveedores, pedidos/líneas, carrito, mensajes, actividad, movimientos, fotos, operaciones y metadatos. Se conservan payloads JSON validados junto a columnas relacionales: es una solución incremental, no una normalización exhaustiva.

Cantidades almacenadas en milésimas y dinero en céntimos. Las unidades ud deben ser enteras. Las líneas de pedido conservan sus condiciones originales. Las revisiones detectan clientes obsoletos; IDs con huellas de contenido previenen duplicación tras reiniciar. Dos conexiones están probadas para conflictos; esto no implementa sincronización entre equipos.

Cada movimiento registra antes, después, motivo y fecha. Revertir crea una compensación y conserva el original. Las recepciones no se revierten desde el botón genérico: falta un flujo específico de devoluciones.

La migración valida stock.json, deja el original intacto y exporta una copia previa. Un archivo inválido no se reemplaza con ejemplos. Las fotografías se almacenan por SHA-256 en attachments, validando cabecera/tamaño y deduplicando contenido. La API del estado entrega referencias; la exportación incluye imágenes para permitir restaurar en otro equipo.

Las escrituras actualizan solo filas cambiadas. Una prueba con 30 registros previos verifica cuatro filas modificadas para un conteo sin ID: producto, movimiento, actividad y revisión. No se reescribe todo el historial ni las imágenes en cada operación.

## Límites y próximos pasos

El estado estructurado todavía se carga completo en memoria y la exportación es un JSON en memoria, limitada a 100 MB. Fotos individuales: máximo 5 MB. Antes de gran volumen: paginación, copias en flujo, política de retención y mediciones con datos representativos. No hay cifrado de base de datos ni permisos por usuario.

Se prueba rollback por error, cierre de proceso sin commit, migración, restauración y conflictos. No se ha probado corte eléctrico físico, disco lleno ni corrupción del sistema de archivos. No prometer recuperación absoluta. La prueba offline bloquea recursos externos del renderer y mantiene loopback; no desconecta físicamente la red.

WhatsApp, OCR, modelo local y Makro siguen pendientes. Las reglas de mensajes son simuladas y las fotos son referencias manuales. El destino es un modelo redistribuible integrado y activable dentro de la app, con correcciones aprobadas guardadas; el stock y los pedidos ordinarios deben seguir operativos sin él. Enviar/recibir mensajes externos requiere internet; preparar y consultar datos seguirá siendo local.

Distribución actual Windows portátil verificada. Falta instalador firmado y paquete Mac con pruebas en hardware real. El Mac mencionado por el usuario debe confirmarse mediante sus especificaciones antes de seleccionar un modelo de IA.
