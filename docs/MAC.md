# GelatoStock en Mac · preparación (sin validar todavía)

Nadie ha ejecutado GelatoStock en un Mac. Este documento deja listo el camino para hacerlo en un Mac (el del usuario o el de quien vaya a recibir la app), crear ahí el instalador `.dmg` y medir la memoria de la IA. Todo lo de abajo está preparado desde Windows y puede fallar en el primer intento: hay que anotar cada error tal cual en reports/.

## Requisitos
- macOS 13 o superior, Apple Silicon (arm64) o Intel (x64). El instalador que salga sirve solo para Macs del mismo tipo. 8 GB de memoria es el caso que hay que medir.
- Node.js 22 o superior (incluye `node:sqlite`). Comprobar con `node -v`.
- Git y unos 6 GB libres (Electron, Chrome para WhatsApp, el modelo y el instalador).
- Internet durante la preparación (descargas de npm, del modelo, de Chrome y, una vez, de las herramientas de electron-builder). La app instalada no descarga nada.

## Pasos
1. Clonar el repositorio o copiar la carpeta del proyecto (sin `node_modules`, `dist`, `data`, `work`).
2. `npm ci` — instala Electron y las dependencias nativas de macOS (sharp y onnxruntime-node traen sus binarios para darwin).
3. `node scripts/setup-ai-model.cjs` — descarga el modelo del manifiesto (unos 900 MB) y comprueba su hash.
4. `node scripts/setup-browser.cjs` — descarga Chrome para macOS en `runtime/browser` y actualiza `runtime/browser.json` (WhatsApp Web lo necesita).
5. `npm test` — deben pasar todas las pruebas; si falla `node:sqlite`, actualizar Node.
6. `npm run package:mac` — crea `dist/GelatoStock-<versión>-darwin-<arch>/GelatoStock.app`: copia `Electron.app` (con sus enlaces simbólicos), marca `Info.plist` (nombre GelatoStock, identificador es.gelatostock.app, versión), pone el icono de la marca (`build-assets/icon.icns`) y mete la app con solo los módulos nativos de este Mac (scripts/package-rules.cjs).
7. Abrir el `.app` de `dist/` para probarlo: la primera vez macOS bloquea apps sin firmar; botón derecho → Abrir → Abrir, o `xattr -dr com.apple.quarantine dist/GelatoStock-*/GelatoStock.app`. Los datos de la app empaquetada van a `~/Library/Application Support/GelatoStock/data` (Configuración enseña la ruta); en desarrollo (`npm start`), a `data/` del proyecto.
8. `npm run installer:mac` — envuelve el `.app` en `dist/instalador/GelatoStock-Instalador-<versión>-<arch>.dmg` con electron-builder, sin firma. Ese `.dmg` es lo que se envía; cómo abrirlo en el otro Mac está en docs/INSTALADOR.md.
9. Medir la IA: `node scripts/measure-ai-memory.cjs` en la carpeta del proyecto y guardar la última línea (JSON). Repetir con `GELATO_AI_THREADS=2 node scripts/measure-ai-memory.cjs` en un Mac de 8 GB.

## Qué mirar en la medición
- `peakMiB`: memoria máxima del proceso con el modelo cargado. En Windows (i7, 16 GB) ronda 2.500–3.400 MiB. Si en el Mac de 8 GB supera 3.000 MiB o el sistema empieza a usar disco, bajar hilos (2) y acortar el tiempo de descarga del modelo (hoy 3 minutos sin uso).
- `readings[].ms`: tiempo por lectura reforzada (dos pasadas del modelo). En Windows, 6–9 s con el modelo cargado.
- `afterReleaseMiB`: lo que queda tras liberar el modelo; debería acercarse a `baselineMiB`.

## Lo que no está resuelto
- Firma y notarización (Gatekeeper): requiere cuenta de desarrollador de Apple. Sin ellas, quien reciba el `.dmg` tiene que autorizar la app a mano (docs/INSTALADOR.md).
- La prueba de escritorio (`npm run test:desktop`) está escrita para el ejecutable de Windows; en Mac hay que adaptar la ruta del binario (`GelatoStock.app/Contents/MacOS/Electron`).
- El ejecutable dentro del bundle sigue llamándose `Electron` (CFBundleExecutable no se toca); el nombre visible y el icono ya son los de la app, pendiente de verlo en un Mac.
- `ABRIR GELATOSTOCK.vbs` es de Windows; en Mac se abre el `.app` directamente.
- Puntos que pueden fallar la primera vez: el `.icns` generado con sharp, electron-builder con la carpeta preempaquetada, y WhatsApp con el Chrome de macOS.
