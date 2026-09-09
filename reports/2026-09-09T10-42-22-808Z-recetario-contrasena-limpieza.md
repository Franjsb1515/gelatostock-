# Sesión 020 · Recetario con contraseña y limpieza periódica · versión 0.11.0

## Petición del usuario
Borrar historial «y etc.» semanalmente; recetario con usuario y contraseña; duda entre servidor/base de datos o local.

## Respuesta sobre arquitectura
Se mantiene local: un solo equipo, sin internet obligatorio, sin coste, datos en D con copias automáticas. Un servidor solo aporta valor con varios equipos o acceso remoto y traería usuarios, cifrado y copias en otro sitio. Registrado en TODO como ampliación futura.

## Cambios
- Store: tabla settings (clave/valor) fuera del estado exportado.
- Recetario: /api/lock set/unlock/lock/remove; hash scrypt con sal; desbloqueo 30 min; retardo creciente ante fallos; envelope() redacta recetas (sin ingredientes ni nota) y producciones (sin líneas) cuando está bloqueado; /api/action rechaza recipe, deleteRecipe, produce, applyProduction y discardProduction bloqueados. Interfaz: panel de desbloqueo en Producción; en Configuración poner, cambiar, quitar y bloquear ahora. Es una contraseña única (no usuarios): con una sola persona basta; los permisos por persona quedan en TODO.
- Limpieza: acción purge (actividad anterior a la fecha conservando 50 entradas; movimientos intactos) y WhatsAppStore.purge (mensajes, envíos, notas y adjuntos anteriores a la fecha, solo dentro de files/). Preferencia retention_days (0/7/14/30/90) en settings; ejecución 5 s tras abrir y cada 6 h; botón «Limpiar ahora» con confirmación; la copia automática diaria precede.

## Pruebas
- Dominio: purge conserva recientes y movimientos. Canal: purge borra adjuntos y filas antiguas y conserva lo reciente. Servidor: flujo completo de contraseña (corta rechazada, recetas redactadas, acción bloqueada, contraseña incorrecta, desbloqueo, acción permitida, retirada) y retención (valores permitidos, purga sin restos).
- Sonda de seguridad 26/26; /api/lock y /api/maintenance exigen sesión, origen y JSON como el resto.

## Límites
- La contraseña protege la pantalla; el disco no está cifrado. Documentado en IA_LOCAL_Y_SEGURIDAD.md y en la propia pantalla.
- La limpieza no borra movimientos de stock (trazabilidad) ni copias; borrar movimientos antiguos requeriría una decisión explícita porque rompe el historial.

## Evidencia final
- npm test: 102 aprobadas (reports/tests-2026-09-09-v0110.txt). npm run format:check: aprobado. Sonda de seguridad: 26/26.
- npm run package:win: dist/GelatoStock-0.11.0-win32-x64.
- npm run test:desktop: 10 PASS (completa). reports/desktop-smoke-2026-09-09-v0110.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/schema.ts
 M core/store.ts
 M docs/IA_LOCAL_Y_SEGURIDAD.md
 M package-lock.json
 M package.json
 M src/server.cjs
 M src/styles.css
 M src/ui/actions.js
 M src/ui/core.js
 M src/ui/events.js
 M src/ui/views.js
 M src/whatsapp-store.cjs
 M tests/domain.test.cjs
 M tests/server.test.cjs
 M tests/whatsapp.test.cjs
?? reports/2026-09-09T10-42-22-808Z-recetario-contrasena-limpieza.md
?? reports/desktop-smoke-2026-09-09-v0110.txt
?? reports/tests-2026-09-09-v0110.txt
```
