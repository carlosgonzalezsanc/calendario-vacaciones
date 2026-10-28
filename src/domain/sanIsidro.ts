import type { PlanAnio, SemanaFiestaLocal, TipoMarca } from './tipos';
import { calcularBloques } from './bloques';
import { marcasPorDia } from './calculos';
import { formatoCorto, rango, type ISODate } from './fechas';
import { esLaborable, type MapaFestivos } from './festivos';

/**
 * Para tener derecho al Día de San Isidro hay que trabajar al menos 4 días de la semana de fiestas
 * locales: con 2 días de ausencia o más, se pierde.
 */
export const MAX_DIAS_AUSENCIA_SEMANA_FIESTA = 1;

/** Cuenta como ausencia cualquier marca salvo el propio Día de San Isidro. */
const AUSENCIAS: TipoMarca[] = [
  'vacaciones',
  'puente',
  'remanente',
  'asuntosPropios',
  'noImputable',
  'baja',
  'permiso',
];

export interface EstadoSanIsidro {
  semana: SemanaFiestaLocal;
  /** Días laborables de la semana con alguna ausencia. */
  diasAusencia: ISODate[];
  pierdeDerecho: boolean;
}

export function estadoSanIsidro(
  plan: PlanAnio,
  semana: SemanaFiestaLocal | null | undefined,
  festivos: MapaFestivos,
): EstadoSanIsidro | null {
  if (!semana) return null;
  const marcas = marcasPorDia(plan, calcularBloques(plan));
  const diasAusencia = rango(semana.inicio, semana.fin).filter(
    (d) => esLaborable(d, festivos) && marcas.get(d)?.some((t) => AUSENCIAS.includes(t)),
  );
  return { semana, diasAusencia, pierdeDerecho: diasAusencia.length > MAX_DIAS_AUSENCIA_SEMANA_FIESTA };
}

export function textoPerdidaSanIsidro(e: EstadoSanIsidro): string {
  const f = formatoCorto;
  const nombre = e.semana.nombre ?? 'semana de fiestas locales';
  return `Tienes ${e.diasAusencia.length} días de ausencia (vacaciones, días sueltos, bajas, permisos o no imputables) en la ${nombre} (${f(e.semana.inicio)} – ${f(e.semana.fin)}). Para tener derecho al Día de San Isidro hay que trabajar al menos 4 días de esa semana, así que lo pierdes.`;
}

/**
 * Aviso (no bloquea) cuando un cambio hace perder el derecho al Día de San Isidro, o cuando se
 * marca el Día de San Isidro sin tener derecho.
 */
export function avisoSanIsidro(
  antes: PlanAnio,
  despues: PlanAnio,
  semana: SemanaFiestaLocal | null | undefined,
  festivos: MapaFestivos,
): string | null {
  const ahora = estadoSanIsidro(despues, semana, festivos);
  if (!ahora?.pierdeDerecho) return null;
  const previo = estadoSanIsidro(antes, semana, festivos);
  const acabaDePerderlo = !previo?.pierdeDerecho;
  const acabaDeMarcarlo = !!despues.sanIsidro && despues.sanIsidro !== antes.sanIsidro;
  if (!acabaDePerderlo && !acabaDeMarcarlo) return null;
  const extra = despues.sanIsidro
    ? ` El Día de San Isidro que tienes marcado (${formatoCorto(despues.sanIsidro)}) no se podría disfrutar.`
    : '';
  return textoPerdidaSanIsidro(ahora) + extra;
}
