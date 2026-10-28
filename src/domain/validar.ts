import type { Incidencia, PlanAnio, SemanaFiestaLocal, TipoMarca } from './tipos';
import { calcularBloques, diasBloque, TOTAL_VACACIONES } from './bloques';
import { candidatosPuente, CUPO_ASUNTOS_PROPIOS, diasGenerados, marcasPorDia } from './calculos';
import { diferenciaDias, esDomingo, esSabado, formatoCorto, type ISODate } from './fechas';
import { esLaborable, type MapaFestivos } from './festivos';
import { fueraDePlazo } from './plazos';
import { estadoSanIsidro, textoPerdidaSanIsidro } from './sanIsidro';

export const NOMBRE_MARCA: Record<TipoMarca, string> = {
  vacaciones: 'Vacaciones',
  remanente: 'Remanente de vacaciones',
  asuntosPropios: 'Asuntos propios',
  puente: 'Puente',
  noImputable: 'No imputable al año',
  baja: 'Baja',
  permiso: 'Permiso por convenio',
  sanIsidro: 'Día de San Isidro',
};

/** Separación mínima entre los dos bloques de 5 días (comentario de AN5 del Excel). */
export const SEPARACION_MIN_BLOQUES_5 = 7;
export const DIAS_PERMISO_MATRIMONIO = 15;

export interface ContextoValidacion {
  anio: number;
  festivos: MapaFestivos;
  /** Semana de fiestas locales de la localidad, si se conoce (regla del Día de San Isidro). */
  semanaFiestaLocal?: SemanaFiestaLocal | null;
}

