export const OCR_FIELDS = ['fecha','proveedor','destinatario','numero','tipo','concepto','base','impuestos','total','resumen'];
export const FILE_LIMIT = 15 * 1024 * 1024;
export function safeName(value, fallback='documento') {
  let name = String(value || '').normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'-').replace(/\s+/g,'_').replace(/^[. ]+|[. ]+$/g,'').slice(0,150);
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) name = '_'+name;
  return name || fallback;
}
export function dateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(value+'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10)===value;
}
export function renamedFile(original, fields, template) {
  const extension = String(original).match(/\.(pdf|png|jpe?g)$/i)?.[0].toLowerCase();
  if (!extension) throw new Error('Formato no admitido.');
  if (!String(template).trim() || String(template).length>200) throw new Error('Nomenclatura vacía o demasiado larga.');
  const values = { fecha:dateOnly(fields.fecha)?fields.fecha:'sin-fecha', proveedor:fields.proveedor || 'sin-emisor', numero:fields.numero || 'sin-numero', tipo:fields.tipo || 'documento', original:String(original).replace(/\.[^.]+$/,'') };
  const name = String(template).replace(/\{([^}]+)\}/g,(_,key)=>{
    if (!(key in values)) throw new Error('Campo desconocido: '+key);
    return String(values[key]);
  });
  return safeName(name)+extension;
}
export function uniqueNames(names) {
  const used = new Set();
  return names.map(raw=>{
    const ext = raw.match(/\.[^.]+$/)?.[0] || '';
    const stem = ext ? raw.slice(0,-ext.length):raw;
    let name=raw, n=2;
    while(used.has(name.toLocaleLowerCase('es'))) name=stem+'_'+n+++ext;
    used.add(name.toLocaleLowerCase('es'));
    return name;
  });
}
export function csvCell(raw) {
  let text = raw == null ? '' : String(raw);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export function documentsCsv(rows) {
  return '\ufeff'+[['archivo',...OCR_FIELDS],...rows.map(row=>[row.name,...OCR_FIELDS.map(k=>row.fields[k])])].map(row=>row.map(csvCell).join(';')).join('\r\n');
}
export function parsePages(raw, count) {
  if (!Number.isInteger(count) || count<1 || count>500) throw new Error('PDF vacío o mayor de 500 páginas.');
  if (!String(raw).trim()) return Array.from({length:count},(_,i)=>i);
  const result=[];
  for(const token of String(raw).split(',')) {
    const match=token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Usa páginas como 1,3,5-7.');
    const start=Number(match[1]),end=Number(match[2] || match[1]);
    if (start<1 || end>count || start>count || end<1) throw new Error('Página fuera del documento.');
    const step=start<=end?1:-1;
    for(let p=start;step>0?p<=end:p>=end;p+=step) result.push(p-1);
    if (result.length>500) throw new Error('Máximo 500 páginas de salida.');
  }
  return result;
}
export function numberInput(value) {
  const normalized=String(value ?? '').trim().replace(',','.');
  if (!normalized || !/^-?\d+(?:\.\d+)?$/.test(normalized)) throw new Error('Introduce un número válido sin separadores de miles.');
  const number=Number(normalized);
  if (!Number.isFinite(number) || Math.abs(number)>1e12) throw new Error('Importe fuera de rango.');
  return number;
}
export function commercialCalculations({cost,price,margin,discount,fixed}) {
  [cost,price,margin,discount,fixed].forEach(n=>{if(!Number.isFinite(n)||n<0) throw new Error('No se admiten valores negativos ni vacíos.');});
  if (price<=0 || margin>=100 || discount>100) throw new Error('Precio mayor que cero; margen menor del 100%; descuento hasta el 100%.');
  const contribution=price-cost;
  return {profit:contribution, margin:contribution/price*100, markup:cost?contribution/cost*100:null, targetPrice:cost/(1-margin/100), discounted:price*(1-discount/100), breakEven:contribution>0?Math.ceil(fixed/contribution):null};
}
export function todayLocal(date=new Date()) {
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function daysUntil(due,today=todayLocal()) {
  if (!dateOnly(due) || !dateOnly(today)) throw new Error('Fecha no válida.');
  return Math.round((Date.parse(due+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
}
const icsEscape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function foldIcs(line) {
  let result='',current='',size=0;
  for(const char of line) {
    const bytes=new TextEncoder().encode(char).length;
    if(size+bytes>73){result+=current+'\r\n ';current='';size=1;}
    current+=char;size+=bytes;
  }
  return result+current;
}
export function deadlinesIcs(rows, now=new Date()) {
  const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Taxea//Herramientas//ES','CALSCALE:GREGORIAN'];
  for(const row of rows.filter(r=>r.status==='pending')) {
    if(!dateOnly(row.due_date)) continue;
    const next=new Date(row.due_date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
    lines.push('BEGIN:VEVENT','UID:'+icsEscape(row.id)+'@taxeaportal.com','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+row.due_date.replace(/-/g,''),'DTEND;VALUE=DATE:'+next.toISOString().slice(0,10).replace(/-/g,''),'SUMMARY:'+icsEscape(row.title),'DESCRIPTION:'+icsEscape(row.notes));
    if(Number.isInteger(row.remind_days) && row.remind_days>=0) lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Revisar vencimiento','TRIGGER:-P'+row.remind_days+'D','END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcs).join('\r\n')+'\r\n';
}
