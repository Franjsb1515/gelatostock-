# GelatoStock · prototipo 0.22.0

Aplicación local de escritorio para gelatería, café de especialidad y postres. Esta entrega permite probar el circuito; no es aún la aplicación final de producción.

## Abrir en este Windows

Haz doble clic en **ABRIR GELATOSTOCK.vbs**, en esta carpeta. Abre una ventana propia, sin terminal. No requiere Node, Python, navegador ni conexión para usar el ejecutable ya generado. Si Windows bloquea VBScript, puedes abrir `dist/GelatoStock-0.22.0-win32-x64/GelatoStock.exe` directamente; en ese caso los datos se guardan dentro de esa carpeta portátil.

El acceso principal guarda datos, copias y perfil del programa en `D:/APPGELATOSTOCK/data`. Temporales de los procesos lanzados desde el acceso: `work/`. No se ha configurado almacenamiento del proyecto en C. Windows puede generar sus propios registros del sistema fuera del control de la app.

No mover el ejecutable aislado: necesita el resto de archivos de su carpeta. Para copiarlo a otro Windows x64, copiar toda la carpeta `dist/GelatoStock-0.22.0-win32-x64` a una ubicación donde el usuario pueda escribir. Arranca con ejemplos nuevos, salvo que se restaure una copia. No sincroniza equipos.

## Qué puedes probar

1. Registrar stock mediante conteo o crear un producto.
2. Filtrar y buscar productos; revisar mínimos y presentaciones.
3. Preparar reposición y editar el carrito.
4. Autorizar pedidos ficticios por proveedor y simular su envío.
5. Registrar cantidades recibidas, incluida una entrega parcial.
6. Simular mensajes y ver prioridad, texto original y revisión.
7. Vincular un mensaje al pedido del mismo proveedor.
8. Guardar fotos como referencia manual.
9. Crear y restaurar copias en Configuración.
10. Consultar el historial de movimientos y cerrar/reabrir sin perder datos.

Todos los proveedores, precios y datos iniciales son ficticios. La aplicación no realiza pagos. Desde 0.9.1 puede enviar un pedido por WhatsApp (y desde 0.15.0 responder a un mensaje) solo si tú lo confirmas en pantalla, al número de la ficha del proveedor autorizado para la cuenta vinculada.

## Qué está pendiente

Lectura automática de cantidades/PDF, validación de WhatsApp con el teléfono del usuario, webhooks externos, Makro España, recetas/ventas, sincronización, instalador firmado y paquete Mac validado. La interfaz señala esas limitaciones. Los mensajes se clasifican con reglas; las fotos se leen para proponer proveedor, sin extraer cantidades.

La base actual es SQLite con transacciones y fotografías separadas. Al abrir esta versión, migra el antiguo stock.json si existe, conserva el original y genera una copia previa en data/backups. Desde entonces la fuente vigente es data/gelatostock.sqlite. Usar las copias exportadas desde Configuración para trasladar datos: incluyen las fotografías. No copiar solo un SQLite abierto ni seguir operando en el ejecutable 0.1.

Nuevas funciones: entradas, salidas y mermas con motivo; corrección mediante un movimiento compensatorio; edición de productos y proveedores; alta de proveedores y cancelación de pedidos pendientes. Cambiar una presentación no modifica pedidos ya autorizados. La unidad base se conserva para proteger el historial.

## Para Claude o cualquier IA que continúe

Leer, en este orden:

1. `CLAUDE.md` / `AGENTS.md`.
2. `docs/PROMPT_MAESTRO_V2.md` y el informe más reciente de `reports/`.
3. `TODO.md` y `CHANGELOG.md`.
4. `docs/ARQUITECTURA_PROTOTIPO.md`.
5. Los cinco documentos originales de `docs/`, empezando por `PROMPT_MAESTRO.md`.

Los documentos originales describen la meta completa; no son una lista de funciones ya implementadas. El TODO de la raíz refleja la entrega actual.

## Desarrollo

Requiere Node 24 o compatible y npm. Todas las dependencias están en `package-lock.json`. Para reconstruir desde una copia solo del código:

```text
npm ci
node node_modules/electron/install.js
npm start
```

El ejecutable distribuido no necesita estos pasos. Electron 44 descarga el runtime mediante el comando de instalación explícito; mantener su caché en el disco de trabajo. `.npmrc` fija la caché de esta máquina en D: adaptar esa ruta al desarrollar en Mac.

