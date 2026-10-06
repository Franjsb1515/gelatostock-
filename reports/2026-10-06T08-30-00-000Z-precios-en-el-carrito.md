# Precios en el carrito y en «Sugerir reposición» · 0.58.0 · 2026-10-05

Pedido del usuario: «lleva los precios al carrito y a sugerir reposición; los precios ahora mismo no sé si son por kilos o litros, eso podemos modificarlo después». El segundo encargo de la misma sesión (lector de imágenes con 50 tipos) lo hizo un agente en paralelo: reports/2026-10-06T08-00-00-000Z-lector-de-imagenes.md.

## Regla
Solo se comparan precios que la persona ya confirmó en el producto: el proveedor habitual y los otros proveedores apuntados (`alternates`), cada uno con su paquete y su precio. La lista de precios (0.57.0) no entra en la comparación hasta que la persona apunta una fila en el producto, porque la lista no dice si el importe es por kilo, litro o unidad.

## Qué cambió
- core/pricelist.ts `cartAdvice(state)`: por línea del carrito, `chosen` (proveedor elegido, paquetes, coste), `cheaper` (otro proveedor apuntado con el que la misma cantidad —paquetes × tamaño— sale más barata: paquetes que la cubren, coste y lo que baja) y `list` (la fila más barata de la lista para un ingrediente que se llama igual o que la persona juntó; `noted` si ese proveedor ya está apuntado en el producto). Un proveedor sin precio nunca se propone.
- Acción `cartCheapest {product?}` (core/domain.ts): pasa la línea (o todas) al proveedor más barato con los paquetes calculados. Nunca cambia el proveedor habitual del producto. Si no hay nada que bajar, lo dice y no hace nada.
- `suggest`: sigue proponiendo con el habitual; la nota dice cuántas líneas salen más baratas con otro proveedor.
- Sobre del servidor: `cartAdvice`. Pantalla (src/ui/views-orders.js): precio por unidad en cada línea; «Más barato con X: N paquetes de M kg = € (baja €)» con «Cambiar»; aviso encima del carrito con «Usar el más barato en todo»; «En tu lista de precios: PROVEEDOR a € … Apuntar este precio…» cuando el producto se llama como una fila de la lista.

## Pruebas
- tests/pricelist.test.cjs: 18 (dos nuevas): la propuesta va con el habitual y avisa; `cartAdvice` calcula paquetes y ahorro; `cartCheapest` cambia la línea y no el habitual; sin nada que bajar, rechaza; alternativo sin precio no se propone; precio de la lista para el nombre igual, sin comparar hasta apuntarlo; apuntado, pasa a compararse.
- work/check-carrito-precios.cjs sobre una COPIA de data/ con la lista real: aviso «Una línea sale más barata… bajaría 14,70 €»; «Usar el más barato en todo» cambia la línea y el habitual sigue igual; «Sugerir reposición» avisa y enseña «Más barato con …: 10 paquetes de 1 kg = 196,00 € (baja 49,00 €)»; sin desbordamiento a 1280 ni 1024 px; sin errores de página.
- npm test 281/281, chat 57/57. Ejecutable y prueba de escritorio: CHANGELOG.md.

## No hecho
- Unidad de la lista de precios: pendiente de que el usuario la diga.
- «Posibles iguales» (nombres parecidos) siguen sin proponerse: los junta la persona.
