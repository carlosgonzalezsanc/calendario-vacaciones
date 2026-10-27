import type { AmbitoFestivo, DatosFestivosAnio, Festivo, Localidad } from './tipos';
import { esFinDeSemana, type ISODate } from './fechas';

/** Si un mismo día aparece en varios ámbitos, gana el de más rango. */
const PRIORIDAD: Record<AmbitoFestivo, number> = {
  nacional: 0,
  convenio: 1,
  autonomico: 2,
  insular: 3,
  local: 4,
};

export const NOMBRE_AMBITO: Record<AmbitoFestivo, string> = {
  nacional: 'Nacional',
  convenio: 'Convenio',
  autonomico: 'Autonómico',
  insular: 'Insular',
  local: 'Local',
};

/**
 * Festivos de una localidad para el periodo del año (enero–diciembre más enero del año siguiente).
 * Une nacional + convenio + autonómico + insular + local. Los de enero del año siguiente se toman
 * del JSON de ese año si existe; si no, de `eneroSiguiente` del año actual (pendientes de verificar).
 */
export function festivosDe(
  localidad: Localidad,
  anio: number,
  datos: Record<number, DatosFestivosAnio>,
): Festivo[] {
  const actual = datos[anio];
  if (!actual) return [];

  const lista = festivosDelAnio(localidad, actual);

  const siguiente = datos[anio + 1];
  if (siguiente) {
    lista.push(...festivosDelAnio(localidad, siguiente).filter((f) => f.fecha.slice(5, 7) === '01'));
  } else if (actual.eneroSiguiente) {
    const verificar = actual.eneroSiguiente.verificar ?? true;
    for (const d of actual.eneroSiguiente.dias) {
      lista.push({ fecha: d.fecha, nombre: d.nombre, ambito: d.ambito ?? 'nacional', verificar });
    }
  }

  return deduplicar(lista);
}

function festivosDelAnio(localidad: Localidad, datos: DatosFestivosAnio): Festivo[] {
  const out: Festivo[] = [];
  for (const d of datos.nacional) out.push({ ...d, ambito: 'nacional', verificar: false });
  for (const d of datos.convenio) out.push({ ...d, ambito: 'convenio', verificar: false });

  const auto = datos.autonomico[localidad.ccaa];
  if (auto) {
    const verificar = auto.verificar ?? false;
    for (const d of auto.dias) out.push({ ...d, ambito: 'autonomico', verificar });
    if (localidad.isla && auto.insular?.[localidad.isla]) {
      for (const d of auto.insular[localidad.isla]) out.push({ ...d, ambito: 'insular', verificar });
    }
  }

  const local = datos.local[localidad.id];
  if (local) {
    const verificar = local.verificar ?? false;
    for (const d of local.dias) out.push({ ...d, ambito: 'local', verificar });
  }
  return out;
}

function deduplicar(lista: Festivo[]): Festivo[] {
  const porFecha = new Map<ISODate, Festivo>();
  for (const f of lista) {
    const prev = porFecha.get(f.fecha);
    if (!prev || PRIORIDAD[f.ambito] < PRIORIDAD[prev.ambito]) porFecha.set(f.fecha, f);
  }
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export type MapaFestivos = Map<ISODate, Festivo>;

export function mapaFestivos(festivos: Festivo[]): MapaFestivos {
  return new Map(festivos.map((f) => [f.fecha, f]));
}

/** Laborable = lunes a viernes y no festivo. */
export function esLaborable(iso: ISODate, festivos: MapaFestivos): boolean {
  return !esFinDeSemana(iso) && !festivos.has(iso);
}
