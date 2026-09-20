# GelatoStock · prototipo 0.33.0

Aplicación local de escritorio para una gelatería con café de especialidad y postres. Sirve para saber qué falta, pedirlo a los proveedores, entender lo que contestan y planificar el día. Es un prototipo para probar el circuito completo; todavía no es la aplicación final de producción.

## Abrir en este Windows

Haz doble clic en **ABRIR GELATOSTOCK.vbs**, en esta carpeta. Abre una ventana propia, sin terminal. No requiere Node, Python ni navegador. Si Windows bloquea VBScript, abre `dist/GelatoStock-0.33.0-win32-x64/GelatoStock.exe`; en ese caso los datos se guardan junto al ejecutable.

El acceso principal guarda datos, copias y perfil en `D:/CARPETAPROYECTOS/APPGELATOSTOCK/data`, y los temporales en `work/`. No mover el ejecutable aislado: necesita el resto de su carpeta. Para llevarlo a otro Windows x64, copia toda la carpeta `dist/GelatoStock-0.33.0-win32-x64`. Arranca con datos de ejemplo salvo que restaures una copia. No sincroniza equipos.

## Qué hace hoy

- **Inventario**: productos con unidad base, mínimos, presentaciones, zonas, conteo guiado por zona, entradas, salidas y mermas con motivo, historial de precios con aviso de subida.
- **Compras**: propuesta de reposición, carrito, pedidos por proveedor, envío real por WhatsApp uno a uno con tu confirmación, plantilla del pedido editable, control de entregas con recepciones parciales, seguimiento de pedidos sin enviar, sin respuesta o con entrega vencida.
- **Mensajes**: conversación por proveedor, lectura de las respuestas por reglas (falta de producto, fechas, confirmaciones, cambios), «qué hacer ahora», respuesta directa y respuestas rápidas, acciones sobre el pedido desde el mensaje, aprendizaje de tus correcciones.
- **Documentos**: fotos y PDF por proveedor con OCR local en español, propuesta de proveedor, tipo y pedido, siempre confirmada por ti.
- **Producción y recetario**: recetas con familia, elaboración, alérgenos, escala por kilos y balance técnico; producción con consumo estimado que tú apruebas; cierre del día (vendido o lo que queda, motivo de merma, deshacer) e historial de ventas y mermas.
- **Cruceros y contexto del día**: escalas oficiales del puerto de Palma con histórico desde 2014, impacto potencial auditable, clima previsto, festivos oficiales, eventos que anotas tú y ventas por nivel de impacto.
- **Semana**: resumen semanal imprimible.
- **IA local**: modelo Qwen3 0.6B dentro de la app para proponer el tipo de un documento y para el chat de dudas; reglas primero, nunca ejecuta acciones.
- **Configuración**: copias diarias con carpeta secundaria, restauración, exportación CSV, limpieza periódica, contraseña del recetario, identidad del negocio, interruptor de las consultas a internet.

Todos los proveedores, precios y datos iniciales son ficticios. La aplicación no realiza pagos ni compras.

## Qué sale a internet

Nada, salvo dos cosas que puedes apagar: WhatsApp Web (si lo vinculas) y las lecturas públicas para planificar (puerto de Palma, clima de MET Norway y festivos del Govern balear), que no envían ningún dato tuyo. Detalle en `docs/IA_LOCAL_Y_SEGURIDAD.md`.

## Datos y copias

La base vigente es `data/gelatostock.sqlite` con los adjuntos aparte; las carpetas por proveedor son copias derivadas. `data/cruceros.sqlite` y `data/contexto.sqlite` son registros propios. Hay copia automática diaria en `data/backups` (30 últimas) y, si la eliges, en una carpeta secundaria. Usa las copias exportadas desde Configuración para trasladar datos: incluyen las fotos.

## Dónde está cada cosa

| Documento | Para qué |
|---|---|
| `TODO.md` | Lo pendiente, por áreas y por quién tiene que actuar |
| `CHANGELOG.md` | Qué cambió en cada versión |
| `docs/GUIA_USO.md` | Guía de uso (es la pantalla «Guía» de la app) |
| `CLAUDE.md`, `AGENTS.md` | Reglas para cualquier IA que continúe |
| `docs/CONTINUIDAD.md` | Detalle técnico de cada versión |
| `docs/IA_LOCAL_Y_SEGURIDAD.md` | IA local, seguridad y salidas a internet |
| `docs/WHATSAPP_PROVEEDORES.md`, `docs/MAC.md`, `docs/DISENO_SISTEMA.md` | WhatsApp, preparación para Mac y sistema de diseño |
| `reports/` | Un informe por sesión, con pruebas y capturas |
| `docs/HISTORIA_VERSIONES.md` | Notas antiguas de este README, archivadas |
| `docs/PROMPT_MAESTRO.md`, `docs/TODO.md` | Especificación de origen: la meta, no el estado |

## Desarrollo

Requiere Node 24 o compatible y npm. Para reconstruir desde una copia solo del código:

```text
npm ci
node node_modules/electron/install.js
node scripts/setup-ai-model.cjs
npm start
```

```text
npm test                 # Compila el núcleo y ejecuta reglas, SQLite, servidor, cruceros, contexto y ventas
npm run format:check     # Formato
npm run package:win      # Reconstruye dist tras cambiar código
npm run test:desktop     # Prueba el ejecutable real, con el modelo local
```

`.npmrc` fija la caché de npm en D para esta máquina: adapta esa ruta en otro equipo. `npm run dev` abre un servidor solo en 127.0.0.1 con una URL de sesión: es una herramienta de desarrollo; no la compartas. Mac no se ha probado: ver `docs/MAC.md`.

## Tecnología

Núcleo de negocio, validación y persistencia en TypeScript estricto (`core/`); SQLite integrado en el runtime; servidor local e interfaz en JavaScript (`src/`); ventana Electron. La interfaz no usa framework ni se ha migrado a TypeScript: se consolidaron antes los datos y las reglas comprobadas.
