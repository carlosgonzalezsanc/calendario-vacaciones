import type { ModalidadId, PeriodoPermiso, PlanAnio, TipoPermiso } from '../domain/tipos';
import { IDS_MODALIDAD, MODALIDADES } from '../domain/bloques';
import { CUPO_ASUNTOS_PROPIOS } from '../domain/calculos';
import { esISOValida } from '../domain/fechas';
import { crearPlanVacio, nuevoId } from '../domain/pincel';

export const SCHEMA_VERSION = 2;
export const CLAVE_STORAGE = 'calendario-vacaciones:v1';

export interface Preferencias {
  escolar: boolean;
  verano: boolean;
}

export interface DatosUsuario {
  schemaVersion: typeof SCHEMA_VERSION;
  localidadId: string;
  anio: number;
  planes: Record<string, PlanAnio>;
  preferencias: Preferencias;
  actualizado?: string;
}

/**
 * Persistencia aislada tras esta interfaz. La v1 guarda en el navegador; si se aprueba un backend
 * con SSO, basta con otra implementación de load/save sin tocar la UI.
 */
export interface StorageRepository {
  load(): DatosUsuario | null;
  save(datos: DatosUsuario): void;
  clear(): void;
}

export class LocalStorageRepository implements StorageRepository {
  constructor(
    private readonly storage: Storage = window.localStorage,
    private readonly clave = CLAVE_STORAGE,
  ) {}

  load(): DatosUsuario | null {
    try {
      const raw = this.storage.getItem(this.clave);
      return raw ? normalizarDatos(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  save(datos: DatosUsuario): void {
    try {
      this.storage.setItem(this.clave, JSON.stringify({ ...datos, actualizado: new Date().toISOString() }));
    } catch {
      // Navegación privada o almacenamiento lleno: la web sigue funcionando sin guardar.
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(this.clave);
    } catch {
      /* nada */
    }
  }
}

export function datosIniciales(localidadId: string, anio: number): DatosUsuario {
  return {
    schemaVersion: SCHEMA_VERSION,
    localidadId,
    anio,
    planes: {},
    preferencias: { escolar: false, verano: false },
  };
}

/**
 * Valida y limpia datos leídos del almacenamiento o de un JSON importado. Descarta cualquier
 * campo desconocido (por ejemplo, un motivo de baja) y las fechas mal formadas.
 * Lanza un Error si el fichero no tiene el formato esperado.
 */
export function normalizarDatos(raw: unknown): DatosUsuario {
  if (!esObjeto(raw)) throw new Error('El fichero no contiene un objeto JSON.');
  const version = raw.schemaVersion;
  if (version !== 1 && version !== SCHEMA_VERSION) {
    throw new Error(`Versión de datos no soportada: ${String(version)}.`);
  }
  const planes: Record<string, PlanAnio> = {};
  if (esObjeto(raw.planes)) {
    for (const [anio, p] of Object.entries(raw.planes)) {
      if (/^\d{4}$/.test(anio) && esObjeto(p)) planes[anio] = normalizarPlan(version === 1 ? migrarPlanV1(p) : p);
    }
  }
  const pref = esObjeto(raw.preferencias) ? raw.preferencias : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    localidadId: typeof raw.localidadId === 'string' ? raw.localidadId : 'madrid',
    anio: typeof raw.anio === 'number' ? raw.anio : new Date().getFullYear(),
    planes,
    preferencias: { escolar: pref.escolar === true, verano: pref.verano === true },
    actualizado: typeof raw.actualizado === 'string' ? raw.actualizado : undefined,
  };
}

function normalizarPlan(p: Record<string, unknown>): PlanAnio {
  const modalidad: ModalidadId = IDS_MODALIDAD.includes(p.modalidad as ModalidadId)
    ? (p.modalidad as ModalidadId)
    : '10+10+5+5';
  const n = MODALIDADES[modalidad].length;
  const base = crearPlanVacio(modalidad);
  const fechaONull = (x: unknown) => (esISOValida(x) ? x : null);
  const fechas = (xs: unknown) => (Array.isArray(xs) ? [...new Set(xs.filter(esISOValida))].sort() : []);
  const porIndice = (xs: unknown) =>
    Array.from({ length: n }, (_, i) => (Array.isArray(xs) ? fechaONull(xs[i]) : null));

  const permisos: PeriodoPermiso[] = Array.isArray(p.permisos)
    ? p.permisos
        .filter(esObjeto)
        .filter((x) => esISOValida(x.inicio) && esISOValida(x.fin) && x.inicio <= x.fin)
        .map((x) => ({
          id: typeof x.id === 'string' ? x.id : nuevoId(),
          inicio: x.inicio as string,
          fin: x.fin as string,
          tipo: (['matrimonio', 'nacimiento', 'otro'].includes(x.tipo as string) ? x.tipo : 'otro') as TipoPermiso,
        }))
    : [];

  return {
    ...base,
    bloques: porIndice(p.bloques),
    puentes: porIndice(p.puentes),
    remanente: fechas(p.remanente),
    asuntosPropios: fechas(p.asuntosPropios),
    noImputables: fechas(p.noImputables),
    // Solo fechas: si el JSON trae objetos con motivo, se ignoran.
    bajas: fechas(p.bajas),
    permisos,
    sanIsidro: fechaONull(p.sanIsidro),
  };
}

/**
 * v1 → v2: los «días sueltos» se separan en asuntos propios (los 6 primeros) y remanente de
 * vacaciones (el resto). La «semana reducida» desaparece: ahora es un único Día de San Isidro.
 */
function migrarPlanV1(p: Record<string, unknown>): Record<string, unknown> {
  const sueltos = Array.isArray(p.sueltos) ? [...p.sueltos].filter(esISOValida).sort() : [];
  const { sueltos: _s, semanaReducida: _r, ...resto } = p;
  return {
    ...resto,
    asuntosPropios: sueltos.slice(0, CUPO_ASUNTOS_PROPIOS),
    remanente: sueltos.slice(CUPO_ASUNTOS_PROPIOS),
  };
}

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
