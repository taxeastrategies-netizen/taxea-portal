import { Settings, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const INTEGRATIONS = [
  { name: 'Google Analytics', status: 'pendiente', data: 'Visitas, bounce rate, conversion, fuentes de trafico', category: 'Analitica' },
  { name: 'Google Search Console', status: 'pendiente', data: 'Keywords, posiciones, clics, impresiones organicas', category: 'SEO' },
  { name: 'Meta Ads', status: 'pendiente', data: 'Leads, CPL, ROAS, creatividades, audiencias', category: 'Publicidad' },
  { name: 'Google Ads', status: 'pendiente', data: 'Leads, CPC, CTR, conversion, palabras clave', category: 'Publicidad' },
  { name: 'TikTok Ads', status: 'pendiente', data: 'Impresiones, CPM, CPL, creatividades, audiencias', category: 'Publicidad' },
  { name: 'LinkedIn Ads', status: 'pendiente', data: 'Leads B2B, CPL, audiencias profesionales', category: 'Publicidad' },
  { name: 'Mailchimp', status: 'pendiente', data: 'Listas, aperturas, clics, conversiones, bajas', category: 'Email' },
  { name: 'Brevo', status: 'pendiente', data: 'Campanas email y SMS, automatizaciones, listas', category: 'Email' },
  { name: 'ActiveCampaign', status: 'pendiente', data: 'CRM ligero, automatizaciones, scoring de leads', category: 'Email' },
  { name: 'WhatsApp Business', status: 'pendiente', data: 'Mensajes enviados, tasa de respuesta, templates', category: 'Mensajeria' },
  { name: 'Calendly', status: 'pendiente', data: 'Citas agendadas, tasa de no-show, canal de origen', category: 'Captacion' },
  { name: 'Stripe', status: 'pendiente', data: 'MRR, churn, ARR, plan por cliente, pagos', category: 'Revenue' },
  { name: 'Metricool', status: 'pendiente', data: 'Redes sociales, engagement, alcance, publicaciones', category: 'Social' },
  { name: 'Shopify', status: 'pendiente', data: 'Ventas, productos, clientes, conversion, ticket medio', category: 'Ecommerce' },
  { name: 'Zapier', status: 'pendiente', data: 'Automatizaciones cross-platform y webhooks', category: 'Automatizacion' },
  { name: 'Make', status: 'pendiente', data: 'Flujos de automatizacion avanzados y conectores', category: 'Automatizacion' },
];

const CATEGORY_COLORS = {
  Analitica: 'bg-blue-50 text-blue-700', SEO: 'bg-emerald-50 text-emerald-700',
  Publicidad: 'bg-orange-50 text-orange-700', Email: 'bg-purple-50 text-purple-700',
  Mensajeria: 'bg-green-50 text-green-700', Captacion: 'bg-cyan-50 text-cyan-700',
  Revenue: 'bg-indigo-50 text-indigo-700', Social: 'bg-pink-50 text-pink-700',
  Ecommerce: 'bg-amber-50 text-amber-700', Automatizacion: 'bg-slate-50 text-slate-700',
};

export default function GrowthSettings() {
  const categories = [...new Set(INTEGRATIONS.map(i => i.category))];

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-xl font-bold font-jakarta">Configuracion de Growth</h1><p className="text-sm text-muted-foreground">Integraciones con plataformas externas para conectar tus datos de marketing</p></div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Integraciones en preparacion</p>
          <p className="text-sm text-amber-700 mt-1">Las conexiones directas con plataformas externas estaran disponibles en la proxima fase. La arquitectura ya esta preparada. Por ahora, los datos se pueden introducir manualmente o importar desde los paneles de campanas y analitica.</p>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{cat}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INTEGRATIONS.filter(i => i.category === cat).map(integration => (
              <div key={integration.name} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{integration.name}</p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', CATEGORY_COLORS[integration.category])}>{integration.category}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-xs text-muted-foreground">No conectado</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{integration.data}</p>
                <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1.5" disabled>
                  <Clock className="w-3 h-3" />Preparar conexion
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}