```text
npm test                 # Compilación estricta, reglas, SQLite y servidor local
npm run test:desktop     # Ejecutable Windows, persistencia y recursos externos bloqueados
npm run package:win      # Reconstruir dist después de cambios de código
npm run session:new -- titulo-de-la-sesion
```

`npm run dev` abre un servidor solo en 127.0.0.1 y muestra una URL de sesión: es una herramienta de desarrollo, no el modo de uso habitual. No publicar ni compartir esa URL.

## Evidencias

`reports/tests-2026-09-08-v081.txt`, `reports/desktop-smoke-2026-09-08-v081.txt` y capturas en `output/playwright/`. Mac y A18 Pro no se han probado en este entorno Windows. No se incluye binario Mac ni se garantiza todavía su rendimiento.

## Tecnología y siguiente decisión

Núcleo de negocio, validación y persistencia en TypeScript estricto; SQLite integrado en el runtime; interfaz en HTML/CSS/JavaScript y ventana Electron. No se ha reescrito toda la interfaz a TypeScript. La recomendación aplicada es consolidar primero los datos y las reglas comprobadas. Tauri sigue siendo una alternativa a evaluar con mediciones en el Mac real; no se afirma que Electron sea el de menor consumo. Ver docs/ARQUITECTURA_PROTOTIPO.md.

## Bandeja mejorada en 0.3

Buscar mensajes por texto o proveedor, sin necesidad de tildes; filtrar pendientes, sin leer o relacionados con pedidos. Prioridad y relevancia son independientes. Corregir relevancia exige un motivo y conserva el original. Las referencias ambiguas quedan por revisar; no se vinculan pedidos automáticamente. Los mensajes anteriores permanecen pendientes de evaluar. Todo funciona con eventos de demostración locales.

## Fotos por proveedor y fecha

Al cargar una foto, elegir proveedor y fecha del documento. Configuración → Archivo de fotos → Organizar permite corregirlas después. Las imágenes antiguas quedan sin proveedor.

En data/proveedores/indice.json figuran los nombres y sus carpetas estables. Cada carpeta tiene proveedor.json, datos.json y fotos/AAAA-MM-DD. Los identificadores evitan problemas al renombrar proveedores. Estas son copias organizadas: no editar sus JSON para cambiar la app. Las copias anteriores se conservan al reclasificar; la app muestra la clasificación vigente. Guardar archivos directamente allí no los importa ni los agrega a los respaldos. Usar la carga dentro de la app. OCR de texto y proveedor disponible; cantidades/PDF pendientes.

## Detectar proveedor en 0.5

En Proveedores → Editar, completar NIF/CIF, teléfono con prefijo internacional y otros nombres que aparezcan en documentos. Al subir una foto, el OCR español incluido lee el texto y propone una ficha existente. Verificarla y pulsar Guardar foto; queda organizada por proveedor/fecha. La fecha todavía se elige manualmente. Si falla o hay dudas, elegir proveedor en el selector. No se crea automáticamente una ficha nueva.

Para una factura de Makro en imagen, crear primero su ficha con nombre/alias o NIF correcto. PDF y descarga web aún pendientes. Simular mensaje permite probar identificación por texto o número, pero no conecta WhatsApp. El motor y el español están incluidos: copiar siempre la carpeta completa del ejecutable. No requiere instalar herramientas OCR externas ni descargar modelos al primer uso.

## WhatsApp QR experimental en 0.6

Abrir WhatsApp → Conectar por QR. En el teléfono, tanto WhatsApp normal como Business: Dispositivos vinculados → Vincular un dispositivo. Verificar el número conectado y pulsar Autorizar chat. Elegir un proveedor con teléfono en su ficha o introducir número internacional y nombre de otro contacto. Solo esos contactos se importan para esa cuenta; no se envían mensajes.

Cerrar sesión / cambiar número conserva conversaciones anteriores, registra el cierre y permite vincular otro número con QR nuevo. Al conectarlo, registra el número anterior y el nuevo. El selector Cuenta del historial permite consultar cada cuenta por separado. Si el dispositivo ya estaba desconectado, revisar Dispositivos vinculados en el teléfono para revocar la sesión anterior: un cambio local no garantiza revocación remota.

