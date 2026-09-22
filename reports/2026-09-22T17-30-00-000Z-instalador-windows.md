# Sesión 048 (tercera parte) · Instalador de Windows · versión 0.44.0

## Encargo

Del usuario, el 2026-09-22: «quiero que hagas un instalador para la app, ya que quiero enviársela a alguien».

## Qué no es viable ahora, y por qué

- **Firmar el instalador**: exige un certificado de firma de código de pago a nombre del negocio. Sin firma, Windows enseña el aviso de SmartScreen («Windows protegió tu PC») y hay que pulsar «Más información → Ejecutar de todas formas». Se explica en docs/INSTALADOR.md para que se lo diga a quien lo reciba.
- **Actualizaciones automáticas**: no hay servidor desde el que actualizar. Se manda el instalador nuevo y se instala encima; los datos se conservan.
- **Mac**: sigue pendiente (docs/MAC.md).
- **Un instalador pequeño**: la app lleva dentro el modelo de IA local (877 MB, apenas se comprime) y el navegador de WhatsApp (428 MB). Sin ellos no funcionaría sin internet ni podría conectar WhatsApp; el instalador ronda 1 GB.

## Qué se construyó

- **`npm run installer:win`** (scripts/installer.cjs): envuelve la carpeta portátil `dist/GelatoStock-<versión>-win32-x64` con electron-builder 26.15.3 (NSIS), sin volver a empaquetar nada (`--prepackaged`). Deja `dist/instalador/GelatoStock-Instalador-<versión>.exe`. Configuración en electron-builder.json: instalación por usuario (sin administrador), carpeta elegible, accesos en escritorio y menú Inicio, desinstalador, en español, sin firma (`signAndEditExecutable: false`, así tampoco descarga herramientas de firma).
- **Dónde guarda los datos la app instalada** (src/datadir.cjs): el instalador deja `instalado.txt` junto a `GelatoStock.exe`; con esa marca, los datos van a `%LOCALAPPDATA%\GelatoStock\data`, y desinstalar o actualizar nunca los toca. Sin marca (carpeta portátil o ZIP), siguen en `data/` junto al ejecutable, como hasta ahora. `GELATO_DATA_DIR` manda siempre. La pantalla Configuración enseña la ruta.
- **Icono**: scripts/make-icon.cjs dibuja el cucurucho de la marca con sharp y escribe build-assets/icon.ico e icon.png (en git). Lo llevan el instalador, el desinstalador y la ventana de la app (package.cjs copia build-assets a resources/app). El ejecutable conserva el icono genérico de Electron: cambiarlo exige editar el ejecutable (rcedit) y queda en TODO.
- **Sin datos del usuario**: el instalador sale de `dist/`, donde package.cjs nunca copia `data/`. Quien lo instala empieza con el espacio de demostración.

## Tropiezos de la sesión (y qué se aprendió)

- electron-builder falló al extraer su 7-Zip con `EXDEV: cross-device link not permitted` (caché en C:, temporales en otro disco). scripts/installer.cjs fija `ELECTRON_BUILDER_CACHE` y `TMP`/`TEMP` en work/ del mismo disco y la extracción pasó.
- Se paró una construcción porque src/ai-help.cjs cambió después de `package:win`: el instalador habría llevado el texto viejo. Regla: `package:win` siempre antes de `installer:win`. Al parar quedó `instalado.txt` en la carpeta portátil (el `finally` no corre si matan el proceso) y un `7za.exe` huérfano; se limpiaron a mano.
- Herencia de 0.43.0: la frase «Merma de un gelato a cualquier hora…» de la guía del chat capturaba «¿Quién inventó el gelato?» y tests/ai.test.cjs fallaba (en aquella sesión la prueba corrió antes de la edición y el fallo no se vio). Reescrita como «Merma a media jornada … lo que se tira de la vitrina …»: las tres preguntas de cultura del gelato vuelven a «Arte + gelato».

## Pruebas

- `npm test`: **202 pruebas, 0 fallos** (reports/tests-2026-09-22-v0440.txt). Nueva: tests/datadir.test.cjs (portátil, instalada, sin carpeta local, GELATO_DATA_DIR; y que installer.cjs quita la marca).
- `format:check` y `typecheck`: sin avisos. Chat: **35/35** (reports/ai-chat-v0440.json).
- Instalador: dist/instalador/GelatoStock-Instalador-0.44.0.exe, **751 MB** (work/audit-installer-0440.txt). Prueba en este equipo con work/check-instalador.cjs (salida en reports/instalador-2026-09-22-v0440.txt): **16 PASS** — instalación silenciosa en work/inst-test en 197 s, marca junto al ejecutable, desinstalador, modelo y navegador dentro, la portátil sin marca, la app instalada arranca y dice v0.44.0, Configuración enseña la carpeta de datos en la carpeta local (LOCALAPPDATA temporal), la base se crea ahí y no junto al ejecutable, la desinstalación silenciosa borra el programa y conserva los datos. Después no quedan acceso en el escritorio, entrada del menú Inicio, entrada en «Aplicaciones instaladas» ni carpetas de prueba.
- Prueba de escritorio con el ejecutable portátil 0.44.0: **21 PASS** (reports/desktop-smoke-2026-09-22-v0440.txt).

