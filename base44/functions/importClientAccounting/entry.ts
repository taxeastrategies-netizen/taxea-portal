import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { file_url, companyId, sheets: onlySheets } = await req.json();
    if (!file_url || !companyId) {
      return Response.json({ error: 'file_url and companyId required' }, { status: 400 });
    }

    // Fetch and parse the Excel file
    const resp = await fetch(file_url);
    if (!resp.ok) throw new Error(`Failed to fetch file: ${resp.status}`);
    const arrayBuffer = await resp.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { cellDates: true });

    const batch = `imp_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`;
    const results = {};
    const BULK_SIZE = 500;
    const TAX = 'Tax & Accounting';
    const FIN = 'Finance';
    const VAL = 'BORRADOR_PENDIENTE_REVISION';

    const num = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
      return isNaN(n) ? 0 : n;
    };
    const str = (v) => (v === null || v === undefined) ? '' : String(v);
    const optStr = (v) => (v === null || v === undefined || v === '') ? null : String(v);
    const date = (v) => {
      if (!v) return null;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      const s = String(v);
      if (s.includes('T')) return s.slice(0, 10);
      return s;
    };

    async function processSheet(sheetName, mapper, entityName) {
      if (onlySheets && !onlySheets.includes(sheetName)) return;
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        results[entityName] = { sheet: sheetName, error: 'Sheet not found' };
        return;
      }
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      const records = [];
      let mapErrors = 0;
      for (const r of rows) {
        try { records.push(mapper(r)); } catch { mapErrors++; }
      }
      let created = 0;
      let bulkErrors = 0;
      let firstError = null;
      for (let i = 0; i < records.length; i += BULK_SIZE) {
        const chunk = records.slice(i, i + BULK_SIZE);
        try {
          await base44.asServiceRole.entities[entityName].bulkCreate(chunk);
          created += chunk.length;
        } catch (e) {
          console.error(`BulkCreate ${entityName} batch ${i}:`, e.message);
          if (!firstError) firstError = e.message;
          // Try single-record insert to find the specific validation error
          if (chunk.length > 1 && !firstError) {
            for (const rec of chunk) {
              try { await base44.asServiceRole.entities[entityName].create(rec); created++; }
              catch (e2) { if (!firstError) firstError = e2.message; break; }
            }
          }
          bulkErrors += chunk.length;
        }
      }
      results[entityName] = { sheet: sheetName, total: rows.length, created, mapErrors, bulkErrors, firstError };
    }

    // 1. ImportSource (11_Fuentes)
    await processSheet('11_Fuentes', (r) => ({
      companyId, ejercicio: r.Ejercicio || 0, department: TAX, validationStatus: VAL, importBatch: batch,
      fuente: str(r.Fuente), ruta: str(r.Ruta), tipo: str(r.Tipo),
      tamanoBytes: num(r.Tamano_Bytes), modificado: str(r.Modificado), notas: str(r.Notas),
      registrosDeclarados: num(r.Registros_Declarados), lineasDiario: num(r.Lineas_Diario),
      subcuentas: num(r.Subcuentas), lineasIva: num(r.Lineas_IVA),
      lineasRetencion: num(r.Lineas_Retencion), proyectos: num(r.Proyectos)
    }), 'ImportSource');

    // 2. AccountingAccount (03_Subcuentas)
    await processSheet('03_Subcuentas', (r) => ({
      companyId, ejercicio: r.Ejercicio || 0, department: TAX, validationStatus: VAL, importBatch: batch,
      code: str(r.Subcuenta), name: str(r.CONCEPTO), group: str(r.Grupo), grupoNombre: str(r.Grupo_Nombre),
      nivelCuenta: str(r.Nivel_Cuenta), nif: optStr(r.CIF), direccion: optStr(r.DIRECCION),
      codPos: optStr(r.COD_POS), poblacion: optStr(r.POBLACION), provincia: optStr(r.PROVINCIA),
      pais: optStr(r.PAIS), telefono: optStr(r.TELEFONO), correo: optStr(r.CORREO),
      web: optStr(r.WEB), ventaCompra: optStr(r.VENTA_COMPRA), retencion: optStr(r.RETENCION),
      tipoRegistro: str(r.TipoRegistro), sourceFile: str(r.Fuente),
      importKey: `${r.Ejercicio}|${r.Subcuenta}`
    }), 'AccountingAccount');

    // 3. JournalEntry (02_Asientos)
    await processSheet('02_Asientos', (r) => ({
      companyId, ejercicio: r.Ejercicio || 0, department: TAX, validationStatus: VAL, importBatch: batch,
      entryNumber: str(r.ASIENTO), date: date(r.Fecha), type: 'manual', source: 'importacion',
      status: 'pendiente_revision', description: str(r.Conceptos_Principales),
      totalDebit: num(r.Total_Debe), totalCredit: num(r.Total_Haber), isBalanced: str(r.Cuadrado) === 'SI',
      claseAsiento: str(r.Clase_Asiento), cuadrado: str(r.Cuadrado),
      lineas: num(r.Lineas), subcuentasDistintas: str(r.Subcuentas_Distintas),
      diferencia: num(r.Diferencia), conceptosPrincipales: str(r.Conceptos_Principales),
      fuente: str(r.Fuente), importKey: str(r.Asiento_Key), sourceFile: str(r.Fuente)
    }), 'JournalEntry');

    // 4. JournalEntryLine (01_Diario) — largest sheet ~21,500 rows
    await processSheet('01_Diario', (r) => ({
      companyId, ejercicio: r.Ejercicio || 0, department: TAX, validationStatus: VAL, importBatch: batch,
      accountCode: str(r.SUBCUENTA), accountName: str(r.Nombre_Subcuenta),
      description: str(r.CONCEPTO), debit: num(r.DEBE), credit: num(r.HABER),
      journalEntryId: str(r.Asiento_Key),
      lineNumber: num(r.ORDEN), asientoKey: str(r.Asiento_Key), asientoNumero: num(r.ASIENTO),
      fechaOriginal: str(r.Fecha_Original), mes: num(r.Mes), trimestre: str(r.Trimestre),
      subcuenta: str(r.SUBCUENTA), nombreSubcuenta: str(r.Nombre_Subcuenta),
      cuenta4: str(r.Cuenta_4), cuenta3: str(r.Cuenta_3),
      grupo: str(r.Grupo), grupoNombre: str(r.Grupo_Nombre),
      claseAsiento: str(r.Clase_Asiento), concepto: str(r.CONCEPTO),
      documento: optStr(r.DOCUMENTO), factura: optStr(r.FACTURA), proyecto: optStr(r.PROYECTO),
      tipo: optStr(r.TIPO), divisa: str(r.DIVISA), punteado: optStr(r.PUNTEADO),
      tipoRegistro: str(r.TipoRegistro), debeE: num(r.DEBE_E), haberE: num(r.HABER_E),
      sourceFile: str(r.Fuente), importKey: str(r.Import_Key)
    }), 'JournalEntryLine');

    // 5. VATRecord (04_IVA_2025)
    await processSheet('04_IVA_2025', (r) => ({
      companyId, ejercicio: r.Ejercicio || 2025, department: TAX, validationStatus: VAL, importBatch: batch,
      fecha: date(r.Fecha), fechaOriginal: str(r.Fecha_Original), mes: num(r.Mes),
      trimestre: str(r.Trimestre), asiento: str(r.ASIENTO), orden: str(r.ORDEN),
      subcuenta: str(r.SUBCUENTA), contra: str(r.CONTRA), venCom: str(r.VEN_COM),
      factura: str(r.FACTURA), baseimp: num(r.BASEIMP), cuota: num(r.CUOTA), iva: num(r.IVA),
      baseret: num(r.BASERET), cuotaRet: num(r.CUOTA_RET), retencion: num(r.RETENCION),
      nif: optStr(r.NIF), nom: optStr(r.NOM), tipoRegistro: str(r.TipoRegistro),
      sourceFile: str(r.Fuente), importKey: str(r.Import_Key)
    }), 'VATRecord');

    // 6. FiscalAuxiliaryRecord (05_Fiscal_Otros)
    await processSheet('05_Fiscal_Otros', (r) => ({
      companyId, ejercicio: r.Ejercicio || 0, department: TAX, validationStatus: VAL, importBatch: batch,
      seccion: str(r.Seccion), fecha: date(r.Fecha), fechaOriginal: str(r.Fecha_Original),
      mes: num(r.Mes), trimestre: str(r.Trimestre), asiento: str(r.ASIENTO), orden: str(r.ORDEN),
      subcuenta: optStr(r.SUBCUENTA), contra: optStr(r.CONTRA),
      baseRet: num(r.BASE_RET), cuotaRet: num(r.CUOTA_RET), porcRet: num(r.PORC_RET),
      claveRet: optStr(r.CLAVE_RET), codproyecto: optStr(r.CODPROYECTO),
      descripcion: optStr(r.DESCRIPCION), tipoRegistro: str(r.TipoRegistro),
      sourceFile: str(r.Fuente), importKey: str(r.Import_Key)
    }), 'FiscalAuxiliaryRecord');

    // 7. TrialBalanceLine (06_SumasSaldos_2025)
    await processSheet('06_SumasSaldos_2025', (r) => ({
      companyId, ejercicio: r.Ejercicio || 2025, department: TAX, validationStatus: VAL, importBatch: batch,
      cuenta: str(r.Cuenta), nombre: str(r.Nombre), nivelCuenta: str(r.Nivel_Cuenta),
      grupo: str(r.Grupo), grupoNombre: str(r.Grupo_Nombre),
      saldoInicial: num(r.Saldo_Inicial), debePeriodo: num(r.Debe_Periodo),
      haberPeriodo: num(r.Haber_Periodo), debeAcumulado: num(r.Debe_Acumulado),
      haberAcumulado: num(r.Haber_Acumulado), debeSaldo: num(r.Debe_Saldo),
      haberSaldo: num(r.Haber_Saldo), saldoFirmado: num(r.Saldo_Firmado_Debe_Menos_Haber),
      sourceFile: str(r.Fuente)
    }), 'TrialBalanceLine');

    // 8. BalanceSheetLine XLS (07_Situacion_XLS)
    await processSheet('07_Situacion_XLS', (r) => ({
      companyId, ejercicio: r.Ejercicio || 2025, department: TAX, validationStatus: VAL, importBatch: batch,
      fuente: str(r.Fuente), seccion: str(r.Seccion), codigo: str(r.Codigo),
      descripcion: str(r.Descripcion), nivelCuenta: str(r.Nivel_Cuenta),
      importe2025: num(r.Importe_2025), importe2024: num(r.Importe_2024)
    }), 'BalanceSheetLine');

    // 9. BalanceSheetLine PDF (08_Situacion_PDF)
    await processSheet('08_Situacion_PDF', (r) => ({
      companyId, ejercicio: r.Ejercicio || 2025, department: TAX, validationStatus: VAL, importBatch: batch,
      fuente: str(r.Fuente), seccion: str(r.Seccion), codigo: str(r.Codigo),
      descripcion: str(r.Descripcion), etiquetaOriginal: str(r.Etiqueta_Original),
      importe2025: num(r.Importe_2025), pagina: num(r.Pagina), lineaPagina: num(r.Linea_Pagina)
    }), 'BalanceSheetLine');

    // 10. ProfitLossLine (09_PYG) — Finance
    await processSheet('09_PYG', (r) => ({
      companyId, ejercicio: r.Ejercicio || 0, department: FIN, validationStatus: VAL, importBatch: batch,
      subcuenta: str(r.Subcuenta), nombreSubcuenta: str(r.Nombre_Subcuenta),
      grupo: str(r.Grupo), naturaleza: str(r.Naturaleza),
      debeOperativo: num(r.Debe_Operativo), haberOperativo: num(r.Haber_Operativo),
      importePyg: num(r.Importe_PYG), impactoResultado: num(r.Impacto_Resultado),
      lineas: num(r.Lineas), nota: optStr(r.Nota), sourceFile: str(r.Fuente)
    }), 'ProfitLossLine');

    // 11. FinancialMetric (10_Finance_KPIs) — Finance
    await processSheet('10_Finance_KPIs', (r) => ({
      companyId, ejercicio: r.Ejercicio || 0, department: FIN, validationStatus: VAL, importBatch: batch,
      familia: str(r.Familia), metrica: str(r.Metrica), valor: num(r.Valor),
      unidad: str(r.Unidad), nota: optStr(r.Nota), sourceFile: str(r.Fuente)
    }), 'FinancialMetric');

    // 12. ImportControlIssue (12_Controles)
    await processSheet('12_Controles', (r) => ({
      companyId, ejercicio: r.Ejercicio || 0, department: TAX, validationStatus: VAL, importBatch: batch,
      control: str(r.Control), estado: str(r.Estado), delta: num(r.Delta),
      detalle: str(r.Detalle), valorA: optStr(r.Valor_A), fuenteA: optStr(r.Fuente_A),
      valorB: optStr(r.Valor_B), fuenteB: optStr(r.Fuente_B), notas: optStr(r.Notas)
    }), 'ImportControlIssue');

    return Response.json({ status: 'ok', batch, results });
  } catch (error) {
    console.error('importClientAccounting:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});