import fs from 'node:fs/promises';
import * as esbuild from 'esbuild';
const destination='public/__qa_mobile_resume';
const contacts=[{id:'qa-one',nombre:'PERSONA FICTICIA',clase_contacto:'persona',tipo:'cliente',nif_cif:'QA-NO-REAL',email:'persona@example.invalid',telefono:'000000',direccion_fiscal:'Dirección solo para pruebas',pais:'España'}, {id:'qa-two',nombre:'SOCIEDAD FICTICIA CON NOMBRE LARGO '.repeat(5),tipo:'proveedor',clase_contacto:'empresa',emails:['proveedor@example.invalid'],telefonos:['000001'],direccion_fiscal:'Dirección de pruebas '.repeat(18),pais:'España',fuentes:['ocr']}, {id:'qa-three',nombre:'OTRO CONTACTO FICTICIO',clase_contacto:'empresa',tipo:'ambos',pais:'España',activo:true}];
const imports=[{id:'qa-import-one',nombre_archivo:'BALANCE FICTICIO — '.repeat(8)+'.xlsx',estado:'pendiente_revision',calidad_dato:'alta',origen:'excel_balance',empresa_nombre:'EMPRESA FICTICIA',total_lineas:10,periodo_inicio:'2026-01-01'}, {id:'qa-import-two',nombre_archivo:'Informe solo de prueba.pdf',estado:'informe_generado',calidad_dato:'media',origen:'pdf_balance',total_lineas:5}];
const documents=[{id:'qa-file-one',company_id:'qa-only',nombre:'Factura ficticia solo QA.pdf',estado:'pendiente',carpeta:'facturas_recibidas',tipo_archivo:'pdf'}, {id:'qa-file-two',company_id:'qa-only',nombre:'Archivo ficticio largo '.repeat(7)+'.pdf',estado:'revisado',carpeta:'otros'}];
const api='export const qaNetwork={failNext:false,release:null};let documents='+JSON.stringify(documents)+';export const base44={auth:{logout(){throw Error("QA no logout");}},functions:{invoke:async(name)=>{if(name==="getCompanyContacts")return {data:{contacts:'+JSON.stringify(contacts)+'}};if(name==="syncInvoiceContacts")return {data:{success:true}};throw Error("Unexpected mock operation: "+name);}},entities:{AccountingImport:{filter:async()=>'+JSON.stringify(imports)+'},Document:{filter:async()=>documents.map(doc=>({...doc})),update:async(id,patch)=>{const fail=qaNetwork.failNext;qaNetwork.failNext=false;await new Promise(resolve=>{qaNetwork.release=resolve;});qaNetwork.release=null;if(fail)throw Error("Fallo de red QA simulado");documents=documents.map(doc=>doc.id===id?{...doc,...patch}:doc);return documents.find(doc=>doc.id===id);}}}};';
await fs.mkdir(destination,{recursive:true});
await esbuild.build({entryPoints:['scripts/mobile-resume-fixture.jsx'],bundle:true,format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'inert-api',setup(build){
  build.onResolve({filter:/^@\/api\/base44Client$/},()=>({path:'api',namespace:'qa'}));
  build.onResolve({filter:/OcrTopBarBadge$/},()=>({path:'badge',namespace:'qa'}));
  build.onResolve({filter:/^\.\//},args=>args.importer.endsWith('/analysis/AnalysisHome.jsx')?{path:'analysis-child',namespace:'qa'}:undefined);
  build.onLoad({filter:/.*/,namespace:'qa'},args=>({contents:args.path==='api'?api:'export default function Stub(){return null;}',loader:'js'}));
}}],alias:{'@':process.cwd()+'/src'},outfile:destination+'/controls.js'});
const css=(await fs.readdir('dist/assets')).find(file=>file.startsWith('index-')&&file.endsWith('.css'));
if(!css)throw Error('Build CSS missing');
await fs.copyFile('dist/assets/'+css,destination+'/controls.css');
console.log('Disposable mobile harness: actual Contactos/AnalysisHome/Header with mock API. No real writes.');

