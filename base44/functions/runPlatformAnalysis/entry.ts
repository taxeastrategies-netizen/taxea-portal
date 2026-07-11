import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const manualTrigger = body?.manual === true;
    const targetCompanyId = body?.company_id || null;
    const focus = body?.focus || null; // 'errores' | 'predictivos' | 'mejoras' | null

    const isManual = manualTrigger || body?.manual === 'true';
    const validFocus = ['errores', 'predictivos', 'mejoras'].includes(focus) ? focus : null;

    // === 1. Gather platform-wide stats ===
    const [
      users, subscriptions, invoices, expenses, ocrDocs,
      companies, fiscalErrors, sugerencias, tasks, payments,
      ocrPending, ocrFailed
    ] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 200),
      base44.asServiceRole.entities.Subscription.list('-created_date', 200),
      base44.asServiceRole.entities.Invoice.list('-created_date', 100),
      base44.asServiceRole.entities.Expense.list('-created_date', 100),
      base44.asServiceRole.entities.OcrInvoiceDocument.list('-created_date', 100),
      base44.asServiceRole.entities.Company.list('-created_date', 200),
      base44.asServiceRole.entities.FiscalError.list('-created_date', 50),
      base44.asServiceRole.entities.Sugerencia.list('-created_date', 50),
      base44.asServiceRole.entities.Task.list('-created_date', 50),
      base44.asServiceRole.entities.PaymentRecord.list('-created_date', 50),
      base44.asServiceRole.entities.OcrInvoiceDocument.filter({ status: 'pending' }, '-created_date', 50),
      base44.asServiceRole.entities.OcrInvoiceDocument.filter({ status: 'analysis_failed' }, '-created_date', 50),
    ]);

    // === 2. Compute platform metrics ===
    const now = new Date();
    const activeSubs = (subscriptions || []).filter(s => s.status === 'activa');
    const pastDueSubs = (subscriptions || []).filter(s => s.status === 'past_due');
    const cancelledSubs = (subscriptions || []).filter(s => s.status === 'cancelada');
    const pendingTasks = (tasks || []).filter(t => !['completada', 'cancelada'].includes(t.estado));
    const overdueTasks = (tasks || []).filter(t => {
      if (!t.fecha_limite) return false;
      return new Date(t.fecha_limite) < now && !['completada', 'cancelada'].includes(t.estado);
    });
    const failedPayments = (payments || []).filter(p => p.status === 'failed');
    const anuladas = (invoices || []).filter(i => i.anulada === true);
    const invoicesNoQuarter = (invoices || []).filter(i => !i.trimestre || !i.anio);
    const expensesNoCategory = (expenses || []).filter(e => !e.categoria);
    const openErrors = (fiscalErrors || []).filter(e => !['resuelto', 'ignorado'].includes(e.estado));
    const criticalErrors = openErrors.filter(e => e.severidad === 'critica');

    // Users without company_id
    const usersWithoutCompany = (users || []).filter(u => !u.data?.company_id && u.role !== 'admin' && u.role !== 'super_admin');

    // OCR docs stuck in pending for > 24h
    const staleOcr = (ocrPending || []).filter(d => {
      if (!d.uploadedAt) return false;
      return (now - new Date(d.uploadedAt)) > 24 * 60 * 60 * 1000;
    });

    const platformData = {
      users: {
        total: users?.length || 0,
        withoutCompany: usersWithoutCompany.length,
        list: (users || []).slice(0, 20).map(u => ({ email: u.email, role: u.role, company_id: u.data?.company_id })),
      },
      subscriptions: {
        total: subscriptions?.length || 0,
        active: activeSubs.length,
        pastDue: pastDueSubs.length,
        cancelled: cancelledSubs.length,
        pastDueList: pastDueSubs.slice(0, 5).map(s => ({ userId: s.userId, planCode: s.planCode, status: s.status })),
      },
      invoices: {
        total: invoices?.length || 0,
        anuladas: anuladas.length,
        missingQuarter: invoicesNoQuarter.length,
      },
      expenses: {
        total: expenses?.length || 0,
        missingCategory: expensesNoCategory.length,
      },
      ocr: {
        total: ocrDocs?.length || 0,
        pendingStale: staleOcr.length,
        failed: ocrFailed?.length || 0,
        failedList: (ocrFailed || []).slice(0, 5).map(d => ({ id: d.id, fileName: d.originalFileName, error: d.safeErrorMessage })),
      },
      companies: {
        total: companies?.length || 0,
        list: (companies || []).slice(0, 20).map(c => ({ name: c.nombre, owner: c.owner_email, nif: c.nif })),
      },
      tasks: {
        total: tasks?.length || 0,
        pending: pendingTasks.length,
        overdue: overdueTasks.length,
      },
      payments: {
        total: payments?.length || 0,
        failed: failedPayments.length,
      },
      errors: {
        total: fiscalErrors?.length || 0,
        open: openErrors.length,
        critical: criticalErrors.length,
      },
      suggestions: {
        total: sugerencias?.length || 0,
      },
    };

    // === 3. Build LLM prompt ===
    const focusInstructions = validFocus === 'errores'
      ? `FOCO EXCLUSIVO: ANÁLISIS DE ERRORES Y PROBLEMAS ACTIVOS.
Genera ÚNICAMENTE la sección "errores". Sé extremadamente exhaustivo: examina cada entidad, cada métrica, cada relación entre datos.
Busca errores de integridad de datos, inconsistencias fiscales, registros huérfanos, configuraciones incorrectas, facturas duplicadas o sin trimestre, gastos sin categoría, usuarios sin empresa, suscripciones en estado inválido, tareas vencidas, pagos fallidos, OCRs atascados.
Para cada error, especifica exactamente qué registro o conjunto de registros está afectado (emails, IDs, cantidades).`
      : validFocus === 'predictivos'
      ? `FOCO EXCLUSIVO: ANÁLISIS PREDICTIVO Y DE RIESGOS FUTUROS.
Genera ÚNICAMENTE la sección "predictivos". Piensa como un analista de riesgos: ¿qué podría fallar en los próximos días/semanas?
Analiza tendencias: suscripciones a punto de caducar, empresas con cargas administrativas desbalanceadas, usuarios sin onboarding completo que podrían churnear, facturas anuladas como síntoma de problemas de UX, cuellos de botella administrativos.
Considera riesgos fiscales: trimestres sin facturas, empresas sin movimientos, patrones de anulación.`
      : validFocus === 'mejoras'
      ? `FOCO EXCLUSIVO: IDEAS DE MEJORA E INNOVACIÓN.
Genera ÚNICAMENTE la sección "mejoras". Sé creativo pero práctico: basa las ideas en los datos reales de la plataforma.
Propón: automatizaciones que eliminen trabajo manual, mejoras visuales en dashboards, nuevas funcionalidades de IA, herramientas de productividad fiscal, mejoras móviles, integraciones nuevas, optimizaciones de rendimiento.
Prioriza mejoras que resuelvan problemas detectados en los datos reales de la plataforma.`
      : '';

    const prompt = `Eres un analista de plataforma experto en sistemas SaaS de administración fiscal y contable (Taxea Strategies).
Analiza los siguientes datos de la plataforma y genera un informe estructurado en JSON.

DATOS DE LA PLATAFORMA:
${JSON.stringify(platformData, null, 2)}

INSTRUCCIONES:
${focusInstructions || `Genera un análisis profundo e inteligente que incluya:

