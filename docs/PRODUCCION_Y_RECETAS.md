# Producción y recetas · 0.9.0

## Qué hace
Una receta define cuántos kilos de gelato rinde y cuánto usa de cada ingrediente para esa cantidad, en la unidad base del ingrediente (kg, L o ud). Opcionalmente se vincula a un producto terminado medido en kg.

Registrar producción = elegir receta, kilos producidos y día. La app escala la receta por regla de tres y muestra una propuesta: consumo estimado por ingrediente, stock actual y producto terminado. Nada cambia hasta aprobar. La persona corrige cualquier cantidad (incluido 0 para no descontar), ajusta los kilos terminados, añade una nota y aprueba o descarta.

Aprobar crea movimientos de salida con motivo «producción» por cada ingrediente y una entrada del producto terminado, todos vinculados a la producción. Se revierten con la corrección habitual de movimientos. El stock resultante es una estimación hasta el siguiente conteo.

La hoja diaria lista, por día y gelato, los kilos aprobados y el consumo. Si un ingrediente queda por debajo del mínimo, el registro de actividad lo indica y «Preparar reposición» lo incluye.

## Qué no hace
- No usa IA: es aritmética con la receta. No estima mermas, rendimientos variables ni tiempos.
- No descuenta sin aprobación ni deja stock negativo: si el consumo supera el stock, pide contar o corregir antes.
- No gestiona lotes, caducidades ni ventas. Los kilos terminados entran como stock; salidas por venta o merma se registran a mano.
- Las unidades en «ud» se redondean hacia arriba en la propuesta; la persona puede corregirlas.

## Datos
Tablas SQLite recipes y productions (user_version 2). Las bases anteriores se abren sin migración de datos: las tablas se crean vacías y la semilla nueva incluye una receta de ejemplo solo en instalaciones nuevas. Las copias exportadas incluyen recetas y producciones.

## Pruebas
tests/domain.test.cjs: escalado, unidades enteras, producto terminado en kg, aprobación editable, terminado, descarte, reversión, stock negativo y aviso de mínimos. tests/store.test.cjs: persistencia y reinicio. scripts/desktop-smoke.cjs: flujo real en el ejecutable.