Requiere internet y app abierta. No recupera historial anterior al conectar. La sesión Web puede sincronizar la cuenta completa en su perfil, aunque la importación esté filtrada. Implementación no oficial, experimental. Se ha probado obtener QR real; vinculación y recepción con la cuenta del usuario requieren su escaneo y prueba posterior.

Datos del canal en data/whatsapp. Crear copia de WhatsApp incluye su SQLite y adjuntos, sin credenciales; es distinta de la copia del inventario. Restauración del canal manual, con app cerrada. Los adjuntos entrantes se archivan por cuenta/proveedor o contacto/fecha UTC, sin clasificación ni OCR automáticos todavía. PDF se archiva pero no se lee. No compartir sessions ni data con Claude.

Para reconstruir el navegador en desarrollo, fijar PUPPETEER_CACHE_DIR al runtime/browser de esta carpeta y ejecutar npx puppeteer browsers install chrome; comprobar que la ruta instalada coincide con runtime/browser.json. El ejecutable ya empaquetado incluye el navegador y no necesita esa descarga.

## Entregas e IA local en 0.7

Compras → Control de entregas muestra pedido, recibido y falta recibir por producto. En curso y Cerrados separan el trabajo pendiente. Registrar lo que llegó añade únicamente esa entrega al inventario. Guía y ejemplo con cajas/litros: docs/CONTROL_DE_ENTREGAS.md.

IA local abre un editor para analizar hasta 4.000 caracteres. También hay accesos desde fotos con OCR guardado y textos de mensajes. Qwen3 0.6B Q4 está incluido en el paquete: propone tipo de documento y muestra el inicio del original para contrastarlo, sin modificar datos ni ejecutar acciones. El texto se analiza al pulsar el botón, no automáticamente al recibirlo. Resultado revisable; puede equivocarse. Sin API, coste por tokens ni descargas durante el uso. PDF, aprendizaje de correcciones y clasificación automática de adjuntos siguen pendientes.

Leer docs/IA_LOCAL_Y_SEGURIDAD.md antes de ampliar permisos o automatizar acciones. Incluye controles, límites, fallos observados y reproducción del modelo. El prototipo no garantiza riesgo cero y aún requiere revisión independiente antes de producción.

## IA reforzada en 0.8
Por defecto usa dos lecturas. Si discrepan, el documento queda por revisar. Contrasta encabezados y distingue proformas/abonos; comprueba base + cuota de IVA frente al total cuando las tres cantidades están etiquetadas en líneas separadas. No valida toda una factura ni hace contabilidad. Al cambiar el texto se retira la conclusión anterior.

Se eligió Q4 por mejores resultados medidos, no por aumentar el tamaño del modelo. El texto mostrado procede del original, nunca de explicaciones generadas. Sigue siendo un asistente local limitado, con errores y abstenciones posibles. Para Claude: docs/IA_LOCAL_Y_SEGURIDAD.md y último informe de reports/.

## Auditoría y mejora continua en 0.8.1
La entrega 0.8.0 se auditó: parche y commit coinciden, pruebas y formato correctos. La comprobación de sumas acepta etiquetas habituales de facturas españolas (IVA 21%, Total a pagar) y sigue absteniéndose ante porcentajes sin importe o varias cuotas. El trabajador de IA bloquea más módulos de red; no es un sandbox del sistema. Cualquier IA que continúe debe leer docs/PROMPT_MAESTRO_V2.md y aplicar su directriz de mejora continua.

## Chat de dudas en 0.8.2
IA local incluye un chat para preguntar cómo usar la app o qué dice el texto pegado en el editor. Responde el modelo local a partir de una guía fija y del texto del editor si se marca la casilla; no consulta el inventario ni los pedidos, no ejecuta acciones y sus respuestas son orientativas. Cada respuesta puede tardar de 30 segundos a más de un minuto en este equipo. El chat se conserva solo mientras la ventana está abierta.

## Producción y respuestas de proveedores en 0.9.0
Producción: crea recetas (rinde X kg, ingredientes en su unidad base) y registra los kilos producidos por día. La app propone el consumo; corrígelo y aprueba para descontar ingredientes y sumar el producto terminado. La hoja diaria muestra kilos por gelato. Guía: docs/PRODUCCION_Y_RECETAS.md.

