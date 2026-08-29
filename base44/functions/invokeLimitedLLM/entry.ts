import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const DEFAULTS = {
  userMinute: 4,
  userDay: 40,
  userMonth: 300,
  userTokensDay: 80000,
  adminMinute: 20,
  adminDay: 200,
  adminMonth: 2000,
  adminTokensDay: 500000,
  maxPromptChars: 24000,
  maxFiles: 3,
  maxSchemaChars: 20000,
};

function envInt(name: string, fallback: number) {
  const value = Number.parseInt(Deno.env.get(name) || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function utcKeys(now = new Date()) {
  const iso = now.toISOString();
  return {
    minuteKey: iso.slice(0, 16),
    dayKey: iso.slice(0, 10),
    monthKey: iso.slice(0, 7),
  };
}

function estimatedTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function usageCount(events: any[]) {
  return (events || []).filter((event) => event.status !== 'blocked').length;
}

function tokenCount(events: any[]) {
  return (events || [])
    .filter((event) => event.status !== 'blocked')
    .reduce((sum, event) => sum + Number(event.estimatedInputTokens || 0), 0);
}

function safeModel(value: unknown) {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.-]{1,64}$/.test(value)) {
    throw new Error('Modelo de IA no válido');
  }
  return value;
}

function validateFileUrls(value: unknown, maxFiles: number) {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.length > maxFiles) throw new Error('Demasiados archivos adjuntos');
  return value.map((raw) => {
    if (typeof raw !== 'string' || raw.length > 2048) throw new Error('URL de archivo no válida');
    const url = new URL(raw);
    if (url.protocol !== 'https:') throw new Error('Los archivos deben usar HTTPS');
    return url.toString();
  });
}

