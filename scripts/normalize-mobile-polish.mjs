import fs from 'node:fs';
const paths=['index.html','src/index.css','src/components/layout/AppLayout.jsx','src/components/layout/TopBar.jsx','src/components/layout/MobileNavigation.jsx','src/components/FloatingActions.jsx','src/components/ui/dialog.jsx','src/components/ui/select.jsx','src/components/ui/dropdown-menu.jsx','src/hooks/useSafeAreaCollision.js','src/lib/safeArea.mjs','src/lib/notificationRead.mjs','src/pages/Notificaciones.jsx','scripts/test-mobile-cache-render.mjs','scripts/test-mobile-safearea.mjs','scripts/normalize-mobile-polish.mjs'];
paths.push('src/lib/mobileNavigation.mjs');
for(const path of paths){const before=fs.readFileSync(path,'utf8'),after=before.trimEnd()+'\n';if(after!==before)fs.writeFileSync(path,after);}
console.log('Task-only EOF normalisation complete.');