/** Valida el plan. Las incidencias no bloquean el guardado. */
export function validar(plan: PlanAnio, ctx: ContextoValidacion): Incidencia[] {
  const out: Incidencia[] = [];
  const { festivos, anio } = ctx;
  const bloques = calcularBloques(plan);
  const f = formatoCorto;

  // --- Plazos: vacaciones, puentes, asuntos propios y San Isidro dentro del año; el resto hasta el 31/1 ---
  for (const x of fueraDePlazo(plan, anio)) out.push(err('FUERA_DE_PLAZO', x.mensaje, x.fechas));

  // --- Bloques ---
  for (const b of bloques) {
    if (!b.inicio || !b.fin) continue;
    const nombre = `Bloque ${b.indice + 1} (${b.dias} días)`;
    if (esDomingo(b.inicio)) {
      out.push(err('BLOQUE_INICIO_DOMINGO', `${nombre}: no puede empezar en domingo (${f(b.inicio)}).`, [b.inicio]));
    }
    const fest = festivos.get(b.inicio);
    if (fest) {
      out.push(
        err('BLOQUE_INICIO_FESTIVO', `${nombre}: no puede empezar en festivo (${f(b.inicio)}, ${fest.nombre}).`, [b.inicio]),
      );
    }
  }

  const asignados = bloques.filter((b) => b.inicio);
  for (let i = 0; i < asignados.length; i++) {
    for (let j = i + 1; j < asignados.length; j++) {
      const a = asignados[i];
      const b = asignados[j];
      if (a.inicio! <= b.fin! && b.inicio! <= a.fin!) {
        out.push(
          err('BLOQUES_SOLAPADOS', `Los bloques ${a.indice + 1} y ${b.indice + 1} se solapan.`, [a.inicio!, b.inicio!]),
        );
      }
    }
  }

  const bloques5 = bloques.filter((b) => b.diasNominales === 5);
  const con5 = bloques5.filter((b) => b.inicio).sort((a, b) => a.inicio!.localeCompare(b.inicio!));
  if (con5.length === 2) {
    const [a, b] = con5;
    const entre = diferenciaDias(a.fin!, b.inicio!) - 1;
    if (entre < SEPARACION_MIN_BLOQUES_5) {
      out.push(
        err(
          'SEPARACION_BLOQUES_5',
          `Entre los dos bloques de 5 días tiene que haber al menos ${SEPARACION_MIN_BLOQUES_5} días (hay ${Math.max(entre, 0)}).`,
          [b.inicio!],
        ),
      );
    }
  }
  if (bloques5.length === 2) {
    // Changelog VN1.2: «el segundo periodo de 5 días tenga un sábado» (por orden de bloque).
    const segundo = bloques5[1];
    if (segundo.inicio && !diasBloque(segundo).some(esSabado)) {
      out.push({
        ...err(
          'BLOQUE_5_SIN_SABADO',
          `Bloque ${segundo.indice + 1}: el segundo bloque de 5 días tiene que incluir un sábado.`,
          [segundo.inicio],
        ),
        pendienteVerificar: true,
      });
    }
  }

  const sinAsignar = bloques.filter((b) => !b.inicio);
  if (sinAsignar.length > 0) {
    const dias = sinAsignar.reduce((s, b) => s + b.dias, 0);
    out.push(
      aviso(
        'BLOQUES_SIN_ASIGNAR',
        `Quedan ${sinAsignar.length} bloque(s) sin fecha (${dias} de ${TOTAL_VACACIONES} días).`,
        [],
      ),
    );
  }

  // --- Puentes ---
  const candidatos = candidatosPuente(anio, festivos);
  plan.puentes.forEach((p, i) => {
    if (!p) return;
    if (!esLaborable(p, festivos)) {
      out.push(aviso('PUENTE_NO_LABORABLE', `Puente ${f(p)} (bloque ${i + 1}): no es un día laborable.`, [p]));
    } else if (!candidatos.has(p)) {
      out.push(
        aviso('PUENTE_NO_CANDIDATO', `Puente ${f(p)} (bloque ${i + 1}): no está entre dos días no laborables.`, [p]),
      );
    }
  });

  // --- Remanente de vacaciones, asuntos propios y Día de San Isidro ---
  const generados = diasGenerados(bloques, festivos).total;
  const cupos: [ISODate[], number, string, string][] = [
    [plan.remanente, generados, 'CUPO_REMANENTE', NOMBRE_MARCA.remanente],
    [plan.asuntosPropios, CUPO_ASUNTOS_PROPIOS, 'CUPO_ASUNTOS_PROPIOS', NOMBRE_MARCA.asuntosPropios],
  ];
  for (const [dias, cupo, codigo, nombre] of cupos) {
    if (dias.length > cupo) {
      out.push(
        err(codigo, `${nombre}: has marcado ${dias.length} días y el cupo es ${cupo}.`, [...dias].sort().slice(cupo)),
      );
    }
  }
  const sueltos: [ISODate, string][] = [
    ...plan.remanente.map((d): [ISODate, string] => [d, NOMBRE_MARCA.remanente]),
    ...plan.asuntosPropios.map((d): [ISODate, string] => [d, NOMBRE_MARCA.asuntosPropios]),
    ...(plan.sanIsidro ? [[plan.sanIsidro, NOMBRE_MARCA.sanIsidro] as [ISODate, string]] : []),
  ];
  for (const [d, nombre] of sueltos) {
    if (!esLaborable(d, festivos)) {
      const fest = festivos.get(d);
      out.push(
        aviso(
          'DIA_NO_LABORABLE',
          `${nombre} ${f(d)}: ${fest ? `es festivo (${fest.nombre})` : 'cae en fin de semana'}.`,
          [d],
        ),
      );
    }
  }

  // --- Derecho al Día de San Isidro: trabajar al menos 4 días de la semana de fiestas locales ---
  const sanIsidro = estadoSanIsidro(plan, ctx.semanaFiestaLocal, festivos);
  if (sanIsidro?.pierdeDerecho) {
    out.push(aviso('SAN_ISIDRO_PERDIDO', textoPerdidaSanIsidro(sanIsidro), sanIsidro.diasAusencia));
  }

  // --- Permisos ---
  for (const p of plan.permisos) {
    const dias = diferenciaDias(p.inicio, p.fin) + 1;
    if (p.tipo === 'matrimonio' && dias !== DIAS_PERMISO_MATRIMONIO) {
      out.push(
        aviso(
          'PERMISO_MATRIMONIO_DIAS',
          `Permiso por matrimonio ${f(p.inicio)}: son ${DIAS_PERMISO_MATRIMONIO} días naturales seguidos (has marcado ${dias}).`,
          [p.inicio],
        ),
      );
    }
  }

  // --- Días con más de una marca (solo puede pasar con datos importados: la web no lo permite) ---
  const marcas = marcasPorDia(plan, bloques);
  for (const [d, xs] of marcas) {
    const distintas = [...new Set(xs)];
    if (distintas.length > 1) {
      out.push(
        err('MARCAS_SOLAPADAS', `${f(d)}: tiene varias marcas (${distintas.map((x) => NOMBRE_MARCA[x]).join(', ')}).`, [d]),
      );
    }
  }

  return out;
}

function err(codigo: string, mensaje: string, fechas: ISODate[]): Incidencia {
  return { codigo, nivel: 'error', mensaje, fechas };
}

function aviso(codigo: string, mensaje: string, fechas: ISODate[]): Incidencia {
  return { codigo, nivel: 'aviso', mensaje, fechas };
}