Mensajes: cada respuesta de proveedor se lee con reglas (falta de producto, cancelación, cambio, pregunta, fecha de entrega, confirmación) y se marca si debes leerla; las fechas como «el lunes» se resuelven. En Resumen aparece cuántos mensajes debes leer y en Control de entregas las respuestas vinculadas a cada pedido. «Segunda lectura con IA local» pide al modelo una categoría como propuesta; no cambia pedidos ni stock.

## Envío real por WhatsApp en 0.9.1
En Compras → Control de entregas, un pedido pendiente tiene «Enviar por WhatsApp». Se muestra el texto exacto y el destinatario; al confirmar se envía una sola vez desde la cuenta vinculada por QR. Requisitos: WhatsApp conectado y el número del proveedor autorizado en WhatsApp → Autorizar chat. Enviar no cambia stock ni confirma el pedido: la respuesta del proveedor llega a la pantalla WhatsApp y se lee por reglas. Prueba primero con un número propio.

## Diagnóstico de WhatsApp en 0.9.3
La pantalla WhatsApp muestra «Diagnóstico del canal» con los últimos eventos técnicos (remitente resuelto, autorizado o no, enviado, ignorado y por qué), sin contenido de mensajes, y un botón «Enviar mensaje de prueba» a un chat autorizado. Si un mensaje no aparece, ese diagnóstico dice el motivo.

## WhatsApp comprobado en 0.9.4
Envío y recepción reales verificados con dos números del propietario: la app envió un mensaje desde la cuenta vinculada y recibió la respuesta. Si un envío aparece como no confirmado, el diagnóstico del canal indica el motivo.

