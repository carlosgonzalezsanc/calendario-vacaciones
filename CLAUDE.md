# Web «Calendario de vacaciones» — instrucciones para Claude Code

> **Material de referencia:** en `docs/referencia/` están el Excel `Calendario_2027_calculo_vacaciones_vN2_1p.xlsx` (hojas `Calendario` y `Listas`, esta última oculta) y la prórroga del III CEV en dos versiones: el acuerdo firmado (`PRÓRROGA III CEV HASTA 31 DIC 2030_22 DIC 2025.pdf`) y su publicación en el BOE (`BOE-A-2026-2223.pdf`, BOE 30/01/2026). ⚠️ Falta el texto del III Convenio 2024–2026 original (BOE 28/02/2024), que es el que regula las vacaciones. Las reglas extraídas del Excel están resumidas en `docs/reglas.md`.
>
> **Leyenda de marcas:** ✅ verificado con fuente oficial o del convenio · ⚠️ pendiente de verificar · 💡 propuesta o inferencia.

## 1. Objetivo

Construir una web que sustituya al Excel. En ella, cada persona:
1. elige su localidad,
2. ve el calendario con los festivos nacionales, autonómicos, locales y de convenio,
3. **marca los días directamente sobre el calendario** (vacaciones, asuntos propios, bajas…),
4. recibe validaciones según el convenio,
5. guarda sus datos de forma privada: cada usuario ve solo lo suyo.

## 2. Funcionalidad

### 2.1 Selector de localidad y año

Las localidades de la v1 son:

| Localidad | Comunidad autónoma | Isla |
|---|---|---|
| Madrid | Comunidad de Madrid | — |
| Toledo | Castilla-La Mancha | — |
| Almería | Andalucía | — |
| Burgos | Castilla y León | — |
| Vigo | Galicia | — |
| Las Palmas de Gran Canaria | Canarias | Gran Canaria |

- El selector está siempre visible en la cabecera.
- Al cambiar de localidad se recalculan los festivos y las validaciones. Los días que ha marcado el usuario se conservan.
- Si un día marcado pasa a ser festivo, se avisa.
- Añadir más localidades en el futuro solo debe requerir añadir datos, sin tocar código.

### 2.2 Calendario interactivo (lo principal)

- Muestra enero–diciembre más enero del año siguiente, con la semana empezando en lunes.
- **Pincel activo:** el usuario elige el tipo de marca y hace clic, o arrastra para seleccionar un rango. Tipos de marca:
  - Vacaciones (bloque)
  - Remanente de vacaciones (los días generados)
  - Asuntos propios (los 6 días del convenio)
  - Puente (a costa de un bloque)
  - No imputable al año
  - Baja
  - Permiso por convenio
  - Día de San Isidro (un solo día al año)
- **Cada día admite una sola marca.**
  - Pulsar un día ya cogido con el mismo tipo lo cancela; si es un bloque, se cancela el bloque entero.
  - Marcar con otro tipo un día ya cogido (por ejemplo, un asunto propio dentro de un bloque) o hacer que dos bloques se solapen no se permite: sale un popup y el cambio no se guarda. Vale también para los formularios.
  - El pincel «borrar» quita cualquier marca.
- Alternativa accesible: en paralelo a los clics, ofrecer formularios con fecha de inicio y fin (como en el Excel).
- Cada día se colorea según su tipo y la web muestra una leyenda. Además del color, cada día lleva iniciales o un tooltip.
- Al pasar el ratón por un festivo se ve su nombre y su ámbito (nacional, autonómico, insular, local o convenio).
- Hay un panel lateral de resumen con:
  - días de vacaciones usados y restantes por bloque,
  - remanente usado frente a días generados, asuntos propios usados (de 6) y Día de San Isidro,
  - lista de errores.

### 2.3 Lógica heredada del Excel

1. **Modalidades de bloques** (en días naturales): `30`, `15+15`, `20+10`, `20+5+5`, `10+10+10` y `10+10+5+5`.
   - La fecha de fin se calcula como `inicio + días − 1`.
   - Al marcar con el pincel, se sugiere encajar la selección en un bloque de la modalidad elegida.
2. **Puente a costa del bloque:** el bloque pasa a tener 1 día menos y el día de puente cuenta como vacaciones. Como máximo hay un puente por bloque. (Se quitó y se volvió a añadir a petición de los compañeros, 27/10/2026.)
3. **Remanente de vacaciones y asuntos propios** (en el Excel eran un único cupo de «días sueltos» = 6 + generados):
   - Asuntos propios: **6** días (art. 102 h).
   - Remanente: tantos días como días generados = días de bloque que caen en domingo + días de bloque que caen en festivo.
   - ⚠️ La regla de días generados está en el Excel, pero no está en la prórroga (ver §4).
   - **Plazos:** asuntos propios, como las vacaciones, solo dentro del año natural. El **remanente** es lo único que puede cogerse hasta el **31 de enero del año siguiente**.
