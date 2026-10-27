import type { PlanAnio, TipoMarca } from './tipos';
import { calcularBloques } from './bloques';
import { anioNatural, formatoCorto, periodoAnio, type ISODate } from './fechas';
import { NOMBRE_MARCA } from './validar';

/** Tipos que solo se pueden disfrutar dentro del año natural. El resto llega hasta el 31/1 del año siguiente. */
export const SOLO_ANIO_NATURAL: TipoMarca[] = ['vacaciones', 'puente', 'asuntosPropios', 'sanIsidro'];

export function plazoDe(tipo: TipoMarca, anio: number): { inicio: ISODate; fin: ISODate } {
  return SOLO_ANIO_NATURAL.includes(tipo) ? anioNatural(anio) : periodoAnio(anio);
}

export interface FueraDePlazo {
  mensaje: string;
  fechas: ISODate[];
}

/** Marcas del plan que caen fuera de su plazo (un bloque no puede quedar a caballo entre dos años). */
export function fueraDePlazo(plan: PlanAnio, anio: number): FueraDePlazo[] {
  const out: FueraDePlazo[] = [];
  const f = formatoCorto;
  const fuera = (tipo: TipoMarca, d: ISODate) => {
    const p = plazoDe(tipo, anio);
    return d < p.inicio || d > p.fin;
  };
  const motivo = (tipo: TipoMarca) => {
    const p = plazoDe(tipo, anio);
    return SOLO_ANIO_NATURAL.includes(tipo)
      ? `tiene que disfrutarse dentro de ${anio} (solo el remanente de vacaciones llega hasta el ${f(periodoAnio(anio).fin)})`
      : `tiene que estar entre el ${f(p.inicio)} y el ${f(p.fin)}`;
  };

  for (const b of calcularBloques(plan)) {
    if (b.inicio && b.fin && (fuera('vacaciones', b.inicio) || fuera('vacaciones', b.fin))) {
      out.push({
        mensaje: `El bloque ${b.indice + 1} (${f(b.inicio)} – ${f(b.fin)}) ${motivo('vacaciones')}.`,
        fechas: [b.inicio],
      });
    }
  }
  const sueltos: [TipoMarca, ISODate[]][] = [
    ['puente', plan.puentes.filter((x): x is ISODate => !!x)],
    ['asuntosPropios', plan.asuntosPropios],
    ['sanIsidro', plan.sanIsidro ? [plan.sanIsidro] : []],
    ['remanente', plan.remanente],
    ['noImputable', plan.noImputables],
    ['baja', plan.bajas],
  ];
  for (const [tipo, dias] of sueltos) {
    for (const d of dias) {
      if (fuera(tipo, d)) out.push({ mensaje: `${NOMBRE_MARCA[tipo]} el ${f(d)}: ${motivo(tipo)}.`, fechas: [d] });
    }
  }
  for (const p of plan.permisos) {
    if (fuera('permiso', p.inicio) || fuera('permiso', p.fin)) {
      out.push({
        mensaje: `${NOMBRE_MARCA.permiso} (${f(p.inicio)} – ${f(p.fin)}): ${motivo('permiso')}.`,
        fechas: [p.inicio],
      });
    }
  }
  return out;
}
