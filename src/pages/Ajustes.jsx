import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Building2, Shield, Users, CheckSquare, Bell, User, Landmark } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import TabEmpresa from '@/components/ajustes/TabEmpresa';
import TabSeguridad from '@/components/ajustes/TabSeguridad';
import TabAfiliados from '@/components/ajustes/TabAfiliados';
import TabOnboarding from '@/components/ajustes/TabOnboarding';
import TabNotificaciones from '@/components/ajustes/TabNotificaciones';
import TabFiscal from '@/components/ajustes/TabFiscal';

const TABS = [
  { id: 'empresa',        label: 'Empresa',        icon: Building2 },
  { id: 'fiscal',         label: 'Fiscalidad',     icon: Landmark },
  { id: 'onboarding',     label: 'Primeros pasos', icon: CheckSquare },
  { id: 'seguridad',      label: 'Seguridad',      icon: Shield },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { id: 'afiliados',      label: 'Referidos',      icon: Users },
];

export default function Ajustes() {
  const { company, user, isAdmin, refreshCompany } = useOutletContext() || {};
  const [activeTab, setActiveTab] = useState('empresa');

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Configuración de empresa, seguridad y preferencias" />

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap mb-6 bg-secondary/40 border border-border rounded-xl p-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === t.id
                  ? 'bg-card text-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {activeTab === 'empresa'        && <TabEmpresa company={company} user={user} refreshCompany={refreshCompany} />}
          {activeTab === 'fiscal'         && <TabFiscal />}
          {activeTab === 'seguridad'      && <TabSeguridad user={user} />}
          {activeTab === 'afiliados'      && <TabAfiliados user={user} />}
          {activeTab === 'onboarding'     && <TabOnboarding company={company} />}
          {activeTab === 'notificaciones' && <TabNotificaciones user={user} />}
        </div>

        {/* Panel derecho — perfil */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-teal" />
              </div>
              <h3 className="font-jakarta font-semibold text-foreground text-sm">Mi perfil</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Nombre</p>
                <p className="text-sm font-medium text-foreground">{user?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm text-foreground">{user?.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rol</p>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${isAdmin ? 'bg-gold-light text-yellow-700' : 'bg-teal-light text-teal'}`}>
                  {isAdmin ? 'Administrador' : 'Cliente'}
                </span>
              </div>
              {company && (
                <div>
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="text-sm text-foreground">{company.razon_social}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-teal/5 border border-teal/20 rounded-xl p-5">
            <p className="text-sm font-medium text-teal mb-1">¿Necesitas ayuda?</p>
            <p className="text-xs text-muted-foreground">
              Tu asesor de Taxea Strategies está disponible para cualquier duda fiscal o contable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}