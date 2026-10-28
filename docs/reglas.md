# Reglas extraídas del Excel

Fuente: `docs/referencia/Calendario_2027_calculo_vacaciones_vN2_1p.xlsx` (versión VN 2.1). Hojas `Calendario` (visible), `Listas` y `Vista` (ocultas).

**Leyenda:** ✅ confirmado en el Excel · ⚠️ pendiente de contrastar con el convenio · 💡 decisión tomada para la web.

## 1. Rangos de fechas

En el Excel todas las secciones admiten fechas del 1/1/año al 31/1/año+1 (`AS2:AT2`, `FINI` y `FFIN`) ✅. 💡 En la web hay dos plazos (petición del usuario, 27/10/2026):

| Sección | Plazo en la web |
|---|---|
| Vacaciones (bloques), puentes, asuntos propios, Día de San Isidro | **Año natural** (1/1 – 31/12). Un bloque no puede quedar a caballo entre dos años |
| Remanente de vacaciones, no imputables, bajas, permisos | 1/1/año – **31/1/año+1** |

| Otra sección | Rango permitido | Celdas |
|---|---|---|
| Calendario escolar | 1/9/año−1 – 30/9/año | `AS3:AT3` ✅ |

En el Excel las validaciones son de tipo «fecha entre». En la web, el pincel y los formularios no dejan guardar nada fuera de plazo: lo avisan con un popup. Si llega en un JSON importado, se muestra como error.

## 2. Bloques de vacaciones

- **Modalidades** (`Listas!B3:F8`) ✅:

  | Modalidad | B1 | B2 | B3 | B4 |
  |---|---|---|---|---|
  | 30 | 30 | | | |
  | 15+15 | 15 | 15 | | |
  | 20+10 | 20 | 10 | | |
  | 20+5+5 | 20 | 5 | 5 | |
  | 10+10+10 | 10 | 10 | 10 | |
  | 10+10+5+5 | 10 | 10 | 5 | 5 |

- **Fin del bloque** = `inicio + días − 1` (`AO6 = AN6 + AS6 − 1`) ✅. Los días son naturales.
- **Puente a costa del bloque** ✅: cada fila de bloque tiene una casilla de puente (`AP6:AP9`). Si se rellena, el bloque pasa a tener 1 día menos (`AS6 = VLOOKUP(...) − IF(AP6<>"",1,0)`). Como máximo hay un puente por bloque. El día de puente no genera remanente.
- **Lista de puentes** ✅: en el Excel el puente solo se puede elegir de una lista cerrada (`Puentes_L`, `AM79:AM86`). Para 2027 solo contiene el **7/12/2027**.
  - 💡 En la web los puentes posibles se calculan solos: son los días laborables que tienen un día no laborable antes y después. Si el usuario marca un puente que no cumple esto, se le avisa.
- **Inicio de bloque** ✅ (comentario de `AN5` + formato condicional de `AN6:AN9`): un bloque no puede empezar en domingo ni en festivo.
- **Separación entre bloques de 5 días** ✅ (comentario de `AN5` + formato condicional de `AN8` y `AN9`): entre los dos bloques de 5 días tiene que haber al menos 7 días.
  - `AN8`: error si `AN7 + 12 > AN8` (modalidad 20+5+5).
  - `AN9`: error si `|AO8 − AN9| ≤ 7` (modalidad 10+10+5+5).
  - 💡 La web lo aplica igual para las dos modalidades: días entre el fin del primer bloque de 5 y el inicio del segundo (en orden de fechas) ≥ 7.
- **Sábado en el segundo bloque de 5** ⚠️: el changelog (VN1.2) dice «se controla que el segundo periodo de 5 días tenga un sábado». En el Excel solo aparece como rótulo «(con Sáb)» en la **tercera fila** de bloques, sin formato condicional que lo compruebe.
  - En 20+5+5 la tercera fila es el segundo bloque de 5, así que coincide.
  - En 10+10+5+5 la tercera fila es el **primer** bloque de 5. Ahí no coincide con el changelog.
  - 💡 La web sigue el changelog: el **segundo bloque de 5 días** (el cuarto bloque en 10+10+5+5) tiene que incluir un sábado. Se muestra marcado como «pendiente de verificar».

## 3. Días sueltos (en la web: remanente de vacaciones + asuntos propios)

- **Cupo** ✅ = `6 + días generados` (`AS12 = 6 + Listas!H1 + Listas!I1`).
  - El comentario de `AM12` dice «4 días por convenio», pero la fórmula y el changelog VN 2.1 usan **6**. Encaja con el art. 102 h) de la prórroga (6 días en total). Se usa 6.
