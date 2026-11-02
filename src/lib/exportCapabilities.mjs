export const EXPORT_CAPABILITIES_VERSION='taxea-export-designs-2026.11.02-v1';
const AEAT='https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro/modelos-';
const index=code=>AEAT+(Number(code)<200?'100-199':Number(code)<300?'200-299':'300-399')+'.html';
// Ranges identify the installed serializer, not a guarantee of acceptance by the tax authority.
export const EXPORT_DESIGNS={
 '111':{from:2019,to:2026,design:'EHA/3127/2009 v1.8'},
 '115':{from:2019,to:2026,design:'EHA/3435/2007 v1.3'},
 '123':{from:2024,to:2026,design:'EHA/3435/2007 v2.0'},
 '130':{from:2019,to:2026,design:'HAP/258/2015 v1.2'},
 '131':{from:2026,to:2026,design:'DR131 ejercicio 2026'},
 '180':{from:2023,to:2026,design:'HAP/1732/2014 · 2023 y siguientes'},
 '190':{from:2025,to:2026,design:'HAC/1431/2025'},
 '193':{from:2025,to:2026,design:'HAC/1430/2025'},
 '200':{from:2025,to:2025,design:'DR200e25 v1.02'},
 '202':{from:2025,to:2026,design:'DR202e25 v1.3'},
 '216':{from:2024,to:2026,design:'DR216 2024 y siguientes'},
 '232':{from:2016,to:2026,design:'DR232 v1.4'},
 '296':{from:2024,to:2026,design:'DR296 2024 vigente'},
 '303':{from:2026,to:2026,design:'DR303e26 v1.01'},
 '347':{from:2025,to:2026,design:'HAC/1431/2025'},
 '349':{from:2026,to:2026,design:'DR349 · registros de 500 posiciones'},
 '390':{from:2025,to:2025,design:'DR390e2025 v1.02'},
 '415':{from:2025,to:2025,design:'Programa ATC 415 2025',mode:'official_program_import',authority:'ATC',source:'https://www3.gobiernodecanarias.org/tributos/atc/modelo415'},
};
const guided=new Set(['417','420','421','425']);
export function exportCapability(model,year){const code=String(model||''),n=Number(year),design=EXPORT_DESIGNS[code],valid=Number.isInteger(n)&&!!design&&n>=design.from&&n<=design.to;
 const mode=guided.has(code)?'guided_workpaper':valid?(design.mode||'official_layout'):'review_only';
 return {version:EXPORT_CAPABILITIES_VERSION,model:code,year:Number.isInteger(n)?n:null,mode,canExportOfficial:valid,designMatchesYear:valid,design:design?.design||'',verifiedYears:design?{from:design.from,to:design.to}:null,authority:design?.authority||(guided.has(code)?'ATC':'AEAT'),source:design?.source||index(code),requiresExternalAcceptance:true,externalAcceptance:'not_inferred',message:guided.has(code)?'Paquete de trabajo revisable. El fichero presentable debe generarse y validarse en el programa oficial ATC.':valid?'Diseño instalado compatible con el ejercicio indicado. La aceptación corresponde al importador oficial y al archivo exacto.':design?`Taxea tiene verificado el diseño ${design.design} para ${design.from===design.to?design.from:design.from+'–'+design.to}. No se reutiliza para el ejercicio ${Number.isInteger(n)?n:'no indicado'}. Puedes descargar el borrador de revisión.`:'No hay un diseño oficial habilitado. Se conserva el borrador de revisión.'};}
