import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { getImpersonation } from '@/lib/impersonation';

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
        // Admin: check if impersonating a client
        const imp = getImpersonation();
        setLoading(false); // render inmediato
        if (imp?.clientEmail) {
          const own = await base44.entities.Company.filter({ owner_email: imp.clientEmail }, '-created_date', 1);
          const c = own?.[0] || null;
          setCompany(c);
        } else {
          const all = await base44.entities.Company.list('-created_date', 1);
          const c = all?.[0] || null;
          companyCache.set(cacheKey, c);
          setCompany(c);
        }
      } else {
        // Cliente: buscar empresa propia
        const own = await base44.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
        if (own?.length > 0) {
          const c = own[0];
          // Sincronizar company_id en el usuario si no coincide (invalida caché servidor)
          if (user.data?.company_id !== c.id) {
            try { await base44.auth.updateMe({ company_id: c.id }); } catch {}
          }
          companyCache.set(cacheKey, c);
          setCompany(c);
          setLoading(false);
          return;
        }
        // Fallback: empresa donde está como autorizado (solo si no encontró la propia)
        const all = await base44.entities.Company.list('-created_date', 50);
        const found = all?.find(c => c.usuarios_autorizados?.includes(user.email)) || null;
        if (found && user.data?.company_id !== found.id) {
          try { await base44.auth.updateMe({ company_id: found.id }); } catch {}
        }
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
    // Small delay to allow the DB write to propagate
    setTimeout(() => loadCompany(), 300);
  };

  return { company, setCompany, loadingCompany: loading, refreshCompany };
}