- **Días generados** ✅ (`Listas!G:I`): de cada día de los bloques (desde el inicio al fin):
  - +1 si es domingo (`Domingos`),
  - +1 si es festivo (`Fiestas`, que incluye los festivos en sábado y el 24 y 31 de diciembre).
  - ⚠️ En el Excel un festivo en domingo contaría **dos veces** (una en cada columna). En 2027 solo pasa en Canarias (30 de mayo). 💡 La web cuenta cada día **una sola vez**.
  - ⚠️ Los festivos en sábado sí generan día en el Excel (por ejemplo, el 1 de mayo de 2027). La web mantiene ese comportamiento.
- El Excel tiene 19 filas de sueltos y oscurece las que superan el cupo.
- 💡 **En la web el cupo se separa en dos tipos** (petición del usuario, 27/10/2026): «Asuntos propios» con cupo 6 y «Remanente de vacaciones» con cupo = días generados. Error si se supera cualquiera de los dos. Los datos guardados con la versión anterior se migran: los 6 primeros sueltos pasan a asuntos propios y el resto a remanente.
- Comentario de `AM13`, `AM14` y `AN15`: «2 días de asuntos propios se pueden tomar por horas en distintos días». El art. 102 h) dice que dos de los días pueden fraccionarse en dos periodos cada uno. 💡 La web muestra el texto del convenio como ayuda y no valida el fraccionamiento.
- Comentario de `AM11`: «no se ha contabilizado el día por fiesta local».

## 4. Otras marcas

| Marca | Celdas | Datos que se guardan |
|---|---|---|
| No imputables al año (días sin sueldo o de otro año) ✅ | `AN13:AN31` (`sinSueldo`) | Fechas sueltas |
| Bajas ✅ | `AP13:AP31` (`Bajas`); `AQ` = motivo | Solo fechas. 💡 **No se guarda el motivo** (dato de salud, RGPD) |
| Permisos por convenio ✅ | `AN35:AO38` (inicio, fin) + `AP` motivo; hasta 4 periodos | Inicio, fin y tipo de permiso |
| Semana reducida por fiesta local ✅ | `AM42:AN42` (inicio, fin) | 💡 Sustituida por el «Día de San Isidro»: una sola fecha |

- **Semana reducida → Día de San Isidro**: en el Excel hay un periodo libre (inicio–fin). 💡 Por petición del usuario, la web lo sustituye por un único día al año. Encaja con el art. 87 de la prórroga ✅: si no se puede disfrutar la reducción, se da «una jornada completa no fraccionable y dos horas y media de descanso continuado» antes del 31/12. Las 2,5 h no se registran.

## 4 bis. Derecho al Día de San Isidro

💡 Regla indicada por el usuario (28/10/2026), coherente con el art. 87 de la prórroga ✅. Según ese artículo, la reducción se aplica «exclusivamente a aquellas personas trabajadoras que estén desempeñando efectivamente su actividad laboral durante dichos días».

- El Día de San Isidro solo se puede usar si se trabajan **al menos 4 días** de la semana de fiestas locales (Madrid 2027: **10–14 de mayo**).
- Con **2 o más días** de vacaciones (bloque o puente) o días sueltos (remanente o asuntos propios) en esa semana, **se pierde el derecho**. Solo cuentan los días laborables.
- ⚠️ Las bajas, los permisos por convenio y los no imputables **no** cuentan como ausencia para esta regla. Pendiente de confirmar.
- En la web es un **aviso**, no un bloqueo: sale un popup al perder el derecho (o al marcar el día sin tenerlo) y queda en la lista de avisos.

## 5. Un día, una marca

En el Excel un día podía tener varias marcas y la hoja `Vista` las ordenaba: Vacaciones (V) > Suelto (S) > Puente (P) > No imputable (N) > Baja (B) ✅ .

💡 En la web (petición del usuario, 27/10/2026) **cada día admite una sola marca**:
- Pulsar un día con el mismo tipo lo cancela (un bloque se cancela entero).
- Marcarlo con otro tipo, o crear un bloque que se solape con otro, se rechaza con un popup y no se guarda. Igual desde los formularios.
- Si llegan solapes en un JSON importado, se muestran como error.

Iniciales en el calendario: V vacaciones, R remanente, A asuntos propios, P puente, N no imputable, B baja, C permiso por convenio, I Día de San Isidro.

## 6. Festivos

- En el Excel los festivos se escriben a mano (`AM43:AM61`) con tipo Nacional, Autonómico o Local. El 24 y el 31 de diciembre aparecen como «Nacional — Por convenio». 💡 En la web tienen su propio ámbito, «convenio».
- Los festivos de Madrid del Excel coinciden con `data/festivos/2027.json` ✅ (16 en 2027, más el 1 y el 6 de enero de 2028).
- Laborable = de lunes a viernes y no festivo. El sábado no es laborable.

## 7. Calendario escolar (solo Madrid)

Datos del Excel (`AM64:AN72` no lectivos y `AM75:AN76` media jornada), curso 2026–2027 ⚠️ (sin fuente oficial). Se guardan en `data/escolar/MD.json`.
