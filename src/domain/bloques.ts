import type { Bloque, ModalidadId, PlanAnio } from './tipos';
import { diferenciaDias, sumarDias, type ISODate } from './fechas';

/** Modalidades de bloques en días naturales (hoja Listas, Todo_bloques). */
export const MODALIDADES: Record<ModalidadId, number[]> = {
  '30': [30],
  '15+15': [15, 15],
  '20+10': [20, 10],
  '20+5+5': [20, 5, 5],
  '10+10+10': [10, 10, 10],
  '10+10+5+5': [10, 10, 5, 5],
};

export const IDS_MODALIDAD = Object.keys(MODALIDADES) as ModalidadId[];

export const TOTAL_VACACIONES = 30;

export function nombreModalidad(m: ModalidadId): string {
  return MODALIDADES[m].join(' + ') + ' días';
}

/** Fin = inicio + días − 1. */
export function calcularBloques(plan: PlanAnio): Bloque[] {
  return MODALIDADES[plan.modalidad].map((dias, indice) => {
    const inicio = plan.bloques[indice] ?? null;
    return { indice, dias, inicio, fin: inicio ? sumarDias(inicio, dias - 1) : null };
  });
}

/** Ajusta el array de bloques al número de bloques de la modalidad. */
export function cambiarModalidad(plan: PlanAnio, modalidad: ModalidadId): PlanAnio {
  const n = MODALIDADES[modalidad].length;
  return { ...plan, modalidad, bloques: Array.from({ length: n }, (_, i) => plan.bloques[i] ?? null) };
}

/**
 * Al pintar una selección con el pincel de vacaciones, elige el bloque libre que mejor encaja:
 * primero uno con los mismos días; si no, el de tamaño más parecido. El bloque empieza en la
 * primera fecha seleccionada. Devuelve null si no queda ningún bloque libre.
 */
export function encajarSeleccion(
  plan: PlanAnio,
  desde: ISODate,
  hasta: ISODate,
): { indice: number; inicio: ISODate; diasSeleccionados: number; dias: number } | null {
  const [inicio, fin] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  const n = diferenciaDias(inicio, fin) + 1;
  const libres = calcularBloques(plan).filter((b) => !b.inicio);
  if (libres.length === 0) return null;
  const mejor = libres.reduce((acc, b) => (Math.abs(b.dias - n) < Math.abs(acc.dias - n) ? b : acc));
  return { indice: mejor.indice, inicio, diasSeleccionados: n, dias: mejor.dias };
}

/** Bloque que contiene la fecha (por rango inicio–fin), o undefined. */
export function bloqueQueContiene(bloques: Bloque[], iso: ISODate): Bloque | undefined {
  return bloques.find((b) => b.inicio && b.fin && iso >= b.inicio && iso <= b.fin);
}

export function diasBloque(b: Bloque): ISODate[] {
  if (!b.inicio) return [];
  return Array.from({ length: b.dias }, (_, i) => sumarDias(b.inicio!, i));
}
