import type { Bloque, PlanAnio, TipoMarca } from './tipos';
import { diasBloque } from './bloques';
import { esDomingo, rango, type ISODate } from './fechas';
import type { MapaFestivos } from './festivos';

/** Días de asuntos propios por convenio (art. 102 h; el Excel usa 6 desde VN 2.1). */
export const CUPO_ASUNTOS_PROPIOS = 6;
/** Jornada completa por fiestas locales (art. 87): un único día al año. */
export const DIAS_SAN_ISIDRO = 1;

export interface DiasGenerados {
  total: number;
  /** Días de bloque en domingo que no son festivo. */
  domingos: ISODate[];
  /** Días de bloque en festivo (incluidos los festivos en sábado o domingo). */
  festivos: ISODate[];
}

/**
 * Días generados (remanente de vacaciones) = días de bloque que caen en domingo
 * o en festivo. El Excel contaría dos veces un festivo en domingo; aquí cada día cuenta una vez.
 */
export function diasGenerados(bloques: Bloque[], festivos: MapaFestivos): DiasGenerados {
  const domingos: ISODate[] = [];
  const enFestivo: ISODate[] = [];
  const vistos = new Set<ISODate>();
  for (const b of bloques) {
    for (const d of diasBloque(b)) {
      if (vistos.has(d)) continue;
      vistos.add(d);
      if (festivos.has(d)) enFestivo.push(d);
      else if (esDomingo(d)) domingos.push(d);
    }
  }
  return { total: domingos.length + enFestivo.length, domingos, festivos: enFestivo };
}

/** Orden de prioridad visual (hoja Vista: V > S > N > B), más permisos y San Isidro. */
export const ORDEN_MARCAS: TipoMarca[] = [
  'vacaciones',
  'remanente',
  'asuntosPropios',
  'noImputable',
  'baja',
  'permiso',
  'sanIsidro',
];

export type MapaMarcas = Map<ISODate, TipoMarca[]>;

export function marcasPorDia(plan: PlanAnio, bloques: Bloque[]): MapaMarcas {
  const mapa: MapaMarcas = new Map();
  const add = (d: ISODate, t: TipoMarca) => {
    const xs = mapa.get(d);
    if (!xs) mapa.set(d, [t]);
    else xs.push(t);
  };
  for (const b of bloques) for (const d of diasBloque(b)) add(d, 'vacaciones');
  for (const d of plan.remanente) add(d, 'remanente');
  for (const d of plan.asuntosPropios) add(d, 'asuntosPropios');
  for (const d of plan.noImputables) add(d, 'noImputable');
  for (const d of plan.bajas) add(d, 'baja');
  for (const p of plan.permisos) for (const d of rango(p.inicio, p.fin)) add(d, 'permiso');
  if (plan.sanIsidro) add(plan.sanIsidro, 'sanIsidro');
  for (const xs of mapa.values()) xs.sort((a, b) => ORDEN_MARCAS.indexOf(a) - ORDEN_MARCAS.indexOf(b));
  return mapa;
}

/** Días con más de una marca (incluye dos bloques que se pisan: «vacaciones» repetido). */
export function diasSolapados(plan: PlanAnio, bloques: Bloque[]): Map<ISODate, TipoMarca[]> {
  return new Map([...marcasPorDia(plan, bloques)].filter(([, xs]) => xs.length > 1));
}
