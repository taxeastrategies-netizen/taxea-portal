export const MOBILE_TABS = [
  {id:'home',to:'/',label:'Inicio'},
  {id:'invoices',to:'/tax-accounting/facturas',label:'Facturas'},
  {id:'scan',to:'/tax-accounting/lector-gastos',label:'Escanear'},
  {id:'documents',to:'/documentos',label:'Docs'},
  {id:'settings',to:'/ajustes',label:'Ajustes'},
];
export function mobileTabId(pathname='') {
  if(pathname==='/')return 'home';
  if(['/facturas','/tax-accounting/facturas'].includes(pathname))return 'invoices';
  if(['/lector-gastos','/lector-ingresos','/tax-accounting/lector-gastos','/tax-accounting/lector-ingresos'].includes(pathname))return 'scan';
  if(pathname==='/documentos'||pathname.startsWith('/documentos/'))return 'documents';
  if(pathname==='/ajustes'||pathname.startsWith('/ajustes/'))return 'settings';
  return null;
}
export function internalHref(location) {
  const pathname=String(location?.pathname||'/');
  if(!pathname.startsWith('/')||pathname.startsWith('//')||/[\\\u0000-\u001f]/.test(pathname))return '/';
  return pathname+String(location?.search||'')+String(location?.hash||'');
}
export function parentRoute(pathname) {
  if(pathname.startsWith('/herramientas/'))return '/herramientas';
  for(const root of ['/tax-accounting','/finance','/people']) {
    if(pathname.startsWith(root+'/')&&!pathname.endsWith('/dashboard'))return root+'/dashboard';
  }
  if(pathname.startsWith('/admin/'))return '/admin/users';
  return '/';
}
export function pullGesture(start,x,y,{nestedScroll=false,touches=1}={}) {
  if(!start||touches!==1||nestedScroll)return {cancelled:true,distance:0,armed:false};
  const dx=x-start.x,dy=y-start.y;
  if(dy<0||Math.abs(dx)>Math.max(16,Math.abs(dy)*0.8))return {cancelled:true,distance:0,armed:false};
  const distance=Math.min(88,Math.max(0,dy)*0.48);
  return {cancelled:false,distance,armed:distance>=58};
}
