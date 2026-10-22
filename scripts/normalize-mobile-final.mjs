import fs from 'node:fs';
const paths=['src/App.jsx','src/index.css','src/components/layout/AppLayout.jsx','src/components/layout/MobileNavigation.jsx','src/components/layout/PageTransition.jsx','src/components/ui/select.jsx','src/hooks/useMobileViewport.js','src/lib/nativeSelect.mjs','src/lib/navigationStack.mjs','src/lib/optimisticPreference.mjs','src/lib/PageNotFound.jsx','src/pages/Notificaciones.jsx','src/components/ajustes/TabNotificaciones.jsx','src/components/dashboard/SummaryCards.jsx','src/components/finance/cashflow/CashflowForecastChart.jsx','scripts/test-mobile-cache-render.mjs','scripts/test-mobile-ux-final.mjs','scripts/normalize-mobile-final.mjs'];
paths.push('src/lib/mobileNavigation.mjs');
paths.push('src/components/ui/toast.jsx');
paths.push('src/components/ui/MobileSelectPicker.jsx','src/components/ui/drawer.jsx','src/hooks/useAppGestures.js','src/lib/appGestures.mjs');
paths.push('src/hooks/useCloseOnNavigation.js','src/components/ui/dropdown-menu.jsx');
paths.push('src/hooks/useShellScrollLock.js','src/lib/notificationMutation.mjs','src/lib/notificationRead.mjs');
paths.push('scripts/test-mobile-cache-mutations.mjs');
paths.push('src/lib/copyTextPreference.mjs','src/hooks/useCopyTextPreference.js','src/components/layout/AppearanceSettings.jsx','src/lib/suggestionMutation.mjs','src/pages/BuzonSugerencias.jsx');
paths.push('src/components/layout/TopBar.jsx','scripts/test-mobile-safearea.mjs');
for(const path of paths){const before=fs.readFileSync(path,'utf8'),after=before.trimEnd()+'\n';if(after!==before)fs.writeFileSync(path,after);}
console.log('Task-only EOF normalisation complete.');
