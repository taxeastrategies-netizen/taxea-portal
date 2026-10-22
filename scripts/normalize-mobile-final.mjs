import fs from 'node:fs';
const paths=['src/App.jsx','src/index.css','src/components/layout/AppLayout.jsx','src/components/layout/MobileNavigation.jsx','src/components/layout/PageTransition.jsx','src/components/ui/select.jsx','src/hooks/useMobileViewport.js','src/lib/nativeSelect.mjs','src/lib/navigationStack.mjs','src/lib/optimisticPreference.mjs','src/lib/PageNotFound.jsx','src/pages/Notificaciones.jsx','src/components/ajustes/TabNotificaciones.jsx','src/components/dashboard/SummaryCards.jsx','src/components/finance/cashflow/CashflowForecastChart.jsx','scripts/test-mobile-cache-render.mjs','scripts/test-mobile-ux-final.mjs','scripts/normalize-mobile-final.mjs'];
paths.push('src/lib/mobileNavigation.mjs');
paths.push('src/components/ui/toast.jsx');
for(const path of paths){const before=fs.readFileSync(path,'utf8'),after=before.trimEnd()+'\n';if(after!==before)fs.writeFileSync(path,after);}
console.log('Task-only EOF normalisation complete.');
