# Instaladores: Windows (probado) y Mac (preparado, sin validar)

Desde la 0.44.0 la app se puede enviar como un único archivo. Es la misma app que la carpeta portátil de `dist/`, envuelta en un instalador con electron-builder. **Cada instalador se crea en su propio sistema**: el de Windows en un Windows, el de Mac en un Mac. Desde Windows no se puede crear el de Mac (electron-builder no construye para macOS fuera de un Mac, y los binarios nativos, el navegador de WhatsApp y el propio Electron son distintos en cada sistema).

## Windows

```bash
npm run package:win
```

```bash
npm run installer:win
```

El primero deja la carpeta portátil `dist/GelatoStock-<versión>-win32-x64`. El segundo la envuelve tal cual con electron-builder (NSIS) y deja `dist/instalador/GelatoStock-Instalador-<versión>.exe` (unos 750 MB; tarda varios minutos comprimiendo 1,9 GB: modelo de IA local, navegador de WhatsApp y la app). `package:win` siempre antes de `installer:win`: el instalador lleva lo que haya en `dist/`.

Solo la primera vez, electron-builder descarga su NSIS y 7-Zip a `work/electron-builder-cache` (caché de construcción en el mismo disco; con la caché en otro disco fallaba). Es una herramienta de construcción: la app instalada no descarga nada.

### Qué recibe la otra persona (Windows)

- Un solo archivo `.exe`. Al abrirlo elige la carpeta (por defecto en su usuario, sin permisos de administrador), y el instalador crea accesos en el escritorio y el menú Inicio y un desinstalador.
- **Aviso de Windows**: el instalador **no está firmado** (firmarlo exige un certificado de pago). SmartScreen dirá «Windows protegió tu PC»: hay que pulsar «Más información» y luego «Ejecutar de todas formas». Hay que avisar a quien lo reciba.
- **Sus datos van en su carpeta de usuario** (`%LOCALAPPDATA%\GelatoStock\data`), no en la carpeta del programa: desinstalar o instalar una versión nueva encima no los toca. La pantalla Configuración enseña la ruta exacta.
- Empieza con el espacio de demostración (proveedores y productos de ejemplo), como cualquier instalación nueva. No lleva ningún dato tuyo: el instalador sale de `dist/`, y `data/` nunca se copia ahí.
- Funciona sin internet, salvo WhatsApp, cruceros, clima y festivos, como la tuya.

### Cómo lo sabe la app

El instalador deja `instalado.txt` junto a `GelatoStock.exe`. `src/datadir.cjs` lo mira al arrancar: con la marca, los datos van a la carpeta local de la persona; sin ella (carpeta portátil), siguen en `data/` junto al ejecutable, como hasta ahora. `GELATO_DATA_DIR` manda siempre (pruebas y acceso de inicio del proyecto).

### Probado

`work/check-instalador.cjs` instala en silencio en `work/inst-test`, arranca la app instalada con una carpeta local temporal, comprueba dónde guarda los datos y desinstala: 16 PASS el 2026-09-22 (reports/instalador-2026-09-22-v0440.txt). No se ha probado en el equipo de otra persona.

## Mac en GitHub Actions (sin tener un Mac)

El repositorio público https://github.com/Franjsb1515/gelatostock- tiene la receta `.github/workflows/mac.yml`: GitHub presta un Mac (Apple Silicon y otro Intel), instala todo, descarga el modelo y Chrome, pasa las pruebas, empaqueta, arranca la app una vez (scripts/mac-smoke.cjs) y crea el `.dmg`.

