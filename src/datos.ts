// Carga de datos estáticos. Añadir un año o una localidad = añadir/editar JSON en data/, sin tocar código.
import type { CalendarioEscolar, DatosFestivosAnio, Localidad } from './domain/tipos';
import localidadesJson from '../data/localidades.json';

const ficherosFestivos = import.meta.glob<DatosFestivosAnio>('../data/festivos/*.json', {
  eager: true,
  import: 'default',
});
const ficherosEscolar = import.meta.glob<CalendarioEscolar>('../data/escolar/*.json', {
  eager: true,
  import: 'default',
});

export const FESTIVOS: Record<number, DatosFestivosAnio> = Object.fromEntries(
  Object.values(ficherosFestivos).map((d) => [d.anio, d]),
);

export const ANIOS = Object.keys(FESTIVOS)
  .map(Number)
  .sort((a, b) => a - b);

export const LOCALIDADES: Localidad[] = localidadesJson as Localidad[];

/** Calendario escolar por comunidad autónoma (de momento solo MD). */
export const ESCOLAR: Record<string, CalendarioEscolar> = Object.fromEntries(
  Object.values(ficherosEscolar).map((d) => [d.ccaa, d]),
);

export function localidadPorId(id: string): Localidad {
  return LOCALIDADES.find((l) => l.id === id) ?? LOCALIDADES[0];
}
