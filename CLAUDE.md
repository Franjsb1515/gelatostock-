# Entrada para Claude

Leé y seguí AGENTS.md. El usuario quiere que revises este prototipo y modifiques lo que consideres necesario, conservando sus requisitos.

Primero revisá el último informe de reports/, README.md, TODO.md y docs/ARQUITECTURA_PROTOTIPO.md. Ejecutá las pruebas antes de proponer una reescritura. Separá fallos comprobados de mejoras opcionales.

El código fuente y el historial son la base de continuidad. WhatsApp, OCR y la IA local aún no están implementados. No confundas las pantallas de demostración con esos servicios.

Para cerrar una sesión: informe nuevo + CHANGELOG.md + TODO.md + pruebas con resultados. Si la interfaz cambió, guardar capturas y reconstruir la entrega cuando corresponda.

Entrega vigente 0.2.0: leer reports/2026-09-07-002-sqlite-typescript.md. El núcleo está en core/ (TypeScript estricto); build/ es generado. Conservar la migración del JSON antiguo. Revisar la decisión Electron/Tauri con mediciones, evitando sustituir una implementación comprobada por una alternativa sin validar.

Entrega vigente 0.3.0: leer reports/2026-09-07T22-46-07-183Z-bandeja-proveedores.md. Relevancia y prioridad separadas; no atribuir aprendizaje ni comprensión semántica a estas reglas.

Entrega vigente 0.4.0: reports/2026-09-07T23-36-54-807Z-archivo-proveedores-fotos.md. Las carpetas por proveedor son copias derivadas; SQLite/attachments siguen siendo canónicos. No borrar originales ni afirmar que OCR ya existe.