4. **Días no imputables, bajas y permisos por convenio**, cada uno con sus fechas.
5. **Día de San Isidro:** un único día al año que se coge como día libre. Es la jornada completa que da el art. 87 cuando no se disfruta la reducción de 2 h durante 5 días por fiestas locales (ver §4). Sustituye a la «semana reducida» del Excel.
   - **Derecho:** solo se tiene si se trabajan al menos **4 días de la semana de fiestas locales** (Madrid 2027: del 10 al 14 de mayo). Con 2 o más días de ausencia en esa semana se pierde. Cuenta como ausencia cualquier marca: vacaciones (bloques y puentes), días sueltos (remanente y asuntos propios), bajas, permisos por convenio y no imputables.
   - La semana va en los datos (`semanaFiestaLocal` de cada localidad en `data/festivos/AAAA.json`). Si una localidad no la tiene, no se comprueba.
   - Si un cambio hace perder el derecho, o se marca el día sin tenerlo, sale un popup de **aviso**. El cambio sí se guarda y el aviso aparece también en «Avisos» (`src/domain/sanIsidro.ts`).
6. **Calendario escolar** (informativo y opcional): de momento solo para Madrid. 💡 Para el resto de comunidades hay que conseguir los datos.

### 2.4 Validaciones (errores en rojo junto al día o campo; no bloquean el guardado)

- Un bloque no puede empezar en domingo ni en festivo.
- Entre los dos bloques de 5 días tiene que haber al menos 7 días.
- ⚠️ El segundo bloque de 5 días tiene que incluir un sábado (versión VN1.2 del Excel).
- No puede superarse el cupo de asuntos propios (6) ni el de remanente (días generados).
- Solo hay un Día de San Isidro al año (el pincel no deja coger un segundo).
- Aviso (no bloquea) si hay 2 o más días de ausencia en la semana de fiestas locales: se pierde el Día de San Isidro.
- **Plazos** (`src/domain/plazos.ts`):
  - Vacaciones (bloques), puentes, asuntos propios y Día de San Isidro solo dentro del **año natural**. Un bloque no puede quedar a caballo entre dos años.
  - Remanente de vacaciones, no imputables, bajas y permisos: hasta el **31/1 del año siguiente**.
  - El pincel y los formularios no dejan guardar nada fuera de plazo y lo avisan con un popup.

## 3. Datos de festivos 2027

**Fuentes:**
- **Nacionales:** Resolución de 8/10/2026 de la DG de Trabajo (BOE de 13/10/2026).
- **Autonómicos:** el decreto de cada comunidad, indicado en la tabla.
- **Locales:** acuerdos municipales o boletines, indicados en la tabla.
- **Convenio:** art. 88 de la prórroga del III CEV (Nochebuena y Nochevieja).

Los datos viven en `data/festivos/2027.json` (ver el fichero). Estado de verificación de cada dato:

| Dato | Estado | Fuente consultada |
|---|---|---|
| Nacionales y autonómicos MD, CM, AN, CN | ✅ | Decretos y resolución del BOE (vía laboral-social.com e INAP) |
| Autonómicos CL y GA | ⚠️ | Prensa y agregadores; falta el decreto oficial |
| 24 y 31 de diciembre | ✅ | Art. 88 de la prórroga del CEV |
| Madrid local | ⚠️ | Ayuntamiento (Pleno 29/09/2026); falta el BOCM |
| Toledo local | ⚠️ | CMM y ENCLM (Junta de Gobierno Local) |
| Almería local | ⚠️ | COPE (Pleno municipal) |
| Burgos local | ⚠️ | Cuenta oficial del Ayuntamiento en X y prensa local |
| Vigo local | ✅ | DOG de 26/10/2026, según Diario de Pontevedra |
| Las Palmas de GC local | ⚠️ | Agregadores que citan el BOC (Orden de 7/8/2026) |
| 1 y 6 de enero de 2028 | ⚠️ | El calendario de 2028 aún no está publicado |

Reglas para estos datos:
- Antes de desplegar, la web tiene que mostrar el aviso «pendiente de verificar» en los festivos con `verificar: true`.
- En ejecución no se descargan festivos de internet: los JSON se mantienen a mano cada año.