1. **errores**: Lista de errores detectados, ORDENADOS DE MÁS GRAVE A MENOS GRAVE. Cada error debe incluir:
   - tipo: título corto del error
   - descripcion: explicación detallada
   - severidad: "critica" | "alta" | "media" | "baja"
   - accion_recomendada: qué hacer para resolverlo
   - categoria: "seguridad" | "datos" | "rendimiento" | "plataforma" | "fiscal" | "predictivo"

2. **predictivos**: Lista de cosas que PODRÍAN FALLAR pronto, con anticipación. Cada item:
   - tipo: qué podría fallar
   - descripcion: por qué y cuándo podría ocurrir
   - severidad: "critica" | "alta" | "media" | "baja"
   - accion_recomendada: cómo prevenirlo
   - categoria: "predictivo"

3. **mejoras**: Ideas innovadoras para mejorar la plataforma. Incluye mejoras visuales, nuevas herramientas, automatizaciones, innovaciones. Cada item:
   - titulo: nombre de la mejora
   - descripcion: qué es y por qué es valiosa
   - tipo: "nueva_funcionalidad" | "mejora_visual" | "ia" | "rendimiento" | "movil" | "dashboard" | "contabilidad" | "facturacion"
   - prioridad: "critica" | "alta" | "media" | "baja"

