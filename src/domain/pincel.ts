import type { Bloque, ModalidadId, PlanAnio, TipoMarca, TipoPermiso } from './tipos';
import { bloqueQueContiene, calcularBloques, encajarSeleccion, MODALIDADES } from './bloques';
import { diasSolapados, marcasPorDia } from './calculos';
import { formatoCorto, rango, sumarDias, type ISODate } from './fechas';
import { esLaborable, type MapaFestivos } from './festivos';
import { DIAS_PERMISO_MATRIMONIO, NOMBRE_MARCA } from './validar';

export type Pincel = TipoMarca | 'borrar';

export interface OpcionesPincel {
  tipoPermiso: TipoPermiso;
}

export interface ResultadoPincel {
  plan: PlanAnio;
  /** Información para la barra de estado. */
  mensaje?: string;
  /** El cambio no se aplica: hay que avisar con un popup. */
  rechazo?: string;
}

export function crearPlanVacio(modalidad: ModalidadId = '10+10+5+5'): PlanAnio {
  const n = MODALIDADES[modalidad].length;
  return {
    modalidad,
    bloques: Array(n).fill(null),
    remanente: [],
    asuntosPropios: [],
    noImputables: [],
    bajas: [],
    permisos: [],
    sanIsidro: null,
  };
}

let contador = 0;
export function nuevoId(): string {
  contador += 1;
  return `${Date.now().toString(36)}-${contador}`;
}

type ClaveDias = 'remanente' | 'asuntosPropios' | 'noImputables' | 'bajas';
const CLAVE_DIAS: Partial<Record<TipoMarca, ClaveDias>> = {
  remanente: 'remanente',
  asuntosPropios: 'asuntosPropios',
  noImputable: 'noImputables',
  baja: 'bajas',
};

/** Texto de lo que ocupa un día, para los avisos: «Vacaciones (bloque 1: 05/01/2027 – 14/01/2027)». */
export function describirDia(plan: PlanAnio, bloques: Bloque[], fecha: ISODate, tipo: TipoMarca): string {
  const f = formatoCorto;
  if (tipo === 'vacaciones') {
    const b = bloqueQueContiene(bloques, fecha);
    if (b) return `${NOMBRE_MARCA.vacaciones} (bloque ${b.indice + 1}: ${f(b.inicio!)} – ${f(b.fin!)})`;
  }
  if (tipo === 'permiso') {
    const p = plan.permisos.find((x) => fecha >= x.inicio && fecha <= x.fin);
    if (p) return `${NOMBRE_MARCA.permiso} (${f(p.inicio)} – ${f(p.fin)})`;
  }
  return NOMBRE_MARCA[tipo];
}

/**
 * Aplica el pincel a un día (desde === hasta) o a un rango arrastrado.
 * - Pulsar un día ya cogido con el mismo tipo lo cancela (si es un bloque, el bloque entero).
 * - Marcar un día ya cogido con otro tipo se rechaza: cada día admite una sola marca.
 */
export function aplicarPincel(
  plan: PlanAnio,
  pincel: Pincel,
  desde: ISODate,
  hasta: ISODate,
  festivos: MapaFestivos,
  opciones: OpcionesPincel,
): ResultadoPincel {
  const [a, b] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  const unDia = a === b;
  const f = formatoCorto;
  const bloques = calcularBloques(plan);
  const marcas = marcasPorDia(plan, bloques);

  if (pincel === 'borrar') return { plan: borrarRango(plan, a, b) };

  // Un clic sobre un día ya cogido con el mismo tipo lo cancela.
  if (unDia && marcas.get(a)?.includes(pincel)) return cancelar(plan, bloques, pincel, a);

  /** Primer día del rango ocupado por otra marca → rechazo con explicación. */
  const ocupado = (dias: ISODate[], permitir?: TipoMarca): ResultadoPincel | null => {
    for (const d of dias) {
      const otra = marcas.get(d)?.find((t) => t !== permitir);
      if (otra) {
        return {
          plan,
          rechazo: `No puedes marcar el ${f(d)} como ${NOMBRE_MARCA[pincel]}: ese día ya es ${describirDia(plan, bloques, d, otra)}. Para cambiarlo, púlsalo primero con su mismo tipo para cancelarlo o usa «Borrar».`,
        };
      }
    }
    return null;
  };

  switch (pincel) {
    case 'vacaciones': {
      const encaje = encajarSeleccion(plan, a, b);
      if (!encaje) {
        return { plan, rechazo: 'No quedan bloques libres. Cancela uno (pulsando sobre él) o cambia de modalidad.' };
      }
      const fin = sumarDias(encaje.inicio, encaje.dias - 1);
      const choque = rango(encaje.inicio, fin).find((d) => marcas.has(d));
      if (choque) {
        const otra = describirDia(plan, bloques, choque, marcas.get(choque)![0]);
        return {
          plan,
          rechazo: `El bloque ${encaje.indice + 1} (${f(encaje.inicio)} – ${f(fin)}) no se puede guardar: se solapa el ${f(choque)} con ${otra}. Cancela ese periodo antes (pulsándolo con su mismo tipo) o elige otras fechas.`,
        };
      }
      const ajuste =
        encaje.diasSeleccionados !== encaje.dias && !unDia
          ? ` Seleccionaste ${encaje.diasSeleccionados} días; se ha ajustado al bloque.`
          : '';
      return {
        plan: { ...plan, bloques: plan.bloques.map((x, i) => (i === encaje.indice ? encaje.inicio : x)) },
        mensaje: `Bloque ${encaje.indice + 1} (${encaje.dias} días): ${f(encaje.inicio)} – ${f(fin)}.${ajuste}`,
      };
    }

    case 'remanente':
    case 'asuntosPropios':
    case 'noImputable':
    case 'baja': {
      const clave = CLAVE_DIAS[pincel]!;
      let dias = rango(a, b);
      // Al arrastrar remanente o asuntos propios solo se marcan días laborables.
      if ((pincel === 'remanente' || pincel === 'asuntosPropios') && !unDia) {
        dias = dias.filter((d) => esLaborable(d, festivos));
      }
      if (dias.length === 0) return { plan };
      const conflicto = ocupado(dias, pincel);
      if (conflicto) return conflicto;
      const actual = new Set(plan[clave]);
      const todosMarcados = dias.every((d) => actual.has(d));
      for (const d of dias) {
        if (todosMarcados) actual.delete(d);
        else actual.add(d);
      }
      return { plan: { ...plan, [clave]: [...actual].sort() } };
    }

    case 'permiso': {
      const fin = unDia && opciones.tipoPermiso === 'matrimonio' ? sumarDias(a, DIAS_PERMISO_MATRIMONIO - 1) : b;
      const conflicto = ocupado(rango(a, fin));
      if (conflicto) return conflicto;
      return {
        plan: {
          ...plan,
          permisos: [...plan.permisos, { id: nuevoId(), inicio: a, fin, tipo: opciones.tipoPermiso }].sort((x, y) =>
            x.inicio.localeCompare(y.inicio),
          ),
        },
      };
    }

    case 'sanIsidro': {
      if (!unDia) return { plan, rechazo: `El ${NOMBRE_MARCA.sanIsidro} es un solo día: pulsa el día en lugar de arrastrar.` };
      if (plan.sanIsidro) {
        return {
          plan,
          rechazo: `Solo puedes coger un ${NOMBRE_MARCA.sanIsidro} al año y ya lo tienes el ${f(plan.sanIsidro)}. Púlsalo para cancelarlo y elige otro.`,
        };
      }
      const conflicto = ocupado([a]);
      if (conflicto) return conflicto;
      return { plan: { ...plan, sanIsidro: a }, mensaje: `${NOMBRE_MARCA.sanIsidro}: ${f(a)}.` };
    }
  }
}