## Mejora general en 0.10.0
Los mensajes de WhatsApp de proveedores autorizados aparecen también en Mensajes, con su lectura por reglas; si responden al pedido que les enviaste y es el único en curso, quedan vinculados y el pedido muestra la entrega prevista. La app hace una copia automática diaria (30 últimas en data/backups) y lo indica en Configuración. Puedes confirmar el tipo de documento de una foto desde IA local. El código de la interfaz está en src/ui/*.js.

## Ventas y mermas en 0.10.1
En Producción, la tabla «Ventas y mermas del día» registra kilos vendidos o desechados de cada producto terminado; cada cantidad crea una salida o merma en el historial, reversible como cualquier movimiento.

## Conexión automática y avisos en 0.10.2
En WhatsApp, «Conectar al abrir: sí» hace que la app reconecte sola al arrancar con la sesión guardada; cuando un proveedor autorizado escribe, Windows muestra una notificación y al pulsarla vuelve a la app. Configuración incluye «Primeros pasos».

## Historial, reconexión y CSV en 0.10.3
Al conectar WhatsApp, la app revisa los últimos mensajes de cada chat autorizado e importa los que llegaron con la app cerrada (texto). Si la sesión se cae y «Conectar al abrir» está activo, reintenta sola. Configuración → «Exportar CSV» crea inventario y movimientos en data/exportaciones para hoja de cálculo o gestoría.

## Recetario protegido y limpieza en 0.11.0
Configuración → «Recetario protegido»: pon una contraseña y la pantalla Producción pedirá desbloqueo (30 minutos); sin ella no se pueden crear recetas ni producir. Protege la pantalla dentro de la app, no cifra el disco; los movimientos de stock siguen visibles en Actividad. Configuración → «Limpieza periódica»: elige 7, 14, 30 o 90 días para borrar actividad y conversaciones antiguas (se conservan las 50 entradas recientes, los movimientos y las copias). Si olvidas la contraseña: con la app cerrada, borra la clave recipes_lock de la tabla settings en data/gelatostock.sqlite.

## Aprendizaje por correcciones en 0.12.0
En un mensaje, «Corregir lectura» te deja elegir qué quiso decir el proveedor (falta de producto, cancelación, cierre o vacaciones, pago, cambio, pregunta, documento, entrega, confirmación). La app lo recuerda y lo aplica a mensajes iguales o casi iguales; lo aprendido se ve y se olvida en Configuración. No es entrenamiento del modelo: son tus decisiones. Las reglas también entienden ahora horas, fechas con mes, abreviaturas y faltas de ortografía habituales.

## Identidad visual en 0.13.0
La app se presenta como propuesta para Artello (Palma de Mallorca) con una identidad propia: paleta «Mediterraneo» (pistacho, rosa y azafrán) sobre crema y acero, títulos en serif y una pantalla de inicio «arte + gelato». El nombre y el lugar se editan en Configuración → Identidad del negocio. No se incluyen logotipos ni materiales de la marca real.

## Documentos por proveedor en 0.14.0
La pantalla Documentos reúne facturas, albaranes, recibos y pedidos (fotos o PDF) por proveedor. Para cada documento la app propone, por reglas, el proveedor, el tipo y el pedido al que pertenece (número de pedido en el texto, único pedido reciente del proveedor o importe coincidente); tú aceptas con un clic o vinculas a mano. Los adjuntos que envían por WhatsApp los proveedores autorizados entran solos. En Control de entregas se ven los documentos de cada pedido.

## Sistema de diseño en 0.14.1
Toda la interfaz sigue un sistema documentado en docs/DISENO_SISTEMA.md: paleta Mediterraneo con contraste AA, una sola escala de texto, ritmo de 8 px, componentes con estados y acento por pantalla. Se revisaron las once pantallas y los diálogos a cuatro tamaños sin solapamientos ni textos cortados.

## Mensajes, decisiones y guía en 0.15.0
La pantalla Mensajes muestra arriba «Qué hacer ahora», agrupa las conversaciones por proveedor y en cada mensaje ofrece respuestas rápidas por WhatsApp (texto visible y editable, un envío) y «Decidir y cerrar» para anotar la decisión del día. La app aprende a leer mensajes parecidos cuando corriges una lectura; nunca aprende decisiones. La pantalla «Guía» reproduce docs/GUIA_USO.md dentro de la app.

## IA con reglas primero y compra en webs en 0.16.0
La lectura de documentos la hacen reglas deterministas sobre el título (con tolerancia a OCR) y el modelo local da una segunda opinión; cuando discrepan prevalecen las reglas y se avisa. Corpus sintético de 51 documentos: 51/51 combinado · reglas 51/51 · modelo solo 38/51 · 6.4 s por lectura reforzada. El modelo se mantiene cargado unos minutos y responde solo con el tipo, lo que acorta cada lectura. Los proveedores pueden tener una web de compra (https): el carrito ofrece la lista copiable y abre la web; la app no entra ni paga.

## Recetario en 0.17.0
Pantalla Recetario con la ficha completa de cada receta (familia, proporciones con porcentaje, elaboración, alérgenos), escala por kilos en pantalla y acciones de producir, duplicar y eliminar. Ventas y mermas solo muestra productos terminados de recetas. Mensajes agrupa en un solo bloque lo que entendió la app y «Abrir» siempre lleva al mensaje.

## Copia secundaria e historial paginado en 0.18.0
Configuración permite una carpeta secundaria de copias (otro disco, USB o carpeta sincronizada) con copia inmediata y duplicado de cada copia posterior; Resumen avisa si no hay copia de las últimas 48 horas. La interfaz recibe solo los 300 movimientos y entradas de actividad más recientes y pide el resto bajo demanda; los datos completos siguen en SQLite y en las copias. La interfaz está partida por pantallas en src/ui/views-*.js.

## Respuesta directa y lotes en 0.19.0
En Mensajes se responde escribiendo en el propio mensaje (las respuestas rápidas rellenan el cuadro) y se envía con un clic. En Compras, «Enviar pendientes por WhatsApp» muestra todos los pedidos pendientes con su texto; se marcan los que se quieren y la app los envía uno a uno con pausa, mostrando el progreso.

## Balance técnico y resumen semanal en 0.20.0
El recetario calcula azúcares, grasa, sólidos totales y sólidos lácteos no grasos de cada receta a partir de las fichas de composición de los ingredientes y los compara con rangos orientativos por familia. La pantalla Semana resume producción, ventas, mermas, recepciones, pedidos, mensajes y avisos de stock, e imprime o guarda en PDF.

## Precios y conteo por zonas en 0.21.0
Cada cambio de precio queda en un historial por producto y proveedor; Resumen avisa de las subidas del último mes. Los productos tienen zona de conteo y la hoja de conteo por zona ajusta el stock y deja constancia; Resumen recuerda qué zona toca contar según el plazo elegido.

## Carpetas y Mac en 0.22.0
La app de escritorio abre el selector de carpetas del sistema para la copia secundaria y para la exportación CSV (un solo puente, sin acceso a Node desde la página). El empaquetado funciona también en macOS (docs/MAC.md), con scripts para descargar el Chrome de WhatsApp y medir la memoria de la IA; queda por ejecutar en un Mac real.
