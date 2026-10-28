import { describe, expect, it } from 'vitest';
import { FESTIVOS, LOCALIDADES, localidadPorId } from '../datos';
import { calcularBloques, encajarSeleccion } from './bloques';
import { candidatosPuente, diasGenerados } from './calculos';
import { festivosDe, mapaFestivos, semanaFiestaLocal } from './festivos';
import { aplicarPincel, comprobarCambio, crearPlanVacio } from './pincel';
import { estadoSanIsidro } from './sanIsidro';
import type { PlanAnio } from './tipos';
import { validar } from './validar';
import { normalizarDatos } from '../storage/StorageRepository';

const ANIO = 2027;
const festivosMap = (id: string) => mapaFestivos(festivosDe(localidadPorId(id), ANIO, FESTIVOS));
const madrid = festivosMap('madrid');
const codigos = (plan: PlanAnio, f = madrid) => validar(plan, { anio: ANIO, festivos: f }).map((i) => i.codigo);
const opciones = { tipoPermiso: 'otro' as const };
const ctx = { anio: ANIO, festivos: madrid };

describe('festivosDe', () => {
  const esperados: Record<string, number> = {
    madrid: 18,
    toledo: 18,
    almeria: 18,
    burgos: 18,
    vigo: 18,
    'las-palmas-gc': 19,
  };

  it.each(LOCALIDADES.map((l) => l.id))('%s: número total de festivos y sin duplicados', (id) => {
    const lista = festivosDe(localidadPorId(id), ANIO, FESTIVOS);
    expect(lista).toHaveLength(esperados[id]);
    expect(new Set(lista.map((f) => f.fecha)).size).toBe(lista.length);
  });

  it('cada localidad de los datos de festivos coincide con su comunidad', () => {
    for (const l of LOCALIDADES) {
      expect(FESTIVOS[ANIO].local[l.id]?.ccaa).toBe(l.ccaa);
      expect(FESTIVOS[ANIO].autonomico[l.ccaa]).toBeDefined();
    }
  });

  it('el 16 de agosto en Vigo es local y no autonómico', () => {
    expect(festivosMap('vigo').get('2027-08-16')?.ambito).toBe('local');
    expect(madrid.get('2027-08-16')?.ambito).toBe('autonomico');
  });

  it('Nochebuena y Nochevieja son de convenio en todas las localidades', () => {
    for (const l of LOCALIDADES) {
      const m = festivosMap(l.id);
      expect(m.get('2027-12-24')?.ambito).toBe('convenio');
      expect(m.get('2027-12-31')?.ambito).toBe('convenio');
    }
  });

  it('Las Palmas incluye el festivo insular de Gran Canaria', () => {
    expect(festivosMap('las-palmas-gc').get('2027-09-08')?.ambito).toBe('insular');
    expect(madrid.has('2027-09-08')).toBe(false);
  });

  it('enero de 2028 queda pendiente de verificar', () => {
    expect(madrid.get('2028-01-06')?.verificar).toBe(true);
  });
});

describe('bloques', () => {
  it('fin = inicio + días − 1', () => {
    const plan = { ...crearPlanVacio('10+10+5+5'), bloques: ['2027-08-09', null, '2027-07-05', null] };
    const [b1, , b3] = calcularBloques(plan);
    expect(b1.fin).toBe('2027-08-18');
    expect(b3.fin).toBe('2027-07-09');
  });

  it('el puente resta un día al bloque', () => {
    const plan = { ...crearPlanVacio('15+15'), bloques: ['2027-08-02', null], puentes: ['2027-12-07', null] };
    const [b1] = calcularBloques(plan);
    expect(b1.dias).toBe(14);
    expect(b1.fin).toBe('2027-08-15');
  });

  it('la selección se encaja en el bloque libre de tamaño más parecido', () => {
    const plan = crearPlanVacio('10+10+5+5');
    expect(encajarSeleccion(plan, '2027-08-02', '2027-08-09')?.indice).toBe(0); // 8 días → bloque de 10
    expect(encajarSeleccion(plan, '2027-08-02', '2027-08-06')?.indice).toBe(2); // 5 días → bloque de 5
  });
});

