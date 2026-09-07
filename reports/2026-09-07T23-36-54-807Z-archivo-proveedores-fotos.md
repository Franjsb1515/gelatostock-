# Sesión 004 — 2026-09-07 — Archivo por proveedor y fecha, versión 0.4.0

## Objetivo

Organizar fotos y datos en carpetas automáticas por proveedor y fecha. Explicar el seguimiento de pedidos mostrado por el usuario y mejorar sus textos.

## Cambios y motivos

Cada proveedor recibe una carpeta estable bajo data/proveedores, con proveedor.json (ficha), datos.json (productos, pedidos, mensajes y metadatos de fotos) y fotos/AAAA-MM-DD. indice.json relaciona nombres visibles con carpetas. Se usa SHA-256 del identificador como nombre de carpeta, evitando conflictos entre nombres iguales, caracteres incompatibles y renombrados. La ficha conserva el nombre humano.

Al subir fotos se eligen proveedor y fecha del documento. Sin proveedor es una opción explícita. Las fotos antiguas conservan el original y usan la fecha UTC de carga como alternativa hasta clasificarlas. El botón Organizar permite cambiar proveedor/fecha después. Las fechas se validan como días reales, y el proveedor debe existir. Cada imagen tiene un archivo JSON lateral con nombre original, fecha, nota e identificadores.

El archivo organizado es una copia derivada; SQLite y attachments siguen siendo la fuente vigente. Se genera al iniciar, guardar y restaurar, después del commit. Si falla, se conserva la transacción y se avisa por respuesta API, mensaje y Configuración; vuelve a intentar en el siguiente guardado o arranque. Se evitan escrituras de JSON idéntico. No sigue enlaces simbólicos en las carpetas del archivo.

Reclasificar conserva copias históricas en rutas anteriores; no se borran automáticamente. El catálogo actual de la app es la referencia vigente. Copias derivadas ocupan espacio adicional. Editar manualmente esos JSON no importa cambios a SQLite. Las copias portables de Configuración incluyen imágenes y metadatos y reconstruyen carpetas al restaurar. Archivos que el usuario añada directamente desde el explorador no se importan ni se incluyen automáticamente en respaldos.

Seguimiento de pedidos: texto explica que enviar no suma stock; cuenta tipos de producto y etiqueta importes estimados. Cada estado incorpora explicación: no contactado, faltan cantidades, completado o cancelado. La simulación continúa explícita.

## Pruebas ejecutadas y resultados

- TypeScript estricto y npm test: 40/40 aprobadas.
- Nuevas pruebas: carpeta al crear proveedor y estabilidad al renombrar; foto por fecha/proveedor, reclasificación y restauración; compatibilidad antigua y rechazo de fecha/proveedor inválidos; fallo inducido del archivo derivado sin pérdida de datos y recuperación posterior.
- npm run format:check aprobado.
- npm run package:win aprobado; ejecutable 0.4.0 generado.
- npm run test:desktop aprobado: subida con proveedor/fecha, reclasificación desde Organizar, existencia de carpeta, flujos anteriores de stock/mensajes y reinicio. Fixtures separados en work.
- Captura output/playwright/v04-fotos.png revisada: nombre de proveedor, fecha y acción Organizar visibles. Evidencias reports/tests-2026-09-07-v04.txt y reports/desktop-smoke-2026-09-07-v04.txt.

## Limitaciones y siguiente paso

No se ejecuta OCR ni se extraen cantidades. Fotos JPG/PNG/WebP hasta 5 MB; PDF todavía no. No hay sincronización, lectura automática de carpetas ni importación de archivos arbitrarios. OCR local pendiente con revisión humana antes de cambiar stock. Mac no probado. El archivo derivado no sustituye el respaldo portable.

El diff creado por la plantilla es una fotografía intermedia de archivos seguidos. El parche final del commit se conserva en reports/patches.

## Activación local

Se cerró normalmente 0.3, se crearon carpetas para los cuatro proveedores existentes, se generó copia portable y se abrió 0.4. Estado completo verificado idéntico antes/después, sin advertencia de archivo.