## 4. Revisión del convenio (prórroga del III CEV hasta el 31/12/2030)

- **La prórroga no modifica el artículo de vacaciones.** Las reglas de bloques, separaciones, sábado y días generados **no se pueden verificar con este PDF**. 💡 Habría que contrastarlas con el texto del III Convenio 2024–2026 original.

| Artículo | Qué dice | Impacto en la web |
|---|---|---|
| Art. 88 ✅ | Desde 2026, los días 24 y 31 de diciembre son festivos en las tres empresas. | Se cargan como festivos de «convenio» para todas las localidades. |
| Art. 87 ✅ | Reducción de 2 h diarias durante 5 días al año por fiestas locales. Si no puede disfrutarse, se cambia por una jornada completa más 2,5 h, antes del 31/12. Si se trabajan menos de 5 días esa semana, se descuentan 2 h por día no trabajado. | Se modela como un único «Día de San Isidro» (la jornada completa). Las 2,5 h extra no se registran. |
| Art. 102 h) ✅ | Fuerza mayor y asuntos propios suman **6 días al año en total**. Dos de ellos pueden fraccionarse en dos periodos cada uno. | Cupo de asuntos propios = 6. |
| Art. 102 a) ✅ | Matrimonio o pareja de hecho: 15 días naturales ininterrumpidos. | Opción predefinida en «Permisos por convenio». |
| Art. 102 j) ✅ | Voluntariado: hasta 15 h al año o 2 jornadas. | Texto informativo. |
| Art. 73 ✅ | Horario de verano del 15 de junio al 15 de septiembre (desde 2026). | Opcional: sombrear el periodo en el calendario. |

## 5. Persistencia por usuario

✅ **Decisión: opción A (solo en el navegador) para la v1.**
- Datos en `localStorage` bajo la clave versionada `calendario-vacaciones:v1`, con campo `schemaVersion`.
- Sin login ni backend: web estática.
- Aviso visible de que los datos solo existen en ese navegador y de que conviene exportarlos.
- Persistencia detrás de `StorageRepository` (`load()` / `save()`), para poder cambiar a backend + SSO en el futuro sin tocar la UI.
- **No guardar el motivo de las bajas**, solo las fechas (dato de salud, RGPD).
- Exportar/importar JSON y botón «borrar mis datos».
- Opciones B (backend + SSO) y C (BaaS) **no se implementan**.

## 6. Propuesta técnica

- **Stack:** Vite + TypeScript + React.
- **Fechas:** `date-fns`, siempre como fechas locales `YYYY-MM-DD`, nunca `Date` en UTC.
- **Dominio puro en `src/domain/`:** `festivosDe(localidad, año)`, `calcularBloques`, `diasGenerados`, `validar`.
- **Tests (Vitest):** nº de festivos por localidad sin duplicados; casos del Excel.
- **v2:** PDF/impresión, `.ics`, Excel.

## 7. Fases

1. Leer el Excel y resumir sus reglas en `docs/reglas.md`, resolviendo los ⚠️.
2. Dominio, datos de festivos y tests.
3. Calendario interactivo con pincel, selector de localidad y leyenda.
4. Panel de resumen y validaciones.
5. Persistencia local con export/import JSON, aviso y botón de borrar.
6. Accesibilidad y responsive.

## 8. Fuera de alcance en la v1

- Login, backend y sincronización entre dispositivos.
- Calendario de equipo.
- Integraciones con sistemas corporativos.
- Calendarios escolares de otras comunidades distintas de Madrid.

## 9. Comandos

- `npm install` — instala dependencias.
- `npm run dev` — servidor de desarrollo (http://localhost:5173).
- `npm test` — tests de dominio (Vitest).
- `npm run build` — comprueba tipos y genera la web estática en `dist/` (rutas relativas: se puede servir desde cualquier carpeta).

## 10. Estructura

- `data/festivos/AAAA.json`, `data/localidades.json`, `data/escolar/<CCAA>.json` — datos mantenidos a mano. Una localidad o un año nuevos = solo datos.
- `src/domain/` — lógica pura y testeada: `festivos.ts` (`festivosDe`), `bloques.ts` (`calcularBloques`), `calculos.ts` (`diasGenerados`, `marcasPorDia`, puentes), `plazos.ts` (`fueraDePlazo`), `sanIsidro.ts` (`estadoSanIsidro`), `validar.ts` (`validar`), `pincel.ts` (edición del plan).
- `src/storage/StorageRepository.ts` — interfaz `load()`/`save()` y la implementación en `localStorage`.
- `src/ui/` y `src/App.tsx` — interfaz React.
