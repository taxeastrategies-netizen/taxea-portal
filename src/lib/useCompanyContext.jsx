import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// Roles con acceso administrativo completo
export const ADMIN_ROLES = ['admin', 'super_admin', 'advisor'];
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

// Cache simple en memoria para evitar re-fetches innecesarios
const companyCache = new Map();

export function useCompanyContext(user) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCompany = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const cacheKey = user.email;
    if (companyCache.has(cacheKey)) {
      setCompany(companyCache.get(cacheKey));
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      if (isAdminRole(user.role)) {
        // Admin: carga diferida — no bloquear el layout inicial
        setLoading(false); // render inmediato
        const all = await base44.entities.Company.list('-created_date', 1);
        const c = all?.[0] || null;
        companyCache.set(cacheKey, c);
        setCompany(c);
      } else {
        // Cliente: buscar empresa propia
        const own = await base44.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
        if (own?.length > 0) {
          companyCache.set(cacheKey, own[0]);
          setCompany(own[0]);
          setLoading(false);
          return;
        }
        // Fallback: empresa donde está como autorizado (solo si no encontró la propia)
        const all = await base44.entities.Company.list('-created_date', 50);
        const found = all?.find(c => c.usuarios_autorizados?.includes(user.email)) || null;
        companyCache.set(cacheKey, found);
        setCompany(found);
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [user?.email, user?.role]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  const refreshCompany = () => {
    if (user?.email) companyCache.delete(user.email);
    loadCompany();
  };

  return { company, setCompany, loadingCompany: loading, refreshCompany };
}