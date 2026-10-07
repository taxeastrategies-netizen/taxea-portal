import { parsePages, uniqueNames } from './utilityTools.mjs';

export function downloadBlob(data,name,type='application/octet-stream') {
  const blob=data instanceof Blob?data:new Blob([data],{type});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function zipFiles(files) {
  const { zip }=await import('fflate');
  const entries=Object.create(null);
  const names=uniqueNames(files.map(file=>file.name));
  for(let i=0;i<files.length;i++) entries[names[i]]=new Uint8Array(await files[i].blob.arrayBuffer());
  return new Promise((resolve,reject)=>zip(entries,{level:0},(error,bytes)=>error?reject(error):resolve(bytes)));
}
export async function loadPdf(file) {
  const {PDFDocument}=await import('pdf-lib');
  let doc;
  try {doc=await PDFDocument.load(await file.arrayBuffer());}
  catch {throw new Error('No se puede abrir '+file.name+'. Comprueba que sea un PDF válido y sin contraseña.');}
  if(doc.getPageCount()>500) throw new Error('Máximo 500 páginas por PDF.');
  return doc;
}
export async function transformPdfs(files,operation,selection='',rotation=0) {
  const {PDFDocument,degrees}=await import('pdf-lib');
  if(!files.length) throw new Error('Selecciona un PDF.');
  if(operation!=='merge' && files.length!==1) throw new Error('Esta operación requiere un único PDF.');
  const output=await PDFDocument.create();
  for(const file of files) {
    const input=await loadPdf(file);
    if(operation==='split') {
      const pages=parsePages(selection,input.getPageCount()),results=[];
      for(let i=0;i<pages.length;i++) {
        const part=await PDFDocument.create();
        const [page]=await part.copyPages(input,[pages[i]]);part.addPage(page);
        results.push({name:'pagina_'+(pages[i]+1)+'_'+(i+1)+'.pdf',blob:new Blob([new Uint8Array(await part.save()).buffer],{type:'application/pdf'})});
      }
      return {bytes:await zipFiles(results),name:'paginas.zip',type:'application/zip'};
    }
    const indices=operation==='merge'?input.getPageIndices():parsePages(selection,input.getPageCount());
    if(output.getPageCount()+indices.length>500) throw new Error('Máximo 500 páginas de salida.');
    for(const page of await output.copyPages(input,indices)) {
      if(operation==='rotate') page.setRotation(degrees((page.getRotation().angle+Number(rotation))%360));
      output.addPage(page);
    }
  }
  return {bytes:await output.save(),name:operation==='merge'?'documentos_unidos.pdf':operation==='rotate'?'documento_rotado.pdf':'paginas_seleccionadas.pdf',type:'application/pdf'};
}
export async function jpegImage(file,quality=0.85,maxSide=2200) {
  let bitmap;
  try {bitmap=await createImageBitmap(file);}
  catch {throw new Error('No se pudo abrir la imagen '+file.name+'. Usa PNG, JPEG o WebP.');}
  try {
    if(bitmap.width*bitmap.height>60e6) throw new Error('Imagen demasiado grande: máximo 60 megapíxeles.');
    const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No se pudo convertir la imagen.')),'image/jpeg',quality));
    return {blob,width:canvas.width,height:canvas.height};
  } finally {bitmap.close();}
}
export async function imagesPdf(files,quality=0.85,maxSide=2200) {
  const {PDFDocument}=await import('pdf-lib');
  const doc=await PDFDocument.create();
  for(const file of files) {
    const image=await jpegImage(file,quality,maxSide);
    const embedded=await doc.embedJpg(await image.blob.arrayBuffer());
    const portrait=image.height>=image.width;
    /** @type {[number, number]} */
    const size=portrait?[595.28,841.89]:[841.89,595.28];
    const page=doc.addPage(size),scale=Math.min((size[0]-40)/image.width,(size[1]-40)/image.height);
    const width=image.width*scale,height=image.height*scale;
    page.drawImage(embedded,{x:(size[0]-width)/2,y:(size[1]-height)/2,width,height});
  }
  return {bytes:await doc.save(),name:'imagenes.pdf',type:'application/pdf'};
}
