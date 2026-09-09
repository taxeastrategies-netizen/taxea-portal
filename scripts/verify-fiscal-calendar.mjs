globalThis.Deno = { serve: () => undefined };

const imported = await import('file:///tmp/fiscal-test.cjs');
const { generateSchedule, normalizeCode, normalizePeriod } = imported.default || imported;

const pick = (code, year, period, periodicidad = 'trimestral') =>
  generateSchedule({ codigo: code, periodicidad }, year).find(item => item.period === period);

const cases = [
  [pick('303', 2026, 'T1'), { filingDeadline: '2026-04-20', domicileDeadline: '2026-04-15', deadlineStatus: 'verificado' }],
  [pick('303', 2026, 'T4'), { filingDeadline: '2027-02-01', domicileDeadline: '2027-01-25', deadlineStatus: 'provisional' }],
  [pick('202', 2026, 'P3'), { filingDeadline: '2026-12-21', domicileDeadline: '2026-12-16', deadlineStatus: 'verificado' }],
  [pick('200', 2025, 'ANUAL'), { filingDeadline: '2026-07-27', domicileDeadline: '2026-07-22', deadlineStatus: 'verificado' }],
  [pick('420', 2026, 'T4'), { filingDeadline: '2027-02-01', domicileDeadline: '2027-01-26', deadlineStatus: 'verificado' }],
  [pick('425', 2025, 'ANUAL'), { filingDeadline: '2026-02-03', domicileDeadline: '', deadlineStatus: 'verificado' }],
];

for (const [actual, expected] of cases) {
  if (!actual) throw new Error('No se generó uno de los vencimientos esperados.');
  for (const [field, value] of Object.entries(expected)) {
    if (actual[field] !== value) throw new Error(`${actual.code} ${actual.period}: ${field}=${actual[field]} (esperado ${value})`);
  }
}

if (normalizeCode('modelo_420_igic') !== '420') throw new Error('Fallo al normalizar modelo IGIC.');
if (normalizePeriod('1T') !== 'T1' || normalizePeriod('anual') !== 'ANUAL') throw new Error('Fallo al normalizar períodos.');

console.log(JSON.stringify({ ok: true, checkedDeadlines: cases.length, normalizers: 3 }));