describe('días generados (remanente de vacaciones)', () => {
  it('bloque de 10 días del 9 al 18 de agosto en Madrid: domingo 15 + festivo 16 = 2', () => {
    const plan = { ...crearPlanVacio('10+10+10'), bloques: ['2027-08-09', null, null] };
    const g = diasGenerados(calcularBloques(plan), madrid);
    expect(g.domingos).toEqual(['2027-08-15']);
    expect(g.festivos).toEqual(['2027-08-16']);
    expect(g.total).toBe(2);
  });

  it('un festivo en domingo cuenta una sola vez (Día de Canarias 2027)', () => {
    const plan = { ...crearPlanVacio('20+10'), bloques: [null, '2027-05-24'] };
    const g = diasGenerados(calcularBloques(plan), festivosMap('las-palmas-gc'));
    expect(g.total).toBe(1); // solo el 30/5: festivo y domingo a la vez
  });

  it('los festivos en sábado generan día, como en el Excel', () => {
    const plan = { ...crearPlanVacio('20+10'), bloques: [null, '2027-04-26'] }; // 26/4 – 5/5
    const g = diasGenerados(calcularBloques(plan), madrid);
    expect(g.festivos).toEqual(['2027-05-01']);
    expect(g.total).toBe(2); // domingo 2/5 + sábado festivo 1/5
  });

  it('el día de puente no genera días', () => {
    const plan = { ...crearPlanVacio('30'), bloques: [null], puentes: ['2027-12-07'] };
    expect(diasGenerados(calcularBloques(plan), madrid).total).toBe(0);
  });
});

describe('validaciones', () => {
  it('un bloque no puede empezar en domingo ni en festivo', () => {
    expect(codigos({ ...crearPlanVacio('15+15'), bloques: ['2027-08-08', null] })).toContain('BLOQUE_INICIO_DOMINGO');
    expect(codigos({ ...crearPlanVacio('15+15'), bloques: ['2027-08-16', null] })).toContain('BLOQUE_INICIO_FESTIVO');
    expect(codigos({ ...crearPlanVacio('15+15'), bloques: ['2027-08-17', null] })).not.toContain('BLOQUE_INICIO_FESTIVO');
  });

  it('entre los dos bloques de 5 días hay al menos 7 días (regla AN7 + 12 del Excel)', () => {
    const conTercero = (inicio: string) => ({
      ...crearPlanVacio('20+5+5'),
      bloques: [null, '2027-07-05', inicio],
    });
    expect(codigos(conTercero('2027-07-16'))).toContain('SEPARACION_BLOQUES_5');
    expect(codigos(conTercero('2027-07-17'))).not.toContain('SEPARACION_BLOQUES_5');
  });

  it('el segundo bloque de 5 días tiene que incluir un sábado', () => {
    const plan = (inicio: string) => ({ ...crearPlanVacio('20+5+5'), bloques: [null, '2027-06-07', inicio] });
    const res = validar(plan('2027-07-19'), { anio: ANIO, festivos: madrid });
    const inc = res.find((i) => i.codigo === 'BLOQUE_5_SIN_SABADO');
    expect(inc?.pendienteVerificar).toBe(true);
    expect(codigos(plan('2027-07-17'))).not.toContain('BLOQUE_5_SIN_SABADO');
  });

  it('no se pueden superar los 6 días de asuntos propios', () => {
    const asuntosPropios = ['2027-02-01', '2027-02-02', '2027-02-03', '2027-02-04', '2027-02-05', '2027-02-08'];
    expect(codigos({ ...crearPlanVacio(), asuntosPropios })).not.toContain('CUPO_ASUNTOS_PROPIOS');
    expect(codigos({ ...crearPlanVacio(), asuntosPropios: [...asuntosPropios, '2027-02-09'] })).toContain(
      'CUPO_ASUNTOS_PROPIOS',
    );
  });

  it('el remanente no puede superar los días generados por los bloques', () => {
    const plan = {
      ...crearPlanVacio('10+10+10'),
      bloques: ['2027-08-09', null, null],
      remanente: ['2027-02-01', '2027-02-02'],
    };
    expect(codigos(plan)).not.toContain('CUPO_REMANENTE'); // 2 generados
    expect(codigos({ ...plan, remanente: [...plan.remanente, '2027-02-03'] })).toContain('CUPO_REMANENTE');
  });

  it('vacaciones, puentes, asuntos propios y San Isidro solo dentro del año', () => {
    const vacio = crearPlanVacio('15+15');
    expect(codigos({ ...vacio, asuntosPropios: ['2028-01-10'] })).toContain('FUERA_DE_PLAZO');
    expect(codigos({ ...vacio, asuntosPropios: ['2027-12-30'] })).not.toContain('FUERA_DE_PLAZO');
    expect(codigos({ ...vacio, sanIsidro: '2028-01-03' })).toContain('FUERA_DE_PLAZO');
    expect(codigos({ ...vacio, puentes: ['2028-01-07', null] })).toContain('FUERA_DE_PLAZO');
    // Un bloque no puede quedar a caballo entre 2027 y 2028.
    expect(codigos({ ...vacio, bloques: ['2027-12-20', null] })).toContain('FUERA_DE_PLAZO');
    expect(codigos({ ...vacio, bloques: ['2027-12-17', null] })).not.toContain('FUERA_DE_PLAZO');
  });

  it('el remanente, las bajas y los no imputables llegan hasta el 31 de enero', () => {
    const vacio = crearPlanVacio();
    expect(codigos({ ...vacio, remanente: ['2028-01-31'] })).not.toContain('FUERA_DE_PLAZO');
    expect(codigos({ ...vacio, remanente: ['2028-02-01'] })).toContain('FUERA_DE_PLAZO');
    expect(codigos({ ...vacio, bajas: ['2028-01-20'] })).not.toContain('FUERA_DE_PLAZO');
  });
});

