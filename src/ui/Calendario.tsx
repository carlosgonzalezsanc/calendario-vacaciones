import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapaMarcas } from '../domain/calculos';
import { NOMBRE_AMBITO, type MapaFestivos } from '../domain/festivos';
import {
  aISO,
  diaSemana,
  enRango,
  esFinDeSemana,
  formatoLargo,
  nombreMes,
  periodoAnio,
  sumarDias,
  type ISODate,
} from '../domain/fechas';
import type { CalendarioEscolar, TipoMarca } from '../domain/tipos';
import { META_MARCA } from './marcas';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES_DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export interface CalendarioProps {
  anio: number;
  festivos: MapaFestivos;
  marcas: MapaMarcas;
  fechasConError: Set<ISODate>;
  escolar: CalendarioEscolar | null;
  verano: boolean;
  foco: ISODate;
  onFoco: (d: ISODate) => void;
  onAplicar: (desde: ISODate, hasta: ISODate) => void;
}

/** Meses de enero a diciembre más enero del año siguiente; la semana empieza en lunes. */
function meses(anio: number): { anio: number; mes: number }[] {
  return [...Array.from({ length: 12 }, (_, mes) => ({ anio, mes })), { anio: anio + 1, mes: 0 }];
}

export function Calendario(props: CalendarioProps) {
  const { anio, onAplicar, onFoco } = props;
  const [arrastre, setArrastre] = useState<{ desde: ISODate; hasta: ISODate } | null>(null);
  const arrastreRef = useRef(arrastre);
  arrastreRef.current = arrastre;
  const ignorarClick = useRef(false);
  const ancla = useRef<ISODate | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const { inicio: fini, fin: ffin } = periodoAnio(anio);

  // Arrastre con ratón o lápiz. En táctil no se arrastra (para no bloquear el scroll): cada toque es un clic.
  useEffect(() => {
    const mover = (e: PointerEvent) => {
      if (!arrastreRef.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-fecha]');
      const fecha = el?.dataset.fecha;
      if (fecha && fecha !== arrastreRef.current.hasta) setArrastre({ ...arrastreRef.current, hasta: fecha });
    };
    const soltar = () => {
      const a = arrastreRef.current;
      if (!a) return;
      setArrastre(null);
      ignorarClick.current = true;
      ancla.current = a.desde;
      onAplicar(a.desde, a.hasta);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, [onAplicar]);

  const alPulsar = useCallback((e: React.PointerEvent, fecha: ISODate) => {
    if (e.pointerType === 'touch' || e.button !== 0 || e.shiftKey) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).focus();
    setArrastre({ desde: fecha, hasta: fecha });
  }, []);

  // Clic de teclado (Intro/Espacio), toque, o Mayús+clic para un rango desde el último día pulsado.
  const alClicar = useCallback(
    (e: React.MouseEvent, fecha: ISODate) => {
      if (ignorarClick.current) {
        ignorarClick.current = false;
        return;
      }
      onFoco(fecha);
      if (e.shiftKey && ancla.current) {
        onAplicar(ancla.current, fecha);
      } else {
        ancla.current = fecha;
        onAplicar(fecha, fecha);
      }
    },
    [onAplicar, onFoco],
  );

  const alTeclear = useCallback(
    (e: React.KeyboardEvent, fecha: ISODate) => {
      const salto: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      const n = salto[e.key];
      if (n === undefined) return;
      e.preventDefault();
      const nueva = sumarDias(fecha, n);
      if (nueva < fini || nueva > ffin) return;
      onFoco(nueva);
      requestAnimationFrame(() =>
        contenedor.current?.querySelector<HTMLElement>(`[data-fecha="${nueva}"]`)?.focus(),
      );
    },
    [fini, ffin, onFoco],
  );

  const seleccion = arrastre
    ? arrastre.desde <= arrastre.hasta
      ? [arrastre.desde, arrastre.hasta]
      : [arrastre.hasta, arrastre.desde]
    : null;

  return (
    <div className="calendario" ref={contenedor} role="application" aria-label={`Calendario ${anio}`}>
      {meses(anio).map(({ anio: a, mes }) => (
        <Mes
          key={`${a}-${mes}`}
          {...props}
          anio={a}
          mes={mes}
          seleccion={seleccion}
          alPulsar={alPulsar}
          alClicar={alClicar}
          alTeclear={alTeclear}
        />
      ))}
    </div>
  );
}

interface MesProps extends CalendarioProps {
  mes: number;
  seleccion: string[] | null;
  alPulsar: (e: React.PointerEvent, fecha: ISODate) => void;
  alClicar: (e: React.MouseEvent, fecha: ISODate) => void;
  alTeclear: (e: React.KeyboardEvent, fecha: ISODate) => void;
}

const Mes = memo(function Mes(p: MesProps) {
  const semanas = useMemo(() => {
    const primero = aISO(new Date(p.anio, p.mes, 1));
    const huecos = (diaSemana(primero) + 6) % 7;
    const diasMes = new Date(p.anio, p.mes + 1, 0).getDate();
    const celdas: (ISODate | null)[] = [
      ...Array<null>(huecos).fill(null),
      ...Array.from({ length: diasMes }, (_, i) => sumarDias(primero, i)),
    ];
    while (celdas.length % 7) celdas.push(null);
    return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
  }, [p.anio, p.mes]);

  const titulo = nombreMes(p.anio, p.mes);
  return (
    <section className="mes" aria-label={titulo}>
      <h3>{titulo}</h3>
      <table>
        <thead>
          <tr>
            {DIAS.map((d, i) => (
              <th key={d} scope="col" abbr={NOMBRES_DIAS[i]}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((s, i) => (
            <tr key={i}>
              {s.map((fecha, j) => (
                <td key={j}>{fecha && <Dia fecha={fecha} {...p} />}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
});

function Dia({ fecha, ...p }: MesProps & { fecha: ISODate }) {
  const festivo = p.festivos.get(fecha);
  const marcas: TipoMarca[] = p.marcas.get(fecha) ?? [];
  const principal = marcas[0];
  const error = p.fechasConError.has(fecha);
  const seleccionado = p.seleccion ? enRango(fecha, p.seleccion[0], p.seleccion[1]) : false;
  const verano = p.verano && fecha.slice(5) >= '06-15' && fecha.slice(5) <= '09-15';
  const noLectivo = p.escolar?.noLectivos.find((x) => enRango(fecha, x.inicio, x.fin));
  const media = p.escolar?.mediaJornada.find((x) => enRango(fecha, x.inicio, x.fin));

  const lineas = [formatoLargo(fecha)];
  if (festivo) {
    lineas.push(
      `Festivo ${NOMBRE_AMBITO[festivo.ambito].toLowerCase()}: ${festivo.nombre}` +
        (festivo.verificar ? ' (pendiente de verificar)' : ''),
    );
  } else if (esFinDeSemana(fecha)) lineas.push('Fin de semana');
  for (const m of marcas) lineas.push(META_MARCA[m].nombre);
  if (verano) lineas.push('Horario de verano');
  if (noLectivo) lineas.push(`No lectivo: ${noLectivo.nombre}`);
  if (media) lineas.push(`Media jornada escolar: ${media.nombre}`);
  if (error) lineas.push('Tiene un error: revisa el panel');

  const clases = ['dia'];
  if (esFinDeSemana(fecha)) clases.push('finde');
  if (festivo) clases.push('festivo');
  if (principal) clases.push(`m-${principal}`);
  if (marcas.length > 1) clases.push('multi');
  if (error) clases.push('error');
  if (seleccionado) clases.push('sel');
  if (verano) clases.push('verano');
  if (noLectivo) clases.push('nolectivo');
  if (media) clases.push('media');

  const etiqueta = lineas.join('. ');
  return (
    <button
      type="button"
      className={clases.join(' ')}
      data-fecha={fecha}
      tabIndex={fecha === p.foco ? 0 : -1}
      title={lineas.join('\n')}
      aria-label={etiqueta}
      onPointerDown={(e) => p.alPulsar(e, fecha)}
      onClick={(e) => p.alClicar(e, fecha)}
      onKeyDown={(e) => p.alTeclear(e, fecha)}
    >
      <span className="num">{Number(fecha.slice(8))}</span>
      {(principal || festivo) && (
        <span className="ini" aria-hidden="true">
          {principal ? marcas.map((m) => META_MARCA[m].inicial).join('') : 'F'}
          {festivo?.verificar && !principal ? '?' : ''}
        </span>
      )}
    </button>
  );
}
