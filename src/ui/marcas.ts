import type { Pincel } from '../domain/pincel';
import type { TipoMarca } from '../domain/tipos';
import { NOMBRE_MARCA } from '../domain/validar';

export interface MetaMarca {
  inicial: string;
  nombre: string;
  ayuda: string;
}

export const META_MARCA: Record<TipoMarca, MetaMarca> = {
  vacaciones: {
    inicial: 'V',
    nombre: NOMBRE_MARCA.vacaciones,
    ayuda: 'Clic para empezar un bloque en ese día, o arrastra: se encaja en el bloque libre más parecido. Pulsar un día del bloque lo cancela.',
  },
  remanente: {
    inicial: 'R',
    nombre: NOMBRE_MARCA.remanente,
    ayuda: 'Días generados por los domingos y festivos que caen dentro de tus bloques. Arrastrando solo se marcan días laborables.',
  },
  asuntosPropios: {
    inicial: 'A',
    nombre: NOMBRE_MARCA.asuntosPropios,
    ayuda: '6 días al año (art. 102 h). Dos de ellos pueden fraccionarse en dos periodos cada uno.',
  },
  noImputable: {
    inicial: 'N',
    nombre: NOMBRE_MARCA.noImputable,
    ayuda: 'Días sin sueldo o de otro año.',
  },
  baja: {
    inicial: 'B',
    nombre: NOMBRE_MARCA.baja,
    ayuda: 'Solo se guardan las fechas, nunca el motivo.',
  },
  permiso: {
    inicial: 'C',
    nombre: NOMBRE_MARCA.permiso,
    ayuda: 'Arrastra el periodo. Con «matrimonio», un clic marca 15 días naturales.',
  },
  sanIsidro: {
    inicial: 'I',
    nombre: NOMBRE_MARCA.sanIsidro,
    ayuda: 'Un solo día al año: la jornada completa por fiestas locales (art. 87).',
  },
};

export const PINCELES: Pincel[] = [
  'vacaciones',
  'remanente',
  'asuntosPropios',
  'noImputable',
  'baja',
  'permiso',
  'sanIsidro',
  'borrar',
];

export function nombrePincel(p: Pincel): string {
  return p === 'borrar' ? 'Borrar' : META_MARCA[p].nombre;
}
