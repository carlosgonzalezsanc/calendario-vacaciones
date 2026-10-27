import { CUPO_ASUNTOS_PROPIOS, DIAS_SAN_ISIDRO, type DiasGenerados } from '../domain/calculos';
import { IDS_MODALIDAD, nombreModalidad, TOTAL_VACACIONES } from '../domain/bloques';
import { formatoCorto, type ISODate } from '../domain/fechas';
import type { Bloque, Incidencia, ModalidadId, PlanAnio } from '../domain/tipos';
import { NOMBRE_MARCA } from '../domain/validar';

interface Props {
  plan: PlanAnio;
  bloques: Bloque[];
  generados: DiasGenerados;
  incidencias: Incidencia[];
  onModalidad: (m: ModalidadId) => void;
  onIr: (d: ISODate) => void;
}

export function Resumen({
  plan,
  bloques,
  generados,
  incidencias,
  onModalidad,
  onIr,
}: Props) {
  const usados = bloques.reduce((s, b) => s + (b.inicio ? b.dias : 0) + (b.puente ? 1 : 0), 0);
  const errores = incidencias.filter((i) => i.nivel === 'error');
  const avisos = incidencias.filter((i) => i.nivel === 'aviso');

  return (
    <div className="resumen">
      <label className="campo">
        <span>Modalidad de bloques</span>
        <select value={plan.modalidad} onChange={(e) => onModalidad(e.target.value as ModalidadId)}>
          {IDS_MODALIDAD.map((m) => (
            <option key={m} value={m}>
              {nombreModalidad(m)}
            </option>
          ))}
        </select>
      </label>

      <h3>Vacaciones</h3>
      <Medidor valor={usados} max={TOTAL_VACACIONES} etiqueta="días usados" />
      <ul className="lista-bloques">
        {bloques.map((b) => (
          <li key={b.indice}>
            <strong>
              Bloque {b.indice + 1} · {b.dias} días
            </strong>
            {b.inicio && b.fin ? (
              <button type="button" className="enlace" onClick={() => onIr(b.inicio!)}>
                {formatoCorto(b.inicio)} – {formatoCorto(b.fin)}
              </button>
            ) : (
              <span className="tenue">sin asignar</span>
            )}
            {b.puente && (
              <span className="tenue">
                · puente{' '}
                <button type="button" className="enlace" onClick={() => onIr(b.puente!)}>
                  {formatoCorto(b.puente)}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      <h3>{NOMBRE_MARCA.remanente}</h3>
      <Medidor valor={plan.remanente.length} max={generados.total} etiqueta="días usados" />
      <p className="tenue">
        Generados por tus bloques: {generados.domingos.length} en domingo y {generados.festivos.length} en festivo.
      </p>

      <h3>{NOMBRE_MARCA.asuntosPropios}</h3>
      <Medidor valor={plan.asuntosPropios.length} max={CUPO_ASUNTOS_PROPIOS} etiqueta="días usados" />

      <h3>{NOMBRE_MARCA.sanIsidro}</h3>
      <p>
        {plan.sanIsidro ? (
          <button type="button" className="enlace" onClick={() => onIr(plan.sanIsidro!)}>
            {formatoCorto(plan.sanIsidro)}
          </button>
        ) : (
          <span className="tenue">sin elegir</span>
        )}{' '}
        <span className="tenue">
          ({plan.sanIsidro ? DIAS_SAN_ISIDRO : 0} / {DIAS_SAN_ISIDRO} día)
        </span>
      </p>

      <h3>
        Errores <span className="contador">{errores.length}</span>
      </h3>
      {errores.length === 0 ? (
        <p className="ok">Sin errores.</p>
      ) : (
        <ListaIncidencias items={errores} onIr={onIr} />
      )}
      {avisos.length > 0 && (
        <details open={avisos.length <= 4}>
          <summary>
            Avisos <span className="contador aviso">{avisos.length}</span>
          </summary>
          <ListaIncidencias items={avisos} onIr={onIr} />
        </details>
      )}
    </div>
  );
}

function ListaIncidencias({ items, onIr }: { items: Incidencia[]; onIr: (d: ISODate) => void }) {
  return (
    <ul className="incidencias" aria-live="polite">
      {items.map((i, k) => (
        <li key={`${i.codigo}-${k}`} className={i.nivel}>
          {i.fechas[0] ? (
            <button type="button" className="enlace" onClick={() => onIr(i.fechas[0])}>
              {i.mensaje}
            </button>
          ) : (
            i.mensaje
          )}
          {i.pendienteVerificar && (
            <span className="pendiente" title="Regla del Excel pendiente de contrastar con el convenio">
              ⚠ pendiente de verificar
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Medidor({ valor, max, etiqueta }: { valor: number; max: number; etiqueta: string }) {
  const exceso = valor > max;
  return (
    <div className={`medidor${exceso ? ' exceso' : ''}`}>
      <div className="medidor-texto">
        <strong>
          {valor} / {max}
        </strong>{' '}
        {etiqueta} · quedan {Math.max(max - valor, 0)}
      </div>
      <div className="barra" role="meter" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={max} aria-label={etiqueta}>
        <div style={{ width: `${Math.min(100, (valor / Math.max(max, 1)) * 100)}%` }} />
      </div>
    </div>
  );
}
