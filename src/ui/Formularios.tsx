import { useId, useState } from 'react';
import { formatoCorto, periodoAnio, sumarDias, type ISODate } from '../domain/fechas';
import { nuevoId } from '../domain/pincel';
import type { Bloque, PlanAnio, TipoPermiso } from '../domain/tipos';
import { DIAS_PERMISO_MATRIMONIO, NOMBRE_MARCA } from '../domain/validar';

/** Alternativa accesible al pincel: las mismas marcas con campos de fecha, como en el Excel. */
export function Formularios({
  anio,
  plan,
  bloques,
  onCambio,
}: {
  anio: number;
  plan: PlanAnio;
  bloques: Bloque[];
  onCambio: (p: PlanAnio) => void;
}) {
  const { inicio: min, fin: max } = periodoAnio(anio);
  const fijarInicio = (i: number, v: string) =>
    onCambio({ ...plan, bloques: plan.bloques.map((x, k) => (k === i ? v || null : x)) });

  return (
    <div className="formularios">
      <fieldset>
        <legend>Bloques de vacaciones</legend>
        {bloques.map((b) => (
          <div key={b.indice} className="fila-bloque">
            <label className="campo">
              <span>
                Bloque {b.indice + 1} ({b.dias} días) · inicio
              </span>
              <input
                type="date"
                min={min}
                max={max}
                value={b.inicio ?? ''}
                onChange={(e) => fijarInicio(b.indice, e.target.value)}
              />
            </label>
            <span className="tenue fin">{b.fin ? `fin ${formatoCorto(b.fin)}` : ''}</span>
          </div>
        ))}
      </fieldset>

      <ListaFechas
        titulo={NOMBRE_MARCA.remanente}
        fechas={plan.remanente}
        min={min}
        max={max}
        onCambio={(remanente) => onCambio({ ...plan, remanente })}
      />
      <ListaFechas
        titulo={NOMBRE_MARCA.asuntosPropios}
        fechas={plan.asuntosPropios}
        min={min}
        max={max}
        onCambio={(asuntosPropios) => onCambio({ ...plan, asuntosPropios })}
      />
      <ListaFechas
        titulo={`No imputables a ${anio}`}
        fechas={plan.noImputables}
        min={min}
        max={max}
        onCambio={(noImputables) => onCambio({ ...plan, noImputables })}
      />
      <ListaFechas
        titulo="Bajas (solo fechas)"
        fechas={plan.bajas}
        min={min}
        max={max}
        onCambio={(bajas) => onCambio({ ...plan, bajas })}
      />

      <Permisos plan={plan} min={min} max={max} onCambio={onCambio} />

      <fieldset>
        <legend>{NOMBRE_MARCA.sanIsidro}</legend>
        <label className="campo">
          <span>Fecha (un solo día)</span>
          <input
            type="date"
            min={min}
            max={max}
            value={plan.sanIsidro ?? ''}
            onChange={(e) => onCambio({ ...plan, sanIsidro: e.target.value || null })}
          />
        </label>
        <p className="tenue">
          Art. 87: si no se puede disfrutar la reducción de 2 h durante 5 días por fiestas locales, se cambia por
          una jornada completa no fraccionable (más 2,5 h de descanso) antes del 31/12.
        </p>
      </fieldset>
    </div>
  );
}

function ListaFechas({
  titulo,
  fechas,
  min,
  max,
  onCambio,
}: {
  titulo: string;
  fechas: ISODate[];
  min: string;
  max: string;
  onCambio: (xs: ISODate[]) => void;
}) {
  const [nueva, setNueva] = useState('');
  const id = useId();
  return (
    <fieldset>
      <legend>{titulo}</legend>
      <ul className="chips">
        {fechas.map((d) => (
          <li key={d}>
            {formatoCorto(d)}
            <button
              type="button"
              aria-label={`Quitar ${formatoCorto(d)}`}
              onClick={() => onCambio(fechas.filter((x) => x !== d))}
            >
              ×
            </button>
          </li>
        ))}
        {fechas.length === 0 && <li className="tenue vacio">Ninguno</li>}
      </ul>
      <form
        className="fila"
        onSubmit={(e) => {
          e.preventDefault();
          if (nueva && !fechas.includes(nueva)) onCambio([...fechas, nueva].sort());
          setNueva('');
        }}
      >
        <label htmlFor={id} className="sr-only">
          Añadir fecha a {titulo}
        </label>
        <input id={id} type="date" min={min} max={max} value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <button type="submit" disabled={!nueva}>
          Añadir
        </button>
      </form>
    </fieldset>
  );
}

const NOMBRE_PERMISO: Record<TipoPermiso, string> = {
  matrimonio: 'Matrimonio o pareja de hecho (15 días)',
  nacimiento: 'Nacimiento y cuidado de menor',
  otro: 'Otro permiso',
};

function Permisos({
  plan,
  min,
  max,
  onCambio,
}: {
  plan: PlanAnio;
  min: string;
  max: string;
  onCambio: (p: PlanAnio) => void;
}) {
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [tipo, setTipo] = useState<TipoPermiso>('otro');
  return (
    <fieldset>
      <legend>Permisos por convenio</legend>
      <ul className="chips">
        {plan.permisos.map((p) => (
          <li key={p.id}>
            {formatoCorto(p.inicio)} – {formatoCorto(p.fin)} · {NOMBRE_PERMISO[p.tipo]}
            <button
              type="button"
              aria-label={`Quitar permiso del ${formatoCorto(p.inicio)}`}
              onClick={() => onCambio({ ...plan, permisos: plan.permisos.filter((x) => x.id !== p.id) })}
            >
              ×
            </button>
          </li>
        ))}
        {plan.permisos.length === 0 && <li className="tenue vacio">Ninguno</li>}
      </ul>
      <form
        className="fila envolver"
        onSubmit={(e) => {
          e.preventDefault();
          if (!inicio) return;
          const f = fin && fin >= inicio ? fin : tipo === 'matrimonio' ? sumarDias(inicio, DIAS_PERMISO_MATRIMONIO - 1) : inicio;
          onCambio({ ...plan, permisos: [...plan.permisos, { id: nuevoId(), inicio, fin: f, tipo }] });
          setInicio('');
          setFin('');
        }}
      >
        <label className="campo">
          <span>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPermiso)}>
            {Object.entries(NOMBRE_PERMISO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Inicio</span>
          <input type="date" min={min} max={max} value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label className="campo">
          <span>Fin</span>
          <input type="date" min={inicio || min} max={max} value={fin} onChange={(e) => setFin(e.target.value)} />
        </label>
        <button type="submit" disabled={!inicio}>
          Añadir
        </button>
      </form>
    </fieldset>
  );
}

export { NOMBRE_PERMISO };