- Se lanza al publicar una etiqueta de versión (`git tag v0.45.0 && git push origin v0.45.0`) o a mano en la pestaña Actions → «Instalador de Mac» → «Run workflow».
- Con etiqueta, los `.dmg` quedan en la página de Releases del repositorio: `GelatoStock-Instalador-<versión>-arm64.dmg` (Apple Silicon) y `-x64.dmg` (Intel). Quien lo reciba descarga el que corresponda a su Mac (menú Apple → Acerca de este Mac: «Chip Apple M…» es arm64; «Intel» es x64).
- Sin etiqueta, el `.dmg` queda como artefacto de la ejecución (30 días) y solo lo puede bajar quien tenga sesión en GitHub.
- Cada ejecución tarda unos 20–30 minutos y es gratis por ser un repositorio público. El registro de la ejecución es la evidencia de la primera vez que la app corre en un Mac: si algo falla, se lee ahí.

El repositorio no lleva datos del negocio ni los números de teléfono del usuario (se retiraron también del historial antes de publicarlo).

## Mac en un Mac real (preparado desde Windows; nadie lo ha ejecutado todavía)

Hace falta un Mac con macOS 13 o superior y unos 6 GB libres. Los pasos completos, con lo que hay que instalar antes, están en docs/MAC.md. En resumen, en el Mac:

```bash
npm ci
```

```bash
node scripts/setup-ai-model.cjs
```

```bash
node scripts/setup-browser.cjs
```

```bash
npm run package:mac
```

```bash
npm run installer:mac
```

`package:mac` copia `Electron.app`, lo marca (nombre, identificador, versión e icono) y mete la app con solo los módulos nativos de ese Mac (Apple Silicon o Intel). `installer:mac` lo envuelve en un `.dmg`: `dist/instalador/GelatoStock-Instalador-<versión>-<arm64|x64>.dmg`. Un `.dmg` de Apple Silicon no sirve para un Mac Intel ni al revés: hay que crearlo en un Mac del mismo tipo que el de quien lo recibe.

### Qué recibe la otra persona (Mac)

- Un archivo `.dmg`: lo abre y arrastra GelatoStock a Aplicaciones.
- **Aviso de macOS**: la app **no está firmada ni notarizada** (exige una cuenta de desarrollador de Apple, de pago). La primera vez macOS dirá que no puede comprobarla. En macOS 15 (Sequoia) o posterior: intentar abrirla, ir a Ajustes del Sistema → Privacidad y seguridad, y pulsar «Abrir de todos modos» junto al aviso de GelatoStock. En macOS anteriores: botón derecho sobre la app → Abrir → Abrir. Hay que avisar a quien lo reciba.
- **Sus datos** van a `~/Library/Application Support/GelatoStock/data` (la app instalada en Aplicaciones no puede escribir en su propia carpeta). Configuración enseña la ruta.
- Igual que en Windows: empieza con el espacio de demostración y no lleva ningún dato tuyo.

### Qué queda por comprobar en un Mac

Todo lo anterior está escrito desde Windows sin ejecutarlo. Al hacerlo por primera vez hay que anotar cada error en reports/. Puntos que pueden fallar: que `npm ci` traiga los binarios de sharp y onnxruntime para ese Mac; que el `.icns` generado con sharp lo acepte macOS; que electron-builder acepte la carpeta preempaquetada con `GelatoStock.app`; que WhatsApp arranque con el Chrome de macOS; la memoria de la IA en un Mac de 8 GB (docs/MAC.md explica cómo medirla).

## Actualizar a la otra persona

Se le envía el instalador de la versión nueva; se instala encima y conserva los datos. No hay actualizaciones automáticas.

## Límites

- Sin firma de código: aviso de SmartScreen en Windows y de Gatekeeper en Mac. Firmar, notarizar y las actualizaciones seguras siguen en TODO 6.
- El ejecutable de Windows conserva el icono genérico de Electron (cambiarlo exige editar el ejecutable); el instalador, el desinstalador y la ventana llevan el cucurucho. En Mac el `.app` sí lleva el icono de la marca (se sustituye `electron.icns`), pendiente de ver en un Mac.
- Enviar 750 MB: no cabe por WhatsApp ni por correo; Google Drive, un USB o similar.
