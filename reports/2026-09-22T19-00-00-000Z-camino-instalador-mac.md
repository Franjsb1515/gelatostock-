# Sesión 048 (cuarta parte) · Camino del instalador para Mac · versión 0.45.0

## Encargo

Del usuario, el 2026-09-22, tras el instalador de Windows: «recordemos que será para Mac» y «también» (la persona que recibirá la app usa Mac).

## Qué no es viable desde Windows, y por qué

- **Crear el `.dmg` aquí**: electron-builder solo construye para macOS en un Mac, y además el `.app` lleva Electron, sharp, onnxruntime y el Chrome de WhatsApp compilados para macOS, que no están en este equipo. El instalador de Mac se crea **en un Mac** (el del usuario o el de quien la recibe), siguiendo docs/MAC.md.
- **Probarlo desde aquí**: nada de lo de Mac se puede ejecutar en Windows. Todo lo de esta versión queda **sin validar** hasta que alguien lo ejecute en un Mac y anote la salida (regla de CLAUDE.md: no marcar nada como probado en Mac desde Windows).
- **Firma y notarización**: exigen una cuenta de desarrollador de Apple (de pago). Sin ellas, macOS avisa y la persona tiene que autorizar la app a mano.
- **Un solo `.dmg` para todos los Macs**: el que salga sirve para Macs del mismo tipo (Apple Silicon o Intel) que el que lo creó.

## Qué queda preparado

- **scripts/package.cjs** acepta macOS: copia `Electron.app` conservando sus enlaces simbólicos, marca `Info.plist` (nombre, identificador `es.gelatostock.app`, versión) y sustituye `electron.icns` por el icono de la marca. La poda de módulos nativos por plataforma y arquitectura vive en **scripts/package-rules.cjs**, probada en tests/package-rules.test.cjs para win32-x64, darwin-arm64 y darwin-x64 (sharp y libvips de esa plataforma, onnxruntime-node solo con su binario, sin onnxruntime-web). En Windows el resultado es el mismo que antes.
- **scripts/installer.cjs** hace el `.dmg` en Mac (`npm run installer:mac`): electron-builder `--mac dmg --arm64|--x64 --prepackaged`, sin firma (`identity: null`), sin marca `instalado.txt` porque en Mac no hace falta.
- **src/datadir.cjs**: en Mac, la app empaquetada guarda en `~/Library/Application Support/GelatoStock/data` (un `.app` en Aplicaciones no puede escribir en su carpeta); en desarrollo, en `data/` del proyecto. Probado en tests/datadir.test.cjs.
- **build-assets/icon.icns**: scripts/make-icon.cjs lo genera con sharp (contenedor `icns` con PNG de 32 a 1024 px). Que macOS lo acepte queda por ver.
- **docs/MAC.md** corregido: su paso 6 (`npm run package:mac`) fallaba porque package.cjs exigía Windows. Ahora describe los nueve pasos hasta el `.dmg` y la medición de memoria.
- **docs/INSTALADOR.md**: sección Mac con lo que hay que decirle a quien reciba el `.dmg` (arrastrar a Aplicaciones; en macOS 15 o posterior, Ajustes del Sistema → Privacidad y seguridad → «Abrir de todos modos»; en anteriores, botón derecho → Abrir).

## Puntos que pueden fallar la primera vez en un Mac

`npm ci` sin los binarios darwin de sharp u onnxruntime; el `.icns` generado a mano; electron-builder con la carpeta preempaquetada que contiene `GelatoStock.app`; WhatsApp con el Chrome de macOS; la memoria de la IA en un Mac de 8 GB. Cada uno se anota en reports/ al ejecutarlo.

## Pruebas (en Windows)

- `npm test`: **205 pruebas, 0 fallos** (reports/tests-2026-09-22-v0450.txt). Nuevas: tests/package-rules.test.cjs (2) y el caso Mac de tests/datadir.test.cjs.
- `format:check` sin avisos.
- Windows con el empaquetado reorganizado: `package:win` deja exactamente lo mismo que en 0.44.0 (sharp-win32-x64 y colour, onnxruntime-node solo con los 5 archivos de win32/x64, carpetas vacías de otras plataformas como antes). Instalador dist/instalador/GelatoStock-Instalador-0.45.0.exe, **751 MB**; prueba del instalador **16 PASS** (reports/instalador-2026-09-22-v0450.txt; instalación silenciosa en 194 s, datos en la carpeta local, desinstalación limpia). La limpieza final del guion de prueba falló con EPERM porque el desinstalador seguía borrando unos segundos; se comprobó a mano que no quedó carpeta, acceso, entrada de «Aplicaciones instaladas» ni proceso, y el guion ahora reintenta esa limpieza. Prueba de escritorio con el ejecutable portátil 0.45.0: **21 PASS** (reports/desktop-smoke-2026-09-22-v0450.txt).


## Resultado en GitHub Actions (añadido al cierre de la sesión)

El usuario decidió publicar el código en un repositorio público (https://github.com/Franjsb1515/gelatostock-) para construir el `.dmg` gratis en los Macs de GitHub. Antes se retiraron sus dos teléfonos de CLAUDE.md, de reports/ y de todo el historial (git filter-branch; copia local intacta en la rama main-antes-de-publicar, que no se sube).

Cuatro intentos, cada uno con su evidencia:

1. Falló en «Empaquetar la app». Sin sesión de GitHub no se pueden leer los registros (ni por API ni en la web).
2. Se cambió la copia de Electron.app a `ditto` y se añadió un diagnóstico. Falló en «Crear el instalador»: en realidad ya había fallado el empaquetado, pero `| tee` sin pipefail ocultaba el error.
3. Con `defaults.run.shell: bash` (pipefail) y los registros publicados en las ramas `registros-mac-<arch>`, el registro dijo la causa: `ditto: Cannot get the real path for source .../node_modules/electron/dist/Electron.app`. El npm de los runners bloquea los scripts de instalación (`npm warn install-scripts`), así que Electron nunca se descargó.
4. Paso explícito `node node_modules/electron/install.js` y `node node_modules/onnxruntime-node/script/install` tras `npm ci`: **éxito en 17 min**. En macOS 26.6 (Apple Silicon) y macOS 15.7 (Intel): `npm test` **205/205**, empaquetado con 26 paquetes omitidos, **scripts/mac-smoke.cjs 6 PASS** en cada uno (la app arranca, dice v0.45.0, Configuración enseña la carpeta de datos temporal y la base se crea ahí), y los `.dmg` de **852 MB (arm64) y 854 MB (x64)** publicados en la release v0.45.0. Registros completos en reports/mac-2026-09-22-v0450-arm64/ y reports/mac-2026-09-22-v0450-x64/.

Lo que sigue sin probar: una persona instalando y usando la app en un Mac real (aviso de Gatekeeper incluido), WhatsApp en Mac y la memoria de la IA en un Mac de 8 GB. Lección de sesión: la API pública de GitHub admite 60 peticiones por hora sin sesión; sondear cada minuto la agota (usar la página web o las ramas de registros).
