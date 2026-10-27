import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ANIOS, ESCOLAR, FESTIVOS, LOCALIDADES, localidadPorId } from './datos';
import { calcularBloques, cambiarModalidad } from './domain/bloques';
import { diasGenerados, marcasPorDia } from './domain/calculos';
import { formatoCorto, periodoAnio, type ISODate } from './domain/fechas';
import { festivosDe, mapaFestivos, NOMBRE_AMBITO, type MapaFestivos } from './domain/festivos';
import { aplicarPincel, comprobarCambio, crearPlanVacio, type Pincel } from './domain/pincel';
import type { PlanAnio, TipoPermiso } from './domain/tipos';
import { validar } from './domain/validar';
import {
  datosIniciales,
  LocalStorageRepository,
  normalizarDatos,
  type DatosUsuario,
  type StorageRepository,
} from './storage/StorageRepository';
import { Calendario } from './ui/Calendario';
import { Popup } from './ui/Popup';
import { Formularios, NOMBRE_PERMISO } from './ui/Formularios';
import { META_MARCA, nombrePincel, PINCELES } from './ui/marcas';
import { Resumen } from './ui/Resumen';

const repo: StorageRepository = new LocalStorageRepository();

function anioPorDefecto(): number {
  const actual = new Date().getFullYear();
  if (ANIOS.includes(actual + 1) && new Date().getMonth() >= 9) return actual + 1;
  return ANIOS.includes(actual) ? actual : ANIOS[ANIOS.length - 1];
}

