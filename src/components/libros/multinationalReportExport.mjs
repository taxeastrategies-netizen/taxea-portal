const COVER='https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3c1e36878_8173573b-a68e-4e0e-a289-2db84b51dff4.png';
const num=v=>v==null?'Sin datos':Number(v).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
export const safeCell=v=>typeof v==='string'&&/^[\s\u0000-\u001f]*[=+@-]/.test(v)?"'"+v:v??'';
const fileName=r=>`Taxea_Multinational_Report_${String(r.companyName).replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,70)}_${r.window.start}_${r.window.end}`;
export function reportSheets(r){
  const p=r.pnl,has=p.available;
  const metadata=[['TAXEA STRATEGIES','MULTINATIONAL REPORT'],['Empresa',r.companyName],['Empresa ID',r.companyId],['Período',r.window.start+' / '+r.window.end],['Generado',r.generatedAt],['Moneda','EUR'],['Segmento P&L',r.segment],['Alcance',r.methodology.scope]];
  const rows=(items,keys)=>items.map(row=>keys.map(key=>row[key]??''));
  const notes=[...Object.entries(r.methodology).filter(([,v])=>typeof v==='string').map(([k,v])=>[k,v]),...r.methodology.references.map(ref=>[ref.label,ref.url])];
  return [
    ['Resumen',[...metadata,[],['Indicador','Importe EUR'],['Cifra de negocios',has?p.revenue:null],['EBITDA',has?p.ebitda:null],['EBIT',has?p.ebit:null],['Resultado',has?p.netResult:null],['Activo',r.balance.available?r.balance.totalAssets:null],['Pasivo',r.balance.available?r.balance.totalLiabilities:null],['Patrimonio neto',r.balance.available?r.balance.totalEquity:null],['Saldo bancario actual',r.bank.known?r.bank.cash:null],['Flujo bancario observado',r.cashflow.known?r.cashflow.net:null],['Pendiente cobro actual',r.workingCapital.receivable],['Pendiente pago actual',r.workingCapital.payable],[],['Asientos excluidos',r.quality.excluded],['Apertura',r.balance.openingNotice||'Registrada'],['Avisos banco',r.bank.reasons.join(' ')]]],
    ['PyG',[['Partida',String(r.window.year),String(r.window.year-1)],...p.groups.map(g=>[g.label,has?g.amount:null,p.previous.available?p.previous.groups.find(a=>a.key===g.key)?.amount:null]),['RESULTADO',has?p.netResult:null,p.previous.available?p.previous.netResult:null],[],['CONCILIACIÓN EBITDA','Importe EUR'],['Resultado neto',has?p.netResult:null],['+ Impuesto beneficios',has?p.incomeTax:null],['- Resultado financiero',has?p.financeResult:null],['+ Amortización',has?p.depreciation:null],['= EBITDA',has?p.ebitda:null]]],
    ['Balance',[['Bloque','Sección','Cuenta','Nombre','Debe','Haber','Saldo presentado'],...[['Activo',r.balance.assets],['Pasivo',r.balance.liabilities],['Patrimonio',r.balance.equity]].flatMap(([label,arr])=>arr.map(a=>[label,a.section.label,a.code,a.name,a.debit,a.credit,a.amount])),['Patrimonio','Resultado del ejercicio','','','','',r.balance.available?r.balance.result:null],[],['Diferencia de balance',r.balance.available?r.balance.difference:null],['Fecha',r.balance.asOf],['Cobertura',r.balance.openingNotice||'Apertura registrada']]],
    ['Mensual',[['Mes','Cifra negocios','EBITDA','Margen EBITDA %','EBIT','Resultado','Ventas año previo','Ingresos documentales','Costes documentales','Entradas banco','Salidas banco','Neto banco'],...r.monthly.map(m=>[m.month,m.count?m.revenue:null,m.count?m.ebitda:null,m.count?m.ebitdaMargin:null,m.count?m.ebit:null,m.count?m.netResult:null,m.previousKnown?m.previousRevenue:null,m.management.revenue,m.management.costs,r.cashflow.known?m.cash.inflows:null,r.cashflow.known?m.cash.outflows:null,r.cashflow.known?m.cash.net:null])]],
    ['Negocio',[['Dimensión','Ventas','EBITDA','Margen %','Resultado'],...rows(r.segments,['label','revenue','ebitda','ebitdaMargin','netResult'])]],
    ['Cash flow',[['Clasificación','Entradas','Salidas','Neto'],...rows(r.cashflow.groups,['label','inflows','outflows','net']),[],['Fecha','Concepto','Clasificación','Importe','Movimiento ID','Asiento ID'],...rows(r.cashflow.rows,['date','description','classification','amount','id','journalId']),[],['Metodología',r.methodology.cashflow]]],
    ['Vencimientos',[['Estado actual',r.workingCapital.asOf],['Antigüedad','A cobrar','A pagar'],...rows(r.workingCapital.bands,['label','receivable','payable']),[],['Factura','Fecha','Vencimiento','Tercero','Pendiente','Tipo','Factura ID'],...rows(r.workingCapital.rows,['number','date','due','party','pending','direction','id'])]],
    ['Clientes',[['Cliente','Base','Documentos'],...rows(r.customers.rows,['name','base','count'])]],
    ['Proveedores',[['Proveedor','Base','Documentos'],...rows(r.suppliers.rows,['name','base','count'])]],
    ['Fiscal',[['Concepto','Importe / cantidad'],['Cuotas repercutidas',r.fiscal.taxCharged],['Cuotas soportadas',r.fiscal.taxSupported],['Deducción informada',r.fiscal.deductibleConfirmed],['Documentos sin deducción informada',r.fiscal.deductibilityMissing],['No deducible registrado',r.fiscal.nonDeductible],['Retenido por clientes',r.fiscal.retainedByClients],['Retenido a proveedores',r.fiscal.withheldToPay],['Metodología',r.methodology.fiscal]]],
    ['Origen resultados',[['Fecha','Asiento','Cuenta','Nombre cuenta','Descripción','Debe','Haber','Documento ID','Dimensión','Asiento ID'],...rows(r.sources.journal,['date','number','account','accountName','description','debit','credit','documentId','segment','entryId'])]],
    ['Origen balance',[['Fecha','Asiento','Cuenta','Nombre cuenta','Descripción','Debe','Haber','Asiento ID'],...rows(r.balance.rows,['date','number','account','accountName','description','debit','credit','entryId'])]],
    ['Origen documentos',[['Fecha','Documento','Tercero','Descripción','Tipo','Base','Cuota','Retención','Total','Fuente','Documento ID','Asiento ID'],...rows(r.sources.documents,['date','number','party','description','direction','base','tax','retention','total','source','id','journalId'])]],
    ['Configuración fiscal',[['Territorio',r.fiscal.profile?.territory||'Sin informar'],['Estado',r.fiscal.profile?.status||'Sin informar'],[],['Actividad','IAE','Impuesto','Régimen','Deducción'],...rows(r.fiscal.activities||[],['name','iae','tax','regime','deduction']),[],['Modelo','Nombre','Administración','Frecuencia','Validación'],...rows(r.fiscal.obligations||[],['code','name','authority','frequency','validation']),[],['Modelo','Período','Estado','Resultado','Importe confirmado'],...rows(r.fiscal.periods||[],['code','period','status','result','confirmed'])]],
    ['Control',[['Métrica','Valor'],...Object.entries(r.quality).map(([k,v])=>[k,v]),[],['Fecha','Asiento','Motivo','ID'],...rows(r.sources.excluded,['date','number','reason','id'])]],
    ['Metodología',[['Apartado','Definición / referencia'],...notes]],
  ].map(([name,data])=>[name,data.map(row=>row.map(safeCell))]);
}
export async function makeReportWorkbook(r){
  const XLSX=await import('xlsx'),wb=XLSX.utils.book_new();
  wb.Props={Title:'Taxea Multinational Report',Subject:r.companyName,Author:'Taxea Strategies',CreatedDate:new Date(r.generatedAt)};
  for(const [name,data] of reportSheets(r)){
    const ws=XLSX.utils.aoa_to_sheet(data);
    const count=Math.max(1,...data.map(row=>row.length));
    ws['!cols']=Array.from({length:count},(_,i)=>({wch:Math.min(64,Math.max(14,...data.slice(0,150).map(row=>String(row[i]??'').length+2)))}));
    if(data.length&&data[0].length>2)ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:data.length-1,c:count-1}})};
    for(const key of Object.keys(ws)){if(ws[key]?.t==='n')ws[key].z='0.00;[Red]-0.00';}
    XLSX.utils.book_append_sheet(wb,ws,name);
  }
  return {wb,XLSX};
}
export async function downloadReportExcel(r){const {wb,XLSX}=await makeReportWorkbook(r);XLSX.writeFile(wb,fileName(r)+'.xlsx',{compression:true});}

