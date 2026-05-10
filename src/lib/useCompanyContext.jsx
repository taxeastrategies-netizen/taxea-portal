import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useCompanyContext(user) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadCompany();
  }, [user?.email]);

  const loadCompany = async () => {
    setLoading(true);
    const isAdmin = user?.role === 'admin';
    if (isAdmin) {
      // Admin gets first company or null
      const all = await base44.entities.Company.list('-created_date', 1);
      setCompany(all?.[0] || null);
    } else {
      // Client gets their own company
      const own = await base44.entities.Company.filter({ owner_email: user.email });
      if (own?.length > 0) {
        setCompany(own[0]);
      } else {
        // Also check usuarios_autorizados
        const all = await base44.entities.Company.list();
        const found = all?.find(c => c.usuarios_autorizados?.includes(user.email));
        setCompany(found || null);
      }
    }
    setLoading(false);
  };

  return { company, setCompany, loadingCompany: loading };
}