Deno.serve(async (req) => {
  let eventId: string | undefined;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const isAdmin = ['admin', 'super_admin'].includes(user.role);
    const limits = isAdmin
      ? {
          minute: envInt('AI_ADMIN_CALLS_PER_MINUTE', DEFAULTS.adminMinute),
          day: envInt('AI_ADMIN_CALLS_PER_DAY', DEFAULTS.adminDay),
          month: envInt('AI_ADMIN_CALLS_PER_MONTH', DEFAULTS.adminMonth),
          tokensDay: envInt('AI_ADMIN_INPUT_TOKENS_PER_DAY', DEFAULTS.adminTokensDay),
        }
      : {
          minute: envInt('AI_USER_CALLS_PER_MINUTE', DEFAULTS.userMinute),
          day: envInt('AI_USER_CALLS_PER_DAY', DEFAULTS.userDay),
          month: envInt('AI_USER_CALLS_PER_MONTH', DEFAULTS.userMonth),
          tokensDay: envInt('AI_USER_INPUT_TOKENS_PER_DAY', DEFAULTS.userTokensDay),
        };

    const maxPromptChars = envInt('AI_MAX_PROMPT_CHARS', DEFAULTS.maxPromptChars);
    const maxFiles = envInt('AI_MAX_FILES_PER_REQUEST', DEFAULTS.maxFiles);
    const maxSchemaChars = envInt('AI_MAX_SCHEMA_CHARS', DEFAULTS.maxSchemaChars);
    const keys = utcKeys();
    const userId = String(user.id);

    const [minuteEvents, dayEvents, monthEvents] = await Promise.all([
      base44.asServiceRole.entities.AIUsageEvent.filter({ userId, minuteKey: keys.minuteKey }),
      base44.asServiceRole.entities.AIUsageEvent.filter({ userId, dayKey: keys.dayKey }),
      base44.asServiceRole.entities.AIUsageEvent.filter({ userId, monthKey: keys.monthKey }),
    ]);

    const snapshot = {
      minute: usageCount(minuteEvents),
      day: usageCount(dayEvents),
      month: usageCount(monthEvents),
      tokensDay: tokenCount(dayEvents),
    };

    if (body.action === 'status') {
      return Response.json({
        limits,
        used: snapshot,
        remaining: {
          minute: Math.max(0, limits.minute - snapshot.minute),
          day: Math.max(0, limits.day - snapshot.day),
          month: Math.max(0, limits.month - snapshot.month),
          tokensDay: Math.max(0, limits.tokensDay - snapshot.tokensDay),
        },
      });
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return Response.json({ error: 'El prompt es obligatorio' }, { status: 400 });
    if (prompt.length > maxPromptChars) {
      return Response.json({ error: 'La solicitud supera el tamaño máximo permitido' }, { status: 413 });
    }

    const fileUrls = validateFileUrls(body.file_urls, maxFiles);
    const schema = body.response_json_schema;
    if (schema != null && (typeof schema !== 'object' || JSON.stringify(schema).length > maxSchemaChars)) {
      return Response.json({ error: 'El esquema de respuesta no es válido o es demasiado grande' }, { status: 400 });
    }

    const inputTokens = estimatedTokens(prompt) + (fileUrls?.length || 0) * 1000;
    const exceeded =
      snapshot.minute >= limits.minute ? 'minute'
      : snapshot.day >= limits.day ? 'day'
      : snapshot.month >= limits.month ? 'month'
      : snapshot.tokensDay + inputTokens > limits.tokensDay ? 'tokensDay'
      : null;

    if (exceeded) {
      await base44.asServiceRole.entities.AIUsageEvent.create({
        userId,
        userEmail: user.email || '',
        companyId: user.data?.company_id || '',
        ...keys,
        requestId: crypto.randomUUID(),
        operation: 'llm',
        status: 'blocked',
        promptChars: prompt.length,
        estimatedInputTokens: inputTokens,
        internetContext: body.add_context_from_internet === true,
        fileCount: fileUrls?.length || 0,
        errorCode: `limit_${exceeded}`,
        completedAt: new Date().toISOString(),
      });
      const retryAfterSeconds = exceeded === 'minute' ? 60 : exceeded === 'day' || exceeded === 'tokensDay' ? 3600 : 86400;
      return Response.json(
        { error: 'Has alcanzado temporalmente el límite de uso de IA. Inténtalo más tarde.', code: `AI_LIMIT_${exceeded.toUpperCase()}` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
      );
    }

    const model = safeModel(body.model);
    const event = await base44.asServiceRole.entities.AIUsageEvent.create({
      userId,
      userEmail: user.email || '',
      companyId: user.data?.company_id || '',
      ...keys,
      requestId: crypto.randomUUID(),
      operation: 'llm',
      status: 'reserved',
      model: model || '',
      promptChars: prompt.length,
      estimatedInputTokens: inputTokens,
      internetContext: body.add_context_from_internet === true,
      fileCount: fileUrls?.length || 0,
    });
    eventId = event.id;

    const params: Record<string, unknown> = { prompt };
    if (body.add_context_from_internet === true) params.add_context_from_internet = true;
    if (schema != null) params.response_json_schema = schema;
    if (fileUrls) params.file_urls = fileUrls;
    if (model) params.model = model;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM(params);
    const outputChars = typeof result === 'string' ? result.length : JSON.stringify(result ?? '').length;
    await base44.asServiceRole.entities.AIUsageEvent.update(event.id, {
      status: 'success',
      estimatedOutputTokens: estimatedTokens('x'.repeat(Math.min(outputChars, 200000))),
      completedAt: new Date().toISOString(),
    });

    return Response.json({ result });
  } catch (error) {
    console.error('[invokeLimitedLLM] Error:', error);
    if (eventId) {
      try {
        const retryClient = createClientFromRequest(req);
        await retryClient.asServiceRole.entities.AIUsageEvent.update(eventId, {
          status: 'error',
          errorCode: 'provider_or_internal_error',
          completedAt: new Date().toISOString(),
        });
      } catch (_) {
        // La respuesta de error principal no debe quedar bloqueada por la auditoría.
      }
    }
    const message = error instanceof Error && /no válido|Demasiados|HTTPS/.test(error.message)
      ? error.message
      : 'No se pudo completar la solicitud de IA';
    return Response.json({ error: message }, { status: /no válido|Demasiados|HTTPS/.test(message) ? 400 : 500 });
  }
});
