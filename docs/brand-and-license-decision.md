# Decision de marca y licencia

## Estado actual

- `Fint`, el icono y el splash deben tratarse como temporales hasta completar una revision de marca.
- Los repositorios `finanzas-mobilev2` y `finanzas-api` no contienen una licencia.
- Un repositorio publico sin licencia no concede permiso para copiar, modificar o distribuir el codigo. Conserva los derechos por defecto, pero no comunica claramente el modelo del proyecto.
- Antes de publicar documentos legales se necesita un nombre definitivo, identidad visual, titular legal, correo de soporte y dominio oficial.

## Recomendacion de proceso

1. Definir si el producto sera comercial cerrado, open source o open core.
2. Seleccionar tres nombres finalistas.
3. Revisar marcas registradas en los paises objetivo, resultados en Google Play y App Store, dominios y usuarios en redes sociales.
4. Probar pronunciacion y recordacion con usuarios hispanohablantes y lusofonos.
5. Elegir nombre y registrar el dominio antes de producir el logo final.
6. Actualizar nombre, package metadata, icono, splash, textos legales y OAuth consent screen en una sola version de marca.

La disponibilidad de los nombres siguientes no esta validada legalmente. Son territorios creativos, no autorizaciones de uso.

## Territorios de nombre

### Numora

- Idea: numeros, orden y una relacion mas calmada con el dinero.
- Ventaja: pronunciacion sencilla en espanol y portugues.
- Personalidad: clara, tecnologica y cercana.
- Simbolo posible: una `N` construida con dos barras y un flujo ascendente.

### Cauce

- Idea: darle direccion al flujo del dinero.
- Ventaja: concepto fuerte y facil de explicar en espanol.
- Riesgo: palabra comun; requiere una revision de marca especialmente cuidadosa.
- Simbolo posible: una `C` abierta formada por dos corrientes.

### Saldoa

- Idea: saldos y control cotidiano.
- Ventaja: comunica finanzas rapidamente.
- Personalidad: practica y accesible.
- Simbolo posible: una `S` compuesta por flechas de ingreso y gasto.

### Orveta

- Idea: nombre inventado asociado con orden, avance y estabilidad.
- Ventaja: mayor posibilidad de diferenciacion verbal.
- Riesgo: necesita inversion inicial para explicar la categoria.
- Simbolo posible: orbita circular con un punto de balance.

### Nuvora

- Idea: una nueva vision del dinero y su evolucion.
- Ventaja: funciona como marca tecnologica regional.
- Riesgo: debe comprobarse que no se confunda con marcas existentes de software.
- Simbolo posible: arco ascendente dentro de una forma circular.

## Direccion visual recomendada

Mantener la base ocean-blue de la interfaz porque ya expresa confianza y continuidad, pero evitar el recurso generico de una moneda o un signo de dolar.

El sistema de identidad deberia incluir:

- Simbolo geometrico reconocible a 24 px.
- Logotipo horizontal para web, documentos y OAuth.
- Icono cuadrado sin texto para Android e iOS.
- Version monocromatica clara y oscura.
- Area de seguridad y tamano minimo.
- Paleta primaria, secundaria y colores semanticos.
- Archivos fuente SVG y exportaciones PNG de Play Store.

Tres direcciones visuales posibles:

1. Flujo: dos trayectorias que representan ingreso y gasto convergen en balance.
2. Claridad: una apertura o ventana dentro de una forma estable.
3. Progreso sereno: barras redondeadas sin apariencia especulativa o de trading.

La direccion `Flujo` encaja mejor con las funciones actuales de cuentas, movimientos, Gmail y reportes.

## Licencia

### Opcion recomendada para un producto comercial cerrado

- Cambiar ambos repositorios a privados.
- Agregar un aviso propietario con titular y ano.
- No aceptar contribuciones externas sin un acuerdo especifico.
- Mantener publicos solo la pagina de producto, documentacion de usuario y politica de privacidad.

Esta es la recomendacion para el MVP mientras se valida el modelo de negocio. Publicar el codigo no es necesario para distribuir la app en Play Store.

### Apache License 2.0

- Adecuada si se desea permitir uso, modificacion y distribucion, incluso comercial.
- Incluye una concesion explicita de patentes.
- Otros pueden crear productos cerrados a partir del codigo.
- Es preferible a MIT cuando se desea una licencia permisiva con mayor claridad legal.

### GNU AGPL 3.0

- Adecuada si el proyecto debe permanecer abierto incluso cuando una version modificada se ofrece como servicio web.
- Obliga a ofrecer el codigo fuente de las modificaciones a usuarios del servicio.
- Puede reducir adopcion empresarial y requiere revisar compatibilidad y estrategia comercial.

### MIT

- Muy simple y permisiva.
- Permite forks y productos comerciales cerrados.
- Tiene menos detalle sobre patentes que Apache 2.0.

## Decision pendiente

Elegir una sola direccion antes de crear archivos `LICENSE`:

- Producto comercial cerrado: repositorios privados y licencia propietaria.
- Proyecto abierto permisivo: Apache 2.0.
- Proyecto abierto con reciprocidad para servicios: AGPL 3.0.

No se recomienda mantener indefinidamente repositorios publicos sin licencia: aunque los derechos se conservan, colaboradores y usuarios no saben que usos estan permitidos.

## Documentos legales y dominio

Una vez elegida la marca:

1. Registrar un dominio oficial.
2. Publicar `/privacy`, `/terms` y `/support` como HTML responsive.
3. Usar el mismo nombre legal, marca, correo y fecha de vigencia en las tres paginas.
4. Configurar las URLs en EAS y Play Console.
5. Agregar enlaces visibles entre las paginas y un mecanismo de solicitud de eliminacion de cuenta.