function cancelar(plan: PlanAnio, bloques: Bloque[], tipo: TipoMarca, d: ISODate): ResultadoPincel {
  switch (tipo) {
    case 'vacaciones': {
      const bl = bloqueQueContiene(bloques, d)!;
      return {
        plan: { ...plan, bloques: plan.bloques.map((x, i) => (i === bl.indice ? null : x)) },
        mensaje: `Bloque ${bl.indice + 1} cancelado.`,
      };
    }
    case 'permiso':
      return {
        plan: { ...plan, permisos: plan.permisos.filter((p) => !(d >= p.inicio && d <= p.fin)) },
        mensaje: 'Permiso cancelado.',
      };
    case 'sanIsidro':
      return { plan: { ...plan, sanIsidro: null }, mensaje: `${NOMBRE_MARCA.sanIsidro} cancelado.` };
    default: {
      const clave = CLAVE_DIAS[tipo]!;
      return { plan: { ...plan, [clave]: plan[clave].filter((x) => x !== d) } };
    }
  }
}

/**
 * Comprueba un cambio hecho desde los formularios: si crea días con dos marcas (por ejemplo, dos
 * bloques que se pisan o un asunto propio dentro de un bloque), devuelve el motivo del rechazo.
 */
export function comprobarCambio(antes: PlanAnio, despues: PlanAnio): string | null {
  const previos = diasSolapados(antes, calcularBloques(antes));
  const bloques = calcularBloques(despues);
  for (const [d, xs] of diasSolapados(despues, bloques)) {
    if (previos.has(d)) continue;
    const textos = [...new Set(xs.map((t) => describirDia(despues, bloques, d, t)))];
    const dosBloques = xs.filter((t) => t === 'vacaciones').length > 1;
    return dosBloques
      ? `No se puede guardar: dos bloques de vacaciones se solapan el ${formatoCorto(d)}.`
      : `No se puede guardar: el ${formatoCorto(d)} quedaría marcado a la vez como ${textos.join(' y ')}.`;
  }
  return null;
}

function borrarRango(plan: PlanAnio, a: ISODate, b: ISODate): PlanAnio {
  const dentro = (d: ISODate | null) => d !== null && d >= a && d <= b;
  const solapa = (ini: ISODate, fin: ISODate) => ini <= b && a <= fin;
  const bloques = calcularBloques(plan);
  return {
    ...plan,
    bloques: plan.bloques.map((x, i) => {
      const bl = bloques[i];
      return bl.inicio && bl.fin && solapa(bl.inicio, bl.fin) ? null : x;
    }),
    remanente: plan.remanente.filter((d) => !dentro(d)),
    asuntosPropios: plan.asuntosPropios.filter((d) => !dentro(d)),
    noImputables: plan.noImputables.filter((d) => !dentro(d)),
    bajas: plan.bajas.filter((d) => !dentro(d)),
    permisos: plan.permisos.filter((p) => !solapa(p.inicio, p.fin)),
    sanIsidro: dentro(plan.sanIsidro) ? null : plan.sanIsidro,
  };
}
