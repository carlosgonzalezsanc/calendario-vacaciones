// Fechas siempre como cadenas locales 'YYYY-MM-DD'. Nunca se usa Date en UTC:
// toda conversión pasa por date-fns con fechas locales para evitar desfases de un día.
import { addDays, differenceInCalendarDays, format, getDay, parse } from 'date-fns';
import { es } from 'date-fns/locale';

export type ISODate = string;

const FMT = 'yyyy-MM-dd';
const REF = new Date(2000, 0, 1);

export function aDate(iso: ISODate): Date {
  return parse(iso, FMT, REF);
}

export function aISO(d: Date): ISODate {
  return format(d, FMT);
}

export function esISOValida(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = aDate(s);
  return !Number.isNaN(d.getTime()) && aISO(d) === s;
}

export function sumarDias(iso: ISODate, n: number): ISODate {
  return aISO(addDays(aDate(iso), n));
}

/** Días naturales de a a b (b − a). */
export function diferenciaDias(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(aDate(b), aDate(a));
}

/** 0 = domingo … 6 = sábado (como Date#getDay). */
export function diaSemana(iso: ISODate): number {
  return getDay(aDate(iso));
}

export const esDomingo = (iso: ISODate) => diaSemana(iso) === 0;
export const esSabado = (iso: ISODate) => diaSemana(iso) === 6;
export const esFinDeSemana = (iso: ISODate) => esDomingo(iso) || esSabado(iso);

/** Lista de fechas de inicio a fin, ambos incluidos. Acepta el rango en cualquier orden. */
export function rango(inicio: ISODate, fin: ISODate): ISODate[] {
  const [a, b] = inicio <= fin ? [inicio, fin] : [fin, inicio];
  const out: ISODate[] = [];
  for (let d = a; d <= b; d = sumarDias(d, 1)) out.push(d);
  return out;
}

export function enRango(iso: ISODate, inicio: ISODate, fin: ISODate): boolean {
  return iso >= inicio && iso <= fin;
}

export function formatoCorto(iso: ISODate): string {
  return format(aDate(iso), 'dd/MM/yyyy');
}

export function formatoLargo(iso: ISODate): string {
  return format(aDate(iso), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}

export function nombreMes(anio: number, mes: number): string {
  const s = format(new Date(anio, mes, 1), 'LLLL yyyy', { locale: es });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Primer y último día del periodo de imputación: 1/1/año – 31/1/año+1 (FINI/FFIN del Excel). */
export function periodoAnio(anio: number): { inicio: ISODate; fin: ISODate } {
  return { inicio: `${anio}-01-01`, fin: `${anio + 1}-01-31` };
}