export async function makeReportPDF(r,{coverData}={}){
  const {jsPDF}=await import('jspdf');const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const W=210,H=297,margin=17,width=W-2*margin;let y=0;
  const plain=value=>String(value??'—').replace(/[–—]/g,'-').replace(/×/g,'x').replace(/↗/g,'').replace(/\u202f/g,' ');
  const text=(value,x,yy,size=9,color=[37,44,62],font='normal',options={})=>{pdf.setFont('helvetica',font);pdf.setFontSize(size);pdf.setTextColor(...color);pdf.text(plain(value),x,yy,options);};
  const line=(yy)=>{pdf.setDrawColor(225,227,232);pdf.line(margin,yy,W-margin,yy);};
  const heading=(title,sub)=>{text('TAXEA STRATEGIES / MULTINATIONAL REPORT',margin,17,7,[151,43,61],'bold');text(title,margin,31,21,[37,44,62],'bold');if(sub)text(sub,margin,39,8,[103,112,130]);line(46);y=55;};
  const newPage=(title,sub)=>{pdf.addPage();heading(title,sub);};
  const fit=(height)=>{if(y+height>H-23){newPage('Continuación',r.companyName+' · '+r.window.start+' / '+r.window.end);}};
  const paragraph=(body)=>{const lines=pdf.splitTextToSize(plain(body),width);for(const l of lines){fit(5);text(l,margin,y,8,[103,112,130]);y+=4.5;}y+=5;};
  const section=(title)=>{fit(18);text(title,margin,y,12,[37,44,62],'bold');y+=9;};
  const table=(headers,rows,widths)=>{
    const head=()=>{pdf.setFillColor(242,243,246);pdf.rect(margin,y-5,width,8,'F');let x=margin+2;headers.forEach((h,i)=>{text(h,x,y,7,[103,112,130],'bold');x+=widths[i];});y+=9;};
    fit(20);head();
    for(const row of rows){const wrapped=row.map((v,i)=>pdf.splitTextToSize(plain(v),widths[i]-4));const height=Math.max(7,...wrapped.map(a=>a.length*4+3));if(y+height>H-24){newPage('Continuación',r.companyName);head();}
      let x=margin+2;wrapped.forEach((a,i)=>{text(a,x,y,8,[37,44,62],'normal');x+=widths[i];});y+=height;line(y-3);
    }y+=6;
  };
  const metric=(label,value,x,yy)=>{text(label,x,yy,8,[103,112,130]);text(value==null?'Sin datos':num(value)+' EUR',x,yy+12,19,[37,44,62],'bold');};
  // Branding asset only. Financial data never leaves the browser.
  let cover=coverData;
  if(!cover&&typeof Image!=='undefined')try{cover=await new Promise((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);resolve(canvas.toDataURL('image/jpeg',.92));};image.onerror=reject;image.src=COVER;setTimeout(()=>reject(Error('Imagen no disponible')),8000);});}catch{/* Text identity remains if the branding CDN is offline. */}
  if(cover)pdf.addImage(cover,'JPEG',0,0,210,70);
  else{text('TAXEA',margin,30,28,[37,44,62],'bold');text('STRATEGIES',margin,41,12,[183,31,53]);}
  text('FINANCIAL INTELLIGENCE',margin,88,9,[183,31,53],'bold');
  text('Multinational',margin,111,35,[37,44,62],'bold');text('Report.',margin,126,35,[183,31,53],'bold');
  const companyLines=pdf.splitTextToSize(plain(r.companyName),width);text(companyLines,margin,146,15,[37,44,62],'bold');
  const periodY=150+companyLines.length*6;text(r.window.start+' / '+r.window.end,margin,periodY,10,[103,112,130]);
  line(periodY+10);
  metric('Cifra de negocios',r.pnl.available?r.pnl.revenue:null,margin,periodY+25);metric('EBITDA',r.pnl.available?r.pnl.ebitda:null,112,periodY+25);
  metric('Resultado del período',r.pnl.available?r.pnl.netResult:null,margin,periodY+59);metric('Liquidez bancaria actual',r.bank.known?r.bank.cash:null,112,periodY+59);
  y=periodY+86;paragraph('Informe de gestión de una empresa. Datos contables, documentales y bancarios presentados por separado, con sus criterios y cobertura. Moneda EUR. Segmento P&L: '+r.segment+'.');
  newPage('Visión ejecutiva','Cobertura de datos y evolución del período');
  table(['Fuente','Cobertura'],[['Contabilidad',r.quality.confirmed+' asientos confirmados válidos; '+r.quality.excluded+' excluidos.'],['Facturación',r.quality.documentCount+' documentos del período; '+r.quality.linkedDocuments+' vinculados a asiento.'],['Banco',r.bank.connected+' cuentas EUR; '+r.cashflow.count+' movimientos observados.'],['Apertura',r.balance.openingNotice||'Asiento de apertura registrado.'],['Banco · avisos',r.bank.reasons.join(' ')||'Sin avisos de saldo actual.']],[45,131]);
  section('Ingresos y EBITDA por mes');
  const chartY=y+5,chartHeight=48,baseline=chartY+chartHeight;
  const max=Math.max(1,...r.monthly.flatMap(m=>[Math.abs(m.revenue),Math.abs(m.ebitda)]));
  const step=width/Math.max(1,r.monthly.length),zero=chartY+chartHeight*.65;
  pdf.setDrawColor(220,224,230);pdf.line(margin,zero,W-margin,zero);
  for(let i=0;i<r.monthly.length;i++){const m=r.monthly[i],x=margin+i*step+2;for(const [j,val] of [m.revenue,m.ebitda].entries()){if(!m.count)continue;const h=val/max*chartHeight*.6;pdf.setFillColor(...(j===0?[183,31,53]:[55,70,94]));pdf.rect(x+j*step*.32,h>=0?zero-h:zero,step*.25,Math.abs(h),'F');}text(m.label,x,baseline+6,7,[103,112,130]);}
  y=baseline+18;paragraph('Rojo: cifra de negocios. Azul: EBITDA. Meses sin asientos: sin dato. EBITDA es un indicador de gestión; definición y conciliación en las páginas siguientes.');
  newPage('Cuenta de resultados','Comparativo del mismo período · importes EUR');
  table(['Partida',String(r.window.year),String(r.window.year-1)],r.pnl.groups.map(g=>[g.label,r.pnl.available?num(g.amount):'Sin datos',r.pnl.previous.available?num(r.pnl.previous.groups.find(a=>a.key===g.key)?.amount):'Sin datos']),[100,38,38]);
  table(['Conciliación EBITDA','EUR'],[['Resultado neto',r.pnl.available?num(r.pnl.netResult):'Sin datos'],['+ Impuesto sobre beneficios',r.pnl.available?num(r.pnl.incomeTax):'Sin datos'],['- Resultado financiero',r.pnl.available?num(r.pnl.financeResult):'Sin datos'],['+ Amortización',r.pnl.available?num(r.pnl.depreciation):'Sin datos'],['= EBITDA',r.pnl.available?num(r.pnl.ebitda):'Sin datos']],[125,51]);
  paragraph(r.methodology.ebitda);
  newPage('Balance de situación','Toda la empresa · al '+r.balance.asOf);
  if(r.balance.openingNotice)paragraph(r.balance.openingNotice);
  for(const [title,groups] of [['Activo',r.balance.assetSections],['Patrimonio neto',r.balance.equitySections],['Pasivo',r.balance.liabilitySections]]){section(title);table(['Sección / cuenta','EUR'],groups.flatMap(g=>[[g.label,num(g.amount)],...g.accounts.map(a=>[a.code+' · '+a.name,num(a.amount)])]),[132,44]);}
  table(['Resumen','EUR'],[['Activo',r.balance.available?num(r.balance.totalAssets):'Sin datos'],['Patrimonio neto (incluido resultado)',r.balance.available?num(r.balance.totalEquity):'Sin datos'],['Pasivo',r.balance.available?num(r.balance.totalLiabilities):'Sin datos'],['Diferencia',r.balance.available?num(r.balance.difference):'Sin datos']],[132,44]);
  newPage('Cash flow y vencimientos','Flujos del período y cartera pendiente actual');
  table(['Actividad','Entradas','Salidas','Neto'],r.cashflow.groups.map(g=>[g.label,num(g.inflows),num(g.outflows),num(g.net)]),[62,38,38,38]);paragraph(r.methodology.cashflow);
  section('Antigüedad de saldos · estado actual a '+r.workingCapital.asOf);
  table(['Vencimiento','A cobrar','A pagar'],r.workingCapital.bands.map(b=>[b.label,num(b.receivable),num(b.payable)]),[100,38,38]);paragraph(r.methodology.aging);
  newPage('Negocio y cartera','Dimensiones contables y actividad documental');
  table(['Dimensión','Ventas','EBITDA','Resultado'],r.segments.map(s=>[s.label,num(s.revenue),num(s.ebitda),num(s.netResult)]),[68,36,36,36]);paragraph(r.methodology.segments);
  section('Principales clientes · bases del período');table(['Cliente','Base EUR','Documentos'],r.customers.rows.slice(0,15).map(c=>[c.name,num(c.base),c.count]),[112,40,24]);
  section('Principales proveedores · bases del período');table(['Proveedor','Base EUR','Documentos'],r.suppliers.rows.slice(0,15).map(c=>[c.name,num(c.base),c.count]),[112,40,24]);paragraph('El Excel contiene el detalle completo de clientes, proveedores, documentos y líneas de origen.');
  newPage('Fiscalidad y control','Importes registrados · no constituye una autoliquidación');
  table(['Concepto','EUR'],[['IVA / IGIC repercutido',num(r.fiscal.taxCharged)],['IVA / IGIC soportado',num(r.fiscal.taxSupported)],['Deducción expresamente informada',num(r.fiscal.deductibleConfirmed)],['Impuesto no deducible registrado',num(r.fiscal.nonDeductible)],['Retenciones de clientes',num(r.fiscal.retainedByClients)],['Retenciones a proveedores',num(r.fiscal.withheldToPay)]],[132,44]);paragraph(r.methodology.fiscal);
  table(['Configuración fiscal',[['Territorio',r.fiscal.profile?.territory||'Sin informar'],['Estado',r.fiscal.profile?.status||'Sin informar'],[],['Actividad','IAE','Impuesto','Régimen','Deducción'],...rows(r.fiscal.activities||[],['name','iae','tax','regime','deduction']),[],['Modelo','Nombre','Administración','Frecuencia','Validación'],...rows(r.fiscal.obligations||[],['code','name','authority','frequency','validation']),[],['Modelo','Período','Estado','Resultado','Importe confirmado'],...rows(r.fiscal.periods||[],['code','period','status','result','confirmed'])]],
    ['Control','Estado'],[['Documentos sin deducción informada',r.fiscal.deductibilityMissing],['Asientos pendientes del ejercicio',r.quality.pending],['Asientos excluidos',r.quality.excluded],['Documentos sin conversión EUR',r.quality.fxExcluded],['Duplicados de proyecciones omitidos',r.quality.suppressedDuplicates]],[132,44]);
  newPage('Metodología y fuentes','Definiciones, alcance y trazabilidad');
  for(const [key,value] of Object.entries(r.methodology)){if(typeof value!=='string')continue;section(({pnl:'Resultados',ebitda:'EBITDA',balance:'Balance',cashflow:'Cash flow',management:'Facturación',aging:'Vencimientos',segments:'Negocio',fiscal:'Fiscalidad',scope:'Alcance'})[key]||key);paragraph(value);}
  section('Referencias');for(const ref of r.methodology.references){paragraph(ref.label+' · '+ref.url);}
  const pages=pdf.getNumberOfPages();for(let i=1;i<=pages;i++){pdf.setPage(i);line(282);text('TAXEA STRATEGIES · Confidencial · Informe de gestión · EUR',margin,288,7,[103,112,130]);text(i+' / '+pages,W-margin,288,7,[103,112,130],'normal',{align:'right'});}
  pdf.setProperties({title:'Multinational Report · '+r.companyName,author:'Taxea Strategies',subject:r.window.start+' / '+r.window.end,creator:'Taxea Portal'});
  return pdf;
}
export async function downloadReportPDF(r){const pdf=await makeReportPDF(r);pdf.save(fileName(r)+'.pdf');}
