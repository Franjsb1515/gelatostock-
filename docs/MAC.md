# GelatoStock en Mac · preparación (sin validar todavía)

Nadie ha ejecutado GelatoStock en un Mac. Este documento deja listo el camino para hacerlo en el equipo del usuario y medir allí la memoria de la IA. Todo lo de abajo está preparado desde Windows y puede fallar en el primer intento: hay que anotar cada error tal cual.

## Requisitos
- macOS 13 o superior, Apple Silicon (arm64) o Intel (x64). 8 GB de memoria es el caso que hay que medir.
- Node.js 22 o superior (incluye `node:sqlite`). Comprobar con `node -v`.
- Git y unos 5 GB libres (Electron, Chromium para WhatsApp y el modelo).

## Pasos
1. Clonar el repositorio o copiar la carpeta del proyecto (sin `node_modules`, `dist`, `data`).
2. `npm ci` — instala Electron y las dependencias nativas de macOS (sharp y onnxruntime-node traen sus binarios para darwin).
3. `node scripts/setup-ai-model.cjs` — descarga el modelo del manifiesto (unos 900 MB) y comprueba su hash.
4. `node scripts/setup-browser.cjs` — descarga Chrome para macOS en `runtime/browser` y actualiza `runtime/browser.json` (WhatsApp Web lo necesita).
5. `npm test` — deben pasar todas las pruebas; si falla `node:sqlite`, actualizar Node.
6. `npm run package:mac` — crea `dist/GelatoStock-<versión>-darwin-<arch>/GelatoStock.app` copiando Electron.app y podando módulos de otras plataformas.
7. Abrir la app: la primera vez macOS bloquea apps sin firmar; botón derecho → Abrir, o `xattr -dr com.apple.quarantine dist/GelatoStock-*/GelatoStock.app`. No hay certificado de firma todavía.
8. Medir la IA: `node scripts/measure-ai-memory.cjs` en la carpeta del proyecto y guardar la última línea (JSON). Repetir con `GELATO_AI_THREADS=2 node scripts/measure-ai-memory.cjs` en un Mac de 8 GB.

## Qué mirar en la medición
- `peakMiB`: memoria máxima del proceso con el modelo cargado. En Windows (i7, 16 GB) ronda 2.500–3.400 MiB. Si en el Mac de 8 GB supera 3.000 MiB o el sistema empieza a usar disco, bajar hilos (2) y acortar el tiempo de descarga del modelo (hoy 3 minutos sin uso).
- `readings[].ms`: tiempo por lectura reforzada (dos pasadas del modelo). En Windows, 6–9 s con el modelo cargado.
- `afterReleaseMiB`: lo que queda tras liberar el modelo; debería acercarse a `baselineMiB`.

## Lo que no está resuelto
- Firma y notarización (Gatekeeper): requiere cuenta de desarrollador de Apple.
- La prueba de escritorio (`npm run test:desktop`) está escrita para el ejecutable de Windows; en Mac hay que adaptar la ruta del binario.
- El nombre del proceso en el Dock será «Electron» hasta que se edite `Info.plist` del bundle (CFBundleName, icono).
- `ABRIR GELATOSTOCK.vbs` es de Windows; en Mac se abre el `.app` directamente.
