import type { ISODate } from './fechas';

// ---------- Datos de festivos (data/festivos/AAAA.json) ----------

export interface DiaFestivoDato {
  fecha: ISODate;
  nombre: string;
}

export interface DatosFestivosAnio {
  anio: number;
  nacional: DiaFestivoDato[];
  convenio: DiaFestivoDato[];
  eneroSiguiente?: {
    verificar?: boolean;
    nota?: string;
    dias: (DiaFestivoDato & { ambito?: AmbitoFestivo })[];
  };
  autonomico: Record<
    string,
    {
      fuente?: string;
      verificar?: boolean;
      dias: DiaFestivoDato[];
      insular?: Record<string, DiaFestivoDato[]>;
    }
  >;
  local: Record<
    string,
    {
      ccaa: string;
      isla?: string;
      verificar?: boolean;
      fuente?: string;
      /** Semana de fiestas locales (art. 87). Sin ella no se comprueba el derecho al Día de San Isidro. */
      semanaFiestaLocal?: SemanaFiestaLocal;
      dias: DiaFestivoDato[];
    }
  >;
}

export interface SemanaFiestaLocal {
  inicio: ISODate;
  fin: ISODate;
  nombre?: string;
}

export interface Localidad {
  id: string;
  nombre: string;
  ccaa: string;
  ccaaNombre: string;
  isla?: string;
}

export type AmbitoFestivo = 'nacional' | 'convenio' | 'autonomico' | 'insular' | 'local';

export interface Festivo {
  fecha: ISODate;
  nombre: string;
  ambito: AmbitoFestivo;
  verificar: boolean;
}

export interface PeriodoEscolar {
  inicio: ISODate;
  fin: ISODate;
  nombre: string;
}

export interface CalendarioEscolar {
  ccaa: string;
  curso: string;
  verificar?: boolean;
  fuente?: string;
  noLectivos: PeriodoEscolar[];
  mediaJornada: PeriodoEscolar[];
}

// ---------- Plan del usuario ----------

export type ModalidadId = '30' | '15+15' | '20+10' | '20+5+5' | '10+10+10' | '10+10+5+5';

export type TipoPermiso = 'matrimonio' | 'nacimiento' | 'otro';

export interface PeriodoPermiso {
  id: string;
  inicio: ISODate;
  fin: ISODate;
  tipo: TipoPermiso;
}

/** Lo que marca el usuario para un año. Las bajas guardan solo fechas, nunca el motivo (RGPD). */
export interface PlanAnio {
  modalidad: ModalidadId;
  /** Inicio de cada bloque de la modalidad (null = sin asignar). */
  bloques: (ISODate | null)[];
  /** Puente «a costa» de cada bloque (mismo índice que bloques): resta un día al bloque. */
  puentes: (ISODate | null)[];
  /** Días generados por domingos y festivos dentro de los bloques. */
  remanente: ISODate[];
  /** Los 6 días de asuntos propios del art. 102 h). */
  asuntosPropios: ISODate[];
  noImputables: ISODate[];
  bajas: ISODate[];
  permisos: PeriodoPermiso[];
  /** Jornada completa por fiestas locales (art. 87): un solo día al año. */
  sanIsidro: ISODate | null;
}

export type TipoMarca =
  | 'vacaciones'
  | 'remanente'
  | 'asuntosPropios'
  | 'puente'
  | 'noImputable'
  | 'baja'
  | 'permiso'
  | 'sanIsidro';

export interface Bloque {
  indice: number;
  /** Días de la modalidad (sin descontar el puente). */
  diasNominales: number;
  /** Días reales del bloque = nominales − 1 si tiene puente. */
  dias: number;
  inicio: ISODate | null;
  fin: ISODate | null;
  puente: ISODate | null;
}

export type NivelIncidencia = 'error' | 'aviso';

export interface Incidencia {
  codigo: string;
  nivel: NivelIncidencia;
  mensaje: string;
  /** Días a los que afecta (para pintarlos en rojo en el calendario). */
  fechas: ISODate[];
  /** Regla pendiente de contrastar con el convenio. */
  pendienteVerificar?: boolean;
}
