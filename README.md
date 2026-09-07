# GelatoStock · prototipo 0.2.0

Aplicación local de escritorio para gelatería, café de especialidad y postres. Esta entrega permite probar el circuito; no es aún la aplicación final de producción.

## Abrir en este Windows

Hacé doble clic en **ABRIR GELATOSTOCK.vbs**, en esta carpeta. Abre una ventana propia, sin terminal. No requiere Node, Python, navegador ni conexión para usar el ejecutable ya generado. Si Windows bloquea VBScript, podés abrir `dist/GelatoStock-0.2.0-win32-x64/GelatoStock.exe` directamente; en ese caso los datos se guardan dentro de esa carpeta portátil.

El acceso principal guarda datos, copias y perfil del programa en `D:/APPGELATOSTOCK/data`. Temporales de los procesos lanzados desde el acceso: `work/`. No se ha configurado almacenamiento del proyecto en C. Windows puede generar sus propios registros del sistema fuera del control de la app.

No mover el ejecutable aislado: necesita el resto de archivos de su carpeta. Para copiarlo a otro Windows x64, copiar toda la carpeta `dist/GelatoStock-0.2.0-win32-x64` a una ubicación donde el usuario pueda escribir. Arranca con ejemplos nuevos, salvo que se restaure una copia. No sincroniza equipos.

## Qué podés probar

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

Todos los proveedores, precios y datos iniciales son ficticios. La aplicación no contacta a proveedores ni realiza pagos.

## Qué está pendiente

Modelo de IA local, OCR automático, WhatsApp real, webhooks externos, Makro España, recetas/ventas, sincronización, instalador firmado y paquete Mac validado. La interfaz señala esas limitaciones. Los mensajes se clasifican con reglas; las fotos se archivan sin extraer cantidades.

La base actual es SQLite con transacciones y fotografías separadas. Al abrir esta versión, migra el antiguo stock.json si existe, conserva el original y genera una copia previa en data/backups. Desde entonces la fuente vigente es data/gelatostock.sqlite. Usar las copias exportadas desde Configuración para trasladar datos: incluyen las fotografías. No copiar solo un SQLite abierto ni seguir operando en el ejecutable 0.1.

Nuevas funciones: entradas, salidas y mermas con motivo; corrección mediante un movimiento compensatorio; edición de productos y proveedores; alta de proveedores y cancelación de pedidos pendientes. Cambiar una presentación no modifica pedidos ya autorizados. La unidad base se conserva para proteger el historial.

## Para Claude o cualquier IA que continúe

Leer, en este orden:

1. `CLAUDE.md` / `AGENTS.md`.
2. `reports/2026-09-07-002-sqlite-typescript.md`.
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

`reports/tests-2026-09-07-v02.txt`, `reports/desktop-smoke-2026-09-07-v02.txt` y capturas en `output/playwright/`. Mac y A18 Pro no se han probado en este entorno Windows. No se incluye binario Mac ni se garantiza todavía su rendimiento.

## Tecnología y siguiente decisión

Núcleo de negocio, validación y persistencia en TypeScript estricto; SQLite integrado en el runtime; interfaz en HTML/CSS/JavaScript y ventana Electron. No se ha reescrito toda la interfaz a TypeScript. La recomendación aplicada es consolidar primero los datos y las reglas comprobadas. Tauri sigue siendo una alternativa a evaluar con mediciones en el Mac real; no se afirma que Electron sea el de menor consumo. Ver docs/ARQUITECTURA_PROTOTIPO.md.