export default function App() {
  const [datos, setDatos] = useState<DatosUsuario>(
    () => repo.load() ?? datosIniciales(LOCALIDADES[0].id, anioPorDefecto()),
  );
  const [pincel, setPincel] = useState<Pincel>('vacaciones');
  const [tipoPermiso, setTipoPermiso] = useState<TipoPermiso>('otro');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const [avisoLocalidad, setAvisoLocalidad] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'resumen' | 'fechas' | 'festivos'>('resumen');
  const anio = ANIOS.includes(datos.anio) ? datos.anio : ANIOS[ANIOS.length - 1];
  const [foco, setFoco] = useState<ISODate>(periodoAnio(anio).inicio);

  useEffect(() => repo.save(datos), [datos]);

  const localidad = localidadPorId(datos.localidadId);
  const listaFestivos = useMemo(() => festivosDe(localidad, anio, FESTIVOS), [localidad, anio]);
  const festivos = useMemo(() => mapaFestivos(listaFestivos), [listaFestivos]);
  const plan = datos.planes[anio] ?? crearPlanVacio();
  const bloques = useMemo(() => calcularBloques(plan), [plan]);
  const marcas = useMemo(() => marcasPorDia(plan, bloques), [plan, bloques]);
  const generados = useMemo(() => diasGenerados(bloques, festivos), [bloques, festivos]);
  const incidencias = useMemo(() => validar(plan, { anio, festivos }), [plan, anio, festivos]);
  const fechasConError = useMemo(
    () => new Set(incidencias.filter((i) => i.nivel === 'error').flatMap((i) => i.fechas)),
    [incidencias],
  );
  const escolar = datos.preferencias.escolar ? (ESCOLAR[localidad.ccaa] ?? null) : null;

  const planRef = useRef(plan);
  planRef.current = plan;

  const setPlan = useCallback(
    (p: PlanAnio) => setDatos((d) => ({ ...d, planes: { ...d.planes, [anio]: p } })),
    [anio],
  );

  /** Cambios desde formularios o la modalidad: no se guardan si dos marcas se pisan o algo sale de su plazo. */
  const setPlanComprobado = useCallback(
    (p: PlanAnio) => {
      const rechazo = comprobarCambio(planRef.current, p, anio);
      if (rechazo) setPopup(rechazo);
      else setPlan(p);
    },
    [setPlan, anio],
  );

  const onAplicar = useCallback(
    (desde: ISODate, hasta: ISODate) => {
      const r = aplicarPincel(planRef.current, pincel, desde, hasta, { anio, festivos }, { tipoPermiso });
      if (r.rechazo) {
        setPopup(r.rechazo);
        return;
      }
      setPlan(r.plan);
      setMensaje(r.mensaje ?? null);
    },
    [pincel, anio, festivos, tipoPermiso, setPlan],
  );

  const irA = useCallback((d: ISODate) => {
    setFoco(d);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-fecha="${d}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    });
  }, []);

  const cambiarLocalidad = (id: string) => {
    const nueva = mapaFestivos(festivosDe(localidadPorId(id), anio, FESTIVOS));
    const afectados = diasMarcadosQuePasanAFestivo(plan, bloques, festivos, nueva);
    setAvisoLocalidad(
      afectados.length
        ? `En ${localidadPorId(id).nombre} pasan a ser festivo días que tenías marcados: ${afectados
            .map((d) => `${formatoCorto(d)} (${nueva.get(d)!.nombre})`)
            .join(', ')}.`
        : null,
    );
    setDatos((d) => ({ ...d, localidadId: id }));
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendario-vacaciones-${anio}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importar = async (fichero: File | undefined) => {
    if (!fichero) return;
    try {
      const nuevos = normalizarDatos(JSON.parse(await fichero.text()));
      if (window.confirm('Se reemplazarán los datos guardados en este navegador por los del fichero. ¿Continuar?')) {
        setDatos(nuevos);
        setMensaje('Datos importados.');
      }
    } catch (e) {
      setMensaje(`No se ha podido importar: ${e instanceof Error ? e.message : 'fichero no válido'}`);
    }
  };

  const borrarTodo = () => {
    if (!window.confirm('Se borrarán todos tus datos de este navegador. Esta acción no se puede deshacer. ¿Continuar?'))
      return;
    repo.clear();
    setDatos(datosIniciales(datos.localidadId, anio));
    setMensaje('Datos borrados.');
  };

  const pendientes = listaFestivos.filter((f) => f.verificar).length;

  return (
    <div className="app">
      <header className="cabecera">
        <h1>Calendario de vacaciones</h1>
        <div className="controles">
          <label className="campo">
            <span>Localidad</span>
            <select value={localidad.id} onChange={(e) => cambiarLocalidad(e.target.value)}>
              {LOCALIDADES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Año</span>
            <select value={anio} onChange={(e) => setDatos((d) => ({ ...d, anio: Number(e.target.value) }))}>
              {ANIOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={datos.preferencias.verano}
              onChange={(e) =>
                setDatos((d) => ({ ...d, preferencias: { ...d.preferencias, verano: e.target.checked } }))
              }
            />
            Horario de verano
          </label>
          {ESCOLAR[localidad.ccaa] && (
            <label className="check">
              <input
                type="checkbox"
                checked={datos.preferencias.escolar}
                onChange={(e) =>
                  setDatos((d) => ({ ...d, preferencias: { ...d.preferencias, escolar: e.target.checked } }))
                }
              />
              Calendario escolar
            </label>
          )}
        </div>
      </header>

      <p className="banner privacidad" role="note">
        🔒 Tus datos se guardan <strong>solo en este navegador</strong>: no se envían a ningún servidor ni se
        sincronizan con otros equipos. Exporta una copia de vez en cuando.
      </p>
      {pendientes > 0 && (
        <p className="banner verificar" role="note">
          ⚠ {pendientes} festivo(s) de {localidad.nombre} están <strong>pendientes de verificar</strong> con su
          boletín oficial (marcados con «?» en el calendario).
        </p>
      )}
      {avisoLocalidad && (
        <p className="banner alerta" role="alert">
          {avisoLocalidad}{' '}
          <button type="button" className="enlace" onClick={() => setAvisoLocalidad(null)}>
            Cerrar
          </button>
        </p>
      )}

      <div className="principal">
        <main>
          <div className="pinceles" role="radiogroup" aria-label="Pincel activo">
            {PINCELES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={pincel === p}
                aria-label={nombrePincel(p)}
                className={`pincel p-${p}${pincel === p ? ' activo' : ''}`}
                title={p === 'borrar' ? 'Quita cualquier marca de los días pulsados' : META_MARCA[p].ayuda}
                onClick={() => setPincel(p)}
              >
                <span className={`muestra m-${p}`} aria-hidden="true">
                  {p === 'borrar' ? '⌫' : META_MARCA[p].inicial}
                </span>
                {nombrePincel(p)}
              </button>
            ))}
          </div>
          <div className="ayuda-pincel">
            <span>{pincel === 'borrar' ? 'Quita cualquier marca de los días pulsados.' : META_MARCA[pincel].ayuda}</span>
            {pincel === 'permiso' && (
              <label className="campo en-linea">
                <span>Tipo</span>
                <select value={tipoPermiso} onChange={(e) => setTipoPermiso(e.target.value as TipoPermiso)}>
                  {Object.entries(NOMBRE_PERMISO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="tenue">Arrastra para un rango · Mayús+clic extiende · flechas + Intro con teclado.</span>
          </div>
          <div className="mensaje" role="status" aria-live="polite">
            {mensaje}
          </div>

          <Leyenda escolar={!!escolar} verano={datos.preferencias.verano} />

          <Calendario
            anio={anio}
            festivos={festivos}
            marcas={marcas}
            fechasConError={fechasConError}
            escolar={escolar}
            verano={datos.preferencias.verano}
            foco={foco}
            onFoco={setFoco}
            onAplicar={onAplicar}
          />
        </main>

        <aside className="panel">
          <div className="pestanas" role="tablist">
            {(
              [
                ['resumen', 'Resumen'],
                ['fechas', 'Editar con fechas'],
                ['festivos', 'Festivos'],
              ] as const
            ).map(([k, v]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={pestana === k}
                className={pestana === k ? 'activa' : ''}
                onClick={() => setPestana(k)}
              >
                {v}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {pestana === 'resumen' && (
              <Resumen
                plan={plan}
                bloques={bloques}
                generados={generados}
                incidencias={incidencias}
                onModalidad={(m) => setPlanComprobado(cambiarModalidad(plan, m))}
                onIr={irA}
              />
            )}
            {pestana === 'fechas' && (
              <Formularios anio={anio} plan={plan} bloques={bloques} onCambio={setPlanComprobado} />
            )}
            {pestana === 'festivos' && (
              <ul className="festivos">
                {listaFestivos.map((f) => (
                  <li key={f.fecha}>
                    <button type="button" className="enlace" onClick={() => irA(f.fecha)}>
                      {formatoCorto(f.fecha)}
                    </button>{' '}
                    {f.nombre} <span className={`ambito a-${f.ambito}`}>{NOMBRE_AMBITO[f.ambito]}</span>
                    {f.verificar && <span className="pendiente">⚠ pendiente de verificar</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <section className="datos">
            <h3>Mis datos</h3>
            <div className="fila envolver">
              <button type="button" onClick={exportar}>
                Exportar JSON
              </button>
              <label className="boton">
                Importar JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => {
                    void importar(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <button type="button" className="peligro" onClick={borrarTodo}>
                Borrar mis datos
              </button>
            </div>
            {datos.actualizado && (
              <p className="tenue">Guardado en este navegador.</p>
            )}
          </section>
        </aside>
      </div>
      {popup && <Popup texto={popup} onCerrar={() => setPopup(null)} />}
    </div>
  );
}

function Leyenda({ escolar, verano }: { escolar: boolean; verano: boolean }) {
  return (
    <ul className="leyenda" aria-label="Leyenda">
      <li>
        <span className="muestra festivo">F</span> Festivo (? = pendiente de verificar)
      </li>
      <li>
        <span className="muestra finde" /> Fin de semana
      </li>
      <li>
        <span className="muestra error-m" /> Día con error
      </li>
      {verano && (
        <li>
          <span className="muestra verano-m" /> Horario de verano (15/6–15/9)
        </li>
      )}
      {escolar && (
        <>
          <li>
            <span className="muestra nolectivo-m" /> No lectivo
          </li>
          <li>
            <span className="muestra media-m" /> Media jornada escolar
          </li>
        </>
      )}
    </ul>
  );
}

/** Días marcados (inicio de bloque, días sueltos, puentes, San Isidro) que son festivo en la nueva localidad y no lo eran. */
function diasMarcadosQuePasanAFestivo(
  plan: PlanAnio,
  bloques: ReturnType<typeof calcularBloques>,
  antes: MapaFestivos,
  despues: MapaFestivos,
): ISODate[] {
  const candidatos = new Set<ISODate>([
    ...bloques.flatMap((b) => (b.inicio ? [b.inicio] : [])),
    ...plan.puentes.filter((x): x is ISODate => !!x),
    ...plan.remanente,
    ...plan.asuntosPropios,
    ...(plan.sanIsidro ? [plan.sanIsidro] : []),
  ]);
  return [...candidatos].filter((d) => despues.has(d) && !antes.has(d)).sort();
}
