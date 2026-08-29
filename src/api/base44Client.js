import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const sdkBase44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

const limitedCore = new Proxy(sdkBase44.integrations.Core, {
  get(target, property, receiver) {
    if (property !== 'InvokeLLM') return Reflect.get(target, property, receiver);

    return async (params) => {
      const response = await sdkBase44.functions.invoke('invokeLimitedLLM', params);
      const payload = response?.data ?? response;
      if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'result')) {
        throw new Error(payload?.error || 'No se pudo completar la solicitud de IA');
      }
      return payload.result;
    };
  }
});

const limitedIntegrations = new Proxy(sdkBase44.integrations, {
  get(target, property, receiver) {
    if (property === 'Core') return limitedCore;
    return Reflect.get(target, property, receiver);
  }
});

// Todas las llamadas InvokeLLM del frontend pasan por el control de cuota del servidor.
export const base44 = new Proxy(sdkBase44, {
  get(target, property, receiver) {
    if (property === 'integrations') return limitedIntegrations;
    return Reflect.get(target, property, receiver);
  }
});