describe('pincel', () => {
  it('clic sobre un día de un bloque lo cancela entero', () => {
    const plan = { ...crearPlanVacio('15+15'), bloques: ['2027-08-02', null] };
    const r = aplicarPincel(plan, 'vacaciones', '2027-08-05', '2027-08-05', ctx, opciones);
    expect(r.rechazo).toBeUndefined();
    expect(r.plan.bloques).toEqual([null, null]);
  });

  it('un asunto propio dentro de un bloque se rechaza y no se guarda', () => {
    // Bloque del 5 al 14 de enero; asunto propio el 8 de enero.
    const plan = { ...crearPlanVacio('10+10+10'), bloques: ['2027-01-05', null, null] };
    const r = aplicarPincel(plan, 'asuntosPropios', '2027-01-08', '2027-01-08', ctx, opciones);
    expect(r.rechazo).toMatch(/08\/01\/2027.*Vacaciones \(bloque 1/);
    expect(r.plan).toBe(plan);
  });

  it('un bloque que se solapa con otro se rechaza y no se guarda', () => {
    const plan = { ...crearPlanVacio('15+15'), bloques: ['2027-08-02', null] };
    const r = aplicarPincel(plan, 'vacaciones', '2027-07-26', '2027-08-09', ctx, opciones);
    expect(r.rechazo).toMatch(/se solapa/);
    expect(r.plan.bloques).toEqual(['2027-08-02', null]);
  });

  it('desde los formularios tampoco se pueden solapar bloques ni días', () => {
    const plan = { ...crearPlanVacio('15+15'), bloques: ['2027-08-02', null] };
    expect(comprobarCambio(plan, { ...plan, bloques: ['2027-08-02', '2027-08-10'] }, ANIO)).toMatch(/dos bloques/);
    expect(comprobarCambio(plan, { ...plan, asuntosPropios: ['2027-08-04'] }, ANIO)).toMatch(/04\/08\/2027/);
    expect(comprobarCambio(plan, { ...plan, asuntosPropios: ['2027-09-01'] }, ANIO)).toBeNull();
  });

  it('arrastrar asuntos propios solo marca laborables y un segundo arrastre los quita', () => {
    const r = aplicarPincel(crearPlanVacio(), 'asuntosPropios', '2027-03-18', '2027-03-22', ctx, opciones);
    expect(r.plan.asuntosPropios).toEqual(['2027-03-18', '2027-03-22']); // 19/3 festivo, 20–21 finde
    const r2 = aplicarPincel(r.plan, 'asuntosPropios', '2027-03-18', '2027-03-22', ctx, opciones);
    expect(r2.plan.asuntosPropios).toEqual([]);
  });

  it('un bloque que acabaría en el año siguiente se rechaza', () => {
    const r = aplicarPincel(crearPlanVacio('15+15'), 'vacaciones', '2027-12-20', '2027-12-20', ctx, opciones);
    expect(r.rechazo).toMatch(/dentro de 2027/);
    expect(r.plan.bloques).toEqual([null, null]);
  });

  it('asuntos propios en enero del año siguiente se rechazan; el remanente sí se permite', () => {
    const ap = aplicarPincel(crearPlanVacio(), 'asuntosPropios', '2028-01-10', '2028-01-10', ctx, opciones);
    expect(ap.rechazo).toMatch(/dentro de 2027/);
    const rem = aplicarPincel(crearPlanVacio(), 'remanente', '2028-01-10', '2028-01-10', ctx, opciones);
    expect(rem.rechazo).toBeUndefined();
    expect(rem.plan.remanente).toEqual(['2028-01-10']);
  });

  it('el puente se asigna al primer bloque sin puente y se cancela pulsándolo', () => {
    const r = aplicarPincel(crearPlanVacio('15+15'), 'puente', '2027-12-07', '2027-12-07', ctx, opciones);
    expect(r.plan.puentes).toEqual(['2027-12-07', null]);
    const c = aplicarPincel(r.plan, 'puente', '2027-12-07', '2027-12-07', ctx, opciones);
    expect(c.plan.puentes).toEqual([null, null]);
  });

  it('quitar un puente que haría crecer el bloque hasta pisar otra marca se rechaza', () => {
    // Bloque de 15 con puente: 02/08–15/08. Sin puente acabaría el 16/08, que es asunto propio.
    const plan = {
      ...crearPlanVacio('15+15'),
      bloques: ['2027-08-02', null],
      puentes: ['2027-12-07', null],
      asuntosPropios: ['2027-08-16'],
    };
    const r = aplicarPincel(plan, 'puente', '2027-12-07', '2027-12-07', ctx, opciones);
    expect(r.rechazo).toMatch(/16\/08\/2027/);
    expect(r.plan).toBe(plan);
  });

  it('el 7/12/2027 es candidato a puente en Madrid', () => {
    expect(candidatosPuente(ANIO, madrid).has('2027-12-07')).toBe(true);
  });

  it('el Día de San Isidro es un solo día al año', () => {
    const r = aplicarPincel(crearPlanVacio(), 'sanIsidro', '2027-05-14', '2027-05-14', ctx, opciones);
    expect(r.plan.sanIsidro).toBe('2027-05-14');
    const otro = aplicarPincel(r.plan, 'sanIsidro', '2027-05-17', '2027-05-17', ctx, opciones);
    expect(otro.rechazo).toMatch(/Solo puedes coger un Día de San Isidro/);
    const rango = aplicarPincel(crearPlanVacio(), 'sanIsidro', '2027-05-10', '2027-05-14', ctx, opciones);
    expect(rango.rechazo).toBeDefined();
    const cancelado = aplicarPincel(r.plan, 'sanIsidro', '2027-05-14', '2027-05-14', ctx, opciones);
    expect(cancelado.plan.sanIsidro).toBeNull();
  });
});

describe('persistencia', () => {
  it('al importar se descarta cualquier motivo de baja y las fechas inválidas', () => {
    const datos = normalizarDatos({
      schemaVersion: 1,
      localidadId: 'vigo',
      anio: 2027,
      planes: { '2027': { modalidad: '30', bloques: ['2027-08-02'], bajas: ['2027-02-01', { fecha: '2027-02-02', motivo: 'x' }, '2027-02-30'] } },
    });
    expect(datos.planes['2027'].bajas).toEqual(['2027-02-01']);
    expect(JSON.stringify(datos)).not.toContain('motivo');
  });

  it('migra los días sueltos de la v1: 6 a asuntos propios y el resto a remanente', () => {
    const sueltos = ['2027-02-01', '2027-02-02', '2027-02-03', '2027-02-04', '2027-02-05', '2027-02-08', '2027-02-09'];
    const datos = normalizarDatos({
      schemaVersion: 1,
      planes: {
        '2027': {
          modalidad: '30',
          bloques: ['2027-08-02'],
          puentes: ['2027-12-07'],
          sueltos,
          semanaReducida: { inicio: '2027-05-10', fin: '2027-05-14' },
        },
      },
    });
    expect(datos.schemaVersion).toBe(2);
    expect(datos.planes['2027'].puentes).toEqual(['2027-12-07']);
    expect(datos.planes['2027'].asuntosPropios).toEqual(sueltos.slice(0, 6));
    expect(datos.planes['2027'].remanente).toEqual(['2027-02-09']);
    expect(datos.planes['2027'].sanIsidro).toBeNull();
  });

  it('rechaza versiones de esquema desconocidas', () => {
    expect(() => normalizarDatos({ schemaVersion: 99 })).toThrow();
  });
});

describe('derecho al Día de San Isidro (semana de fiestas locales)', () => {
  const semana = semanaFiestaLocal(localidadPorId('madrid'), ANIO, FESTIVOS);
  const ctxMadrid = { ...ctx, semanaFiestaLocal: semana };

  it('Madrid 2027: la semana de San Isidro es del 10 al 14 de mayo', () => {
    expect(semana).toMatchObject({ inicio: '2027-05-10', fin: '2027-05-14' });
    expect(semanaFiestaLocal(localidadPorId('vigo'), ANIO, FESTIVOS)).toBeNull();
  });

  it('un día suelto en la semana no hace perder el derecho; el segundo sí, con aviso', () => {
    const r1 = aplicarPincel(crearPlanVacio(), 'asuntosPropios', '2027-05-11', '2027-05-11', ctxMadrid, opciones);
    expect(r1.aviso).toBeUndefined();
    expect(estadoSanIsidro(r1.plan, semana, madrid)?.pierdeDerecho).toBe(false);
    const r2 = aplicarPincel(r1.plan, 'remanente', '2027-05-12', '2027-05-12', ctxMadrid, opciones);
    expect(r2.rechazo).toBeUndefined();
    expect(r2.plan.remanente).toEqual(['2027-05-12']); // se guarda igualmente
    expect(r2.aviso).toMatch(/2 días .* semana de San Isidro .*lo pierdes/);
    const avisos = validar(r2.plan, ctxMadrid).filter((i) => i.codigo === 'SAN_ISIDRO_PERDIDO');
    expect(avisos).toHaveLength(1);
    expect(avisos[0].nivel).toBe('aviso');
  });

  it('un bloque de vacaciones con dos días de esa semana hace perder el derecho', () => {
    // Bloque de 10 días del 2 al 11 de mayo: incluye el lunes 10 y el martes 11.
    const r = aplicarPincel(crearPlanVacio('10+10+10'), 'vacaciones', '2027-05-02', '2027-05-11', ctxMadrid, opciones);
    expect(r.plan.bloques[0]).toBe('2027-05-02');
    expect(r.aviso).toMatch(/lo pierdes/);
  });

  it('marcar el Día de San Isidro sin derecho avisa; las bajas no cuentan como ausencia', () => {
    const plan = { ...crearPlanVacio(), asuntosPropios: ['2027-05-10', '2027-05-11'] };
    const r = aplicarPincel(plan, 'sanIsidro', '2027-06-01', '2027-06-01', ctxMadrid, opciones);
    expect(r.plan.sanIsidro).toBe('2027-06-01');
    expect(r.aviso).toMatch(/01\/06\/2027\) no se podría disfrutar/);
    const conBajas = { ...crearPlanVacio(), bajas: ['2027-05-10', '2027-05-11'] };
    expect(estadoSanIsidro(conBajas, semana, madrid)?.pierdeDerecho).toBe(false);
  });

  it('sin semana de fiestas en los datos no se comprueba', () => {
    const plan = { ...crearPlanVacio(), asuntosPropios: ['2027-05-10', '2027-05-11'] };
    expect(estadoSanIsidro(plan, null, madrid)).toBeNull();
    expect(codigos(plan)).not.toContain('SAN_ISIDRO_PERDIDO');
  });
});