Sé específico, práctico y accionable. Prioriza problemas reales detectados en los datos sobre genéricos.`}`;

    // === 4. Call LLM ===
    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          errores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tipo: { type: "string" },
                descripcion: { type: "string" },
                severidad: { type: "string" },
                accion_recomendada: { type: "string" },
                categoria: { type: "string" },
              },
            },
          },
          predictivos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tipo: { type: "string" },
                descripcion: { type: "string" },
                severidad: { type: "string" },
                accion_recomendada: { type: "string" },
              },
            },
          },
          mejoras: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titulo: { type: "string" },
                descripcion: { type: "string" },
                tipo: { type: "string" },
                prioridad: { type: "string" },
              },
            },
          },
        },
      },
    });

    const analysis = typeof llmResponse === 'string' ? JSON.parse(llmResponse) : llmResponse;

    // === 5. Save results ===
    const companyId = targetCompanyId || 'platform';
    const fuente = isManual ? 'ia_manual' : 'ia_diario';
    const savedErrors = [];
    const savedSuggestions = [];

    // Save errors (skip if focused on mejoras)
    if (!validFocus || validFocus === 'errores') {
      for (const err of (analysis.errores || []).slice(0, 20)) {
        try {
          const rec = await base44.asServiceRole.entities.FiscalError.create({
            company_id: companyId,
            tipo: err.tipo,
            descripcion: err.descripcion,
            severidad: ['baja', 'media', 'alta', 'critica'].includes(err.severidad) ? err.severidad : 'media',
            estado: 'detectado',
            accion_recomendada: err.accion_recomendada || '',
            fuente,
            categoria_analisis: ['fiscal', 'datos', 'rendimiento', 'seguridad', 'plataforma', 'predictivo'].includes(err.categoria) ? err.categoria : 'plataforma',
            etiquetas: ['ia', isManual ? 'manual' : 'diario', validFocus ? 'focado' : 'completo'].filter(Boolean),
          });
          savedErrors.push(rec);
        } catch (e) { console.error('Error saving FiscalError:', e.message); }
      }
    }

    // Save predictive items (skip if focused on errores or mejoras)
    if (!validFocus || validFocus === 'predictivos') {
      for (const pred of (analysis.predictivos || []).slice(0, 10)) {
        try {
          const rec = await base44.asServiceRole.entities.FiscalError.create({
            company_id: companyId,
            tipo: `[PREDICTIVO] ${pred.tipo}`,
            descripcion: pred.descripcion,
            severidad: ['baja', 'media', 'alta', 'critica'].includes(pred.severidad) ? pred.severidad : 'media',
            estado: 'detectado',
            accion_recomendada: pred.accion_recomendada || '',
            fuente,
            categoria_analisis: 'predictivo',
            etiquetas: ['ia', 'predictivo', isManual ? 'manual' : 'diario', validFocus ? 'focado' : 'completo'].filter(Boolean),
          });
          savedErrors.push(rec);
        } catch (e) { console.error('Error saving predictive:', e.message); }
      }
    }

    // Save improvement suggestions (skip if focused on errores or predictivos)
    if (!validFocus || validFocus === 'mejoras') {
      for (const mej of (analysis.mejoras || []).slice(0, 15)) {
        try {
          const rec = await base44.asServiceRole.entities.Sugerencia.create({
            company_id: companyId,
            titulo: mej.titulo,
            descripcion: mej.descripcion,
            tipo: ['nueva_funcionalidad', 'mejora_visual', 'ia', 'contabilidad', 'facturacion', 'dashboard', 'rendimiento', 'movil', 'otro'].includes(mej.tipo) ? mej.tipo : 'otro',
            prioridad: ['baja', 'media', 'alta', 'critica'].includes(mej.prioridad) ? mej.prioridad : 'media',
            estado: 'nueva',
            usuario_email: user.email,
            usuario_nombre: 'Análisis IA',
            publica: false,
          });
          savedSuggestions.push(rec);
        } catch (e) { console.error('Error saving suggestion:', e.message); }
      }
    }

    return Response.json({
      status: 'ok',
      focus: validFocus || 'completo',
      analysis,
      saved: {
        errors: savedErrors.length,
        suggestions: savedSuggestions.length,
      },
      platformSnapshot: {
        users: platformData.users.total,
        activeSubs: platformData.subscriptions.active,
        openErrors: platformData.errors.open,
        criticalErrors: platformData.errors.critical,
      },
    });
  } catch (error) {
    console.error('runPlatformAnalysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});