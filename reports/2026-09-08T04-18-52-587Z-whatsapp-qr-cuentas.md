# Sesión 007 — 2026-09-08 — WhatsApp QR y cuentas separadas, versión 0.6.0

## Solicitud y resultado

El usuario autorizó probar su WhatsApp mediante QR, permitir WhatsApp normal o Business, cambiar sesión/número y conservar la procedencia de las conversaciones con una mención histórica del cambio. Se implementa un conector experimental de WhatsApp Web, sin envío de mensajes. La vía no oficial y sus limitaciones se explicaron antes y durante esta sesión.

## Implementación

Pantalla WhatsApp: QR real, estado de conexión, número propio conectado, autorización explícita de proveedor/contacto, consulta de últimos 200 mensajes por cuenta, últimos 100 eventos de historial, cierre/cambio de sesión y copia separada. Actualización de la vista cada 2 segundos; recepción del transporte mediante eventos.

src/whatsapp-store.cjs: SQLite independiente en data/whatsapp/whatsapp.sqlite. Cuentas por hash del número completo, lista autorizada por cuenta, mensajes con clave (cuenta, ID original), número remitente y fecha original. Registrar otra cuenta no mueve mensajes previos. Historial registra número anterior → nuevo, cierre y cambios de permisos. Volver al mismo número conserva su historial/lista.

src/whatsapp.cjs: whatsapp-web.js 1.34.7 con LocalAuth; cada ciclo de cambio usa identificador de sesión nuevo. Perfiles en data/whatsapp/sessions. Se filtra remitente exacto antes de descarga/persistencia; se resuelven identificadores LID cuando el transporte lo permite. Se ignoran grupos, estados y mensajes propios. No se extrae historial masivo ni se importan mensajes anteriores a la conexión actual. Epoch de conexión evita insertar respuestas tardías de la cuenta anterior.

Los adjuntos admitidos son JPEG/PNG/WebP/PDF, hasta 10 MB, con validación de cabecera. Archivo por cuenta/proveedor o contacto/fecha UTC. Si el tamaño conocido supera el límite no se descarga; cuando el transporte no anuncia tamaño se valida después de descargar. Fallos/no admitidos se indican en el texto. No hay OCR automático ni clasificación de tipo comercial en este canal todavía.

Cerrar sesión mientras está conectada intenta logout remoto; si falla se avisa para revisar Dispositivos vinculados del teléfono. Si se cambia desde un estado ya desconectado/sin cliente, el cambio es local: verificar y revocar el dispositivo anterior en el teléfono. Cerrar la app conserva sesión para reconectar manualmente después; no recibe mientras está cerrada. El perfil del navegador puede sincronizar información de la cuenta completa, aunque la base de GelatoStock solo importe números autorizados.

Copia de WhatsApp: SQLite consistente mediante VACUUM INTO y archivos asociados, sin carpeta de credenciales. Independiente de las copias de inventario. Restauración de WhatsApp manual con app cerrada; interfaz de restauración unificada pendiente. No borrar perfiles manualmente sin confirmar que pertenecen a la app.

## Dependencias y distribución

Se incluye Chrome for Testing 152.0.7977.75 en runtime/browser y configuración relativa runtime/browser.json. No se exige Chrome instalado en otro lugar. Paquete Windows completo; Mac requiere empaquetado y validación propios.

La dependencia inicial Puppeteer 24.38 tenía alertas por extract-zip. Se fijó override Puppeteer 25.10.0, con audit final de producción sin vulnerabilidades reportadas. La API de cierre cambió: se usa browser.close directamente y compatibilidad isConnected para logout. Se comprobó QR con esta combinación; no se asume compatibilidad futura automática.

## Pruebas y problemas corregidos

- npm test: compilación TypeScript y 55/55 pruebas aprobadas.
- Nuevas pruebas: separación de cuentas, evento duplicado por cuenta, revocación sin borrado, no descargar remitentes ajenos, rechazo de evento de sesión antigua, procedencia del mensaje, persistencia y respaldo sin credenciales.
- Se corrigieron placeholders de inserción y parámetros de consulta por cuenta detectados durante pruebas. No se eliminaron pruebas para ocultar fallos.
- Servidor HTTP inicialmente dejaba SQLite abierto por cierre asíncrono; corregido cierre inmediato cuando no hay cliente y cierre idempotente cuando existe.
- La primera prueba QR obtuvo QR pero dejó Chrome abierto por cambio de API Puppeteer. Se corrigió y cerraron solo procesos aislados de esa prueba. El ejecutable final cierra correctamente durante la prueba de reinicio.
- npm run format:check aprobado. npm audit --omit=dev: 0 vulnerabilidades reportadas.
- npm run package:win aprobado.
- GELATO_TEST_QR=1 npm run test:desktop aprobado sobre ejecutable: QR real de WhatsApp sin vincular cuenta, interfaz de historial, más todos los flujos anteriores de OCR/stock/mensajes y reinicio.
- Evidencias: reports/tests-2026-09-08-v06.txt y reports/desktop-smoke-2026-09-08-v06.txt; captura sin QR ni datos personales en output/playwright/v06-whatsapp.png.

## Activación y límites de validación

Se respaldó el inventario y se abrió 0.6 con --connect-whatsapp para mostrar la pantalla de QR al usuario. Escanear con su teléfono es un paso pendiente del usuario. La recepción con su número y el cambio entre dos números reales no se han validado aún; las pruebas de cuentas usan datos sintéticos. No se enviaron mensajes a terceros.

Recepción experimental, dependiente de cambios de WhatsApp Web. Sin garantías de recuperación de mensajes mientras estuvo cerrada; sin envío, respuestas, lectura OCR del adjunto entrante ni clasificación factura/tarifa. Mensajes simulados del prototipo y WhatsApp real permanecen en secciones separadas. No reutilizar la etiqueta simulated del dominio antiguo para representar conversaciones reales.

## Fuentes

https://docs.wwebjs.dev/Client.html
https://wwebjs.dev/guide/creating-your-bot/authentication.html

El código de versiones instaladas se inspeccionó. El QR no se guardó en informes ni se copió al ZIP de código. Perfiles/credenciales e historiales personales quedan excluidos de Git y del paquete para Claude.

Comprobación final: inventario idéntico tras abrir 0.6. Al comprobar el estado había cero cuentas vinculadas; el escaneo sigue pendiente. Captura de la pantalla desconectada revisada sin datos personales.
