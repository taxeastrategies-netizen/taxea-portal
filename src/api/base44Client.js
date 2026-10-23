import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { forgetSessionIdentity } from '@/lib/sessionSecurity.mjs';

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
    if (property === 'InvokeLLM') {
      return async (params) => {
        const response = await sdkBase44.functions.invoke('invokeLimitedLLM', params);
        const payload = response?.data ?? response;
        if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'result')) {
          throw new Error(payload?.error || 'No se pudo completar la solicitud de IA');
        }
        return payload.result;
      };
    }
    if (property === 'ExtractDataFromUploadedFile' || property === 'SendEmail') {
      return async (params) => {
        const response = await sdkBase44.functions.invoke('limitedCoreOperations', params);
        const payload = response?.data ?? response;
        if (!payload?.ok || !Object.prototype.hasOwnProperty.call(payload, 'result')) {
          throw new Error(payload?.error || 'No se pudo completar la operación');
        }
        return payload.result;
      };
    }
    return Reflect.get(target, property, receiver);
  }
});

const limitedIntegrations = new Proxy(sdkBase44.integrations, {
  get(target, property, receiver) {
    if (property === 'Core') return limitedCore;
    return Reflect.get(target, property, receiver);
  }
});

// Every logout entry point (TopBar, account settings, suspension) clears memory.
const sessionAuth = new Proxy(sdkBase44.auth, {
  get(target, property, receiver) {
    if (property === 'logout') return (...args) => {
      forgetSessionIdentity();
      return target.logout(...args);
    };
    return Reflect.get(target, property, receiver);
  }
});

// Los servicios que consumen créditos se invocan explícitamente en el backend.
export const base44 = new Proxy(sdkBase44, {
  get(target, property, receiver) {
    if (property === 'auth') return sessionAuth;
    if (property === 'integrations') return limitedIntegrations;
    if (property === 'controlledCore') return limitedCore;
    return Reflect.get(target, property, receiver);
  }
});
