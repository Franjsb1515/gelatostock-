# Instalador de Windows

Desde la 0.44.0 la app se puede enviar como un único archivo: `GelatoStock-Instalador-<versión>.exe`. Es la misma app que la carpeta portátil de `dist/`, envuelta en un instalador.

## Crearlo

```bash
npm run package:win
```

```bash
npm run installer:win
```

El primero deja la carpeta portátil `dist/GelatoStock-<versión>-win32-x64`. El segundo la envuelve tal cual con electron-builder (NSIS) y deja `dist/instalador/GelatoStock-Instalador-<versión>.exe`. Tarda varios minutos: comprime unos 1,9 GB (modelo de IA local, navegador de WhatsApp y la app). El instalador pesa en torno a 1 GB.

Solo la primera vez, electron-builder descarga su NSIS a la caché de la persona (`%LOCALAPPDATA%\electron-builder\Cache`). Es una herramienta de construcción: la app instalada no descarga nada.

## Qué recibe la otra persona

- Un solo archivo `.exe`. Al abrirlo elige la carpeta (por defecto en su usuario, sin permisos de administrador), y el instalador crea accesos en el escritorio y el menú Inicio y un desinstalador.
- **Aviso de Windows**: el instalador **no está firmado** (firmarlo exige un certificado de pago). SmartScreen dirá «Windows protegió tu PC»: hay que pulsar «Más información» y luego «Ejecutar de todas formas». Hay que avisar a quien lo reciba.
- **Sus datos van en su carpeta de usuario** (`%LOCALAPPDATA%\GelatoStock\data`), no en la carpeta del programa: desinstalar o instalar una versión nueva encima no los toca. La pantalla Configuración enseña la ruta exacta.
- Empieza con el espacio de demostración (proveedores y productos de ejemplo), como cualquier instalación nueva. No lleva ningún dato tuyo: el instalador sale de `dist/`, y `data/` nunca se copia ahí.
- Funciona sin internet, salvo WhatsApp, cruceros, clima y festivos, como la tuya.

## Cómo lo sabe la app

El instalador deja `instalado.txt` junto a `GelatoStock.exe`. `src/datadir.cjs` lo mira al arrancar: con la marca, los datos van a la carpeta local de la persona; sin ella (carpeta portátil), siguen en `data/` junto al ejecutable, como hasta ahora. `GELATO_DATA_DIR` manda siempre (pruebas y acceso de inicio del proyecto).

## Actualizar a la otra persona

Se le envía el instalador de la versión nueva; se instala encima y conserva los datos. No hay actualizaciones automáticas.

## Límites

- Sin firma de código (aviso de SmartScreen). Firmar y las actualizaciones seguras siguen en TODO 6.
- El ejecutable dentro del instalador conserva el icono genérico de Electron (cambiarlo exige editar el ejecutable); el instalador, el desinstalador y la ventana de la app llevan el cucurucho de la marca.
- Solo Windows de 64 bits. Mac sigue pendiente (docs/MAC.md).
- Probado en este equipo instalando en silencio en una carpeta temporal y desinstalando después; no en el equipo de otra persona.
