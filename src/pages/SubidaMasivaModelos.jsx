import { useState, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Upload, CloudUpload, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ColaProcesamiento from '@/components/modelos/ColaProcesamiento';
import PanelRevision from '@/components/modelos/PanelRevision';

let nextId = 1;

const MODELOS_ENUM = [
  'modelo_303','modelo_390','modelo_130','modelo_111','modelo_115',
  'modelo_202','modelo_200','modelo_349','modelo_420_igic','modelo_425_igic',
  'renta','cuentas_anuales','libros_contables','otra'
];

const MODELO_A_CARPETA = {
  modelo_303: 'fiscal_iva', modelo_390: 'fiscal_iva',
  modelo_130: 'fiscal_irpf', modelo_111: 'fiscal_retenciones', modelo_115: 'fiscal_retenciones',
  modelo_202: 'fiscal_is', modelo_200: 'fiscal_is',
  modelo_349: 'fiscal_intracomunitarias',
  modelo_420_igic: 'fiscal_igic', modelo_425_igic: 'fiscal_igic',
  renta: 'fiscal_irpf', cuentas_anuales: 'cont_cuentas_anuales',
  otra: 'fiscal_declaraciones',
};

async function extraerConIA(fileUrl, fileName) {
  // Lee el PDF completo y extrae datos del documento real
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Eres un experto en modelos fiscales españoles. Lee este PDF y extrae TODOS los datos posibles.

Busca especialmente:
- DNI/CIF/NIF del contribuyente (en mayúsculas, formato español: 12345678A o 12345678-A)
- Razón social / Nombre completo
- Modelo fiscal (303, 390, 130, 111, 115, 202, 200, 349, 420, 425, IS, Renta, etc.)
- Ejercicio / Año (4 dígitos)
- Período (T1, T2, T3, T4, 1T, 2T, 3T, 4T, o el trimestre que aparezca)
- CSV (código de autenticación)
- NRC (número de referencia de control)
- Importe total a ingresar o devolver

Nombre archivo: "${fileName}"

Responde SIEMPRE en JSON, incluso si algunos campos están vacíos. Para confianza: usa "alta" si tienes NIF+modelo claros, "media" si modelo es claro pero faltan datos, "baja" si hay dudas o ambigüedad.`,
    file_urls: fileUrl,
    response_json_schema: {
      type: 'object',
      properties: {
        modelo: { type: 'string', description: 'Ej: modelo_303, modelo_390' },
        ejercicio: { type: 'string', description: '4 dígitos' },
        periodo: { type: 'string', description: 'T1, T2, T3, T4 o similar' },
        trimestre: { type: 'string' },
        nif_cif: { type: 'string', description: 'DNI/CIF/NIF en mayúsculas' },
        razon_social: { type: 'string' },
        importe: { type: 'number' },
        csv: { type: 'string' },
        nrc: { type: 'string' },
        confianza: { type: 'string', description: 'alta, media o baja' }
      }
    }
  });
  return result;
}

async function buscarEmpresa(companies, nif, razonSocial) {
  if (nif) {
    const match = companies.find(c => c.nif_cif?.replace(/\s/g,'').toLowerCase() === nif.replace(/\s/g,'').toLowerCase());
    if (match) return match;
  }
  if (razonSocial) {
    const lower = razonSocial.toLowerCase();
    const match = companies.find(c => c.razon_social?.toLowerCase().includes(lower) || lower.includes(c.razon_social?.toLowerCase()));
    if (match) return match;
  }
  return null;
}

export default function SubidaMasivaModelos() {
  const { user, isAdmin } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const fileRef = useRef(null);

  const loadCompanies = async () => {
    if (companiesLoaded) return;
    const data = await base44.entities.Company.list();
    setCompanies(data || []);
    setCompaniesLoaded(true);
    return data || [];
  };

  const procesarItem = useCallback(async (id, file, companiesList) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, estado: 'procesando' } : i));
    
    // 1. Subir PDF primero
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    // 2. IA lee el PDF completo
    const extraccion = await extraerConIA(file_url, file.name);
    
    // 3. Buscar cliente por NIF (lo más importante ahora)
    const empresa = await buscarEmpresa(companiesList, extraccion?.nif_cif, extraccion?.razon_social);

    const estado = empresa
      ? (extraccion?.confianza === 'baja' ? 'revision' : 'identificado')
      : 'no_identificado';

    const previewUrl = file.type === 'application/pdf' ? file_url : null;

    setItems(prev => prev.map(i => i.id === id ? {
      ...i, estado,
      extraccion: { ...extraccion, company_id: empresa?.id },
      previewUrl
    } : i));
  }, []);

  const handleFiles = async (files) => {
    const companiesList = await loadCompanies();
    const newItems = Array.from(files).map(f => ({
      id: nextId++, file: f, estado: 'pendiente', extraccion: null, previewUrl: null
    }));
    setItems(prev => [...prev, ...newItems]);
    if (newItems.length > 0) setSelectedId(newItems[0].id);
    // Procesar en paralelo (máx 3 a la vez)
    const chunks = [];
    for (let i = 0; i < newItems.length; i += 3) chunks.push(newItems.slice(i, i + 3));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(item => procesarItem(item.id, item.file, companiesList)));
    }
  };

  const handleConfirmar = async (item, empresa) => {
    if (!empresa) return;
    const ex = item.extraccion || {};
    const now = new Date();
    const nombreArchivo = `${empresa.razon_social?.replace(/\s+/g,'_')}_${empresa.nif_cif}_${ex.modelo || 'doc'}_${ex.ejercicio || ''}_${ex.periodo || ''}.pdf`;
    const carpeta = MODELO_A_CARPETA[ex.modelo] || 'fiscal_declaraciones';
    const modeloLabel = (ex.modelo || 'Modelo fiscal').replace(/_/g, ' ').toUpperCase();
    const periodo = ex.periodo || ex.trimestre || ex.ejercicio || '';
    const emailEmpresa = empresa.email || empresa.owner_email;

    // 1. Archivar PDF en Documentos
    const docData = {
      company_id: empresa.id,
      nombre: nombreArchivo,
      carpeta,
      archivo_url: item.previewUrl, // Ya subido durante procesamiento
      tipo_archivo: 'application/pdf',
      anio: parseInt(ex.ejercicio) || now.getFullYear(),
      trimestre: ex.trimestre,
      estado: 'aprobado',
      etiquetas: [ex.modelo, 'presentado', 'taxea'].filter(Boolean),
      subido_por: user?.email,
    };
    const doc = await base44.entities.Document.create(docData);

    // 2. Buscar/actualizar obligación (NO duplicar)
    let oblig = null;
    if (ex.modelo && ex.periodo) {
      const obligaciones = await base44.entities.TaxObligation.filter({ 
        company_id: empresa.id, 
        modelo: ex.modelo,
        periodo: ex.periodo
      });
      oblig = obligaciones[0];
      
      if (oblig) {
        // Actualizar existente
        await base44.entities.TaxObligation.update(oblig.id, {
          estado: 'presentado',
          justificante_url: doc.archivo_url,
          comentarios_asesor: [
            oblig.comentarios_asesor || '',
            `Presentado por Taxea el ${now.toLocaleDateString('es-ES')}`,
            ex.csv ? `CSV: ${ex.csv}` : '',
            ex.nrc ? `NRC: ${ex.nrc}` : ''
          ].filter(Boolean).join(' | '),
          importe: ex.importe || oblig.importe,
        });
      } else {
        // Crear nueva
        oblig = await base44.entities.TaxObligation.create({
          company_id: empresa.id,
          modelo: ex.modelo,
          periodo: ex.periodo,
          anio: parseInt(ex.ejercicio) || now.getFullYear(),
          trimestre: ex.trimestre,
          fecha_limite: now.toISOString().split('T')[0],
          estado: 'presentado',
          resultado: 'pendiente',
          justificante_url: doc.archivo_url,
          comentarios_asesor: `Presentado por Taxea el ${now.toLocaleDateString('es-ES')}${ex.csv ? ` — CSV: ${ex.csv}` : ''}${ex.nrc ? ` — NRC: ${ex.nrc}` : ''}`,
          importe: ex.importe,
        });
      }
    }

    // 3. Notificación interna
    await base44.entities.Notification.create({
      company_id: empresa.id,
      destinatario_email: emailEmpresa,
      titulo: `✅ ${modeloLabel} presentado`,
      mensaje: `Taxea ha presentado recientemente tu ${modeloLabel} ${periodo}. Tu documentación fiscal está al día.`,
      tipo: 'documento_revisado',
      leida: false,
      url_referencia: '/obligaciones',
    });

    // 4. Email premium (con tema de tranquilidad)
    if (emailEmpresa) {
      await base44.integrations.Core.SendEmail({
        to: emailEmpresa,
        from_name: 'Taxea Strategies',
        subject: `Tus impuestos ya están presentados — ${modeloLabel}`,
        body: `Hola,

Tu ${modeloLabel} ha sido presentado correctamente ante la Administración Tributaria.

📋 Detalles:
• Modelo: ${modeloLabel}
• Período: ${periodo}
• Fecha de presentación: ${now.toLocaleDateString('es-ES')}
${ex.csv ? `• CSV: ${ex.csv}` : ''}
${ex.nrc ? `• NRC: ${ex.nrc}` : ''}

Puedes descargar el justificante desde tu portal en Obligaciones Fiscales.

Tus impuestos están al día. Taxea Strategies se encarga de que todo funcione correctamente.

Un saludo,
Equipo Taxea Strategies`
      });
    }

    // 5. Timeline
    await base44.entities.TimelineEvent.create({
      company_id: empresa.id,
      tipo: 'modelo_presentado',
      titulo: `${modeloLabel} presentado`,
      descripcion: `Presentado por Taxea el ${now.toLocaleDateString('es-ES')}${periodo ? ` — Período: ${periodo}` : ''}${ex.csv ? ` — CSV: ${ex.csv}` : ''}`,
      color: 'verde',
      entidad_tipo: 'TaxObligation',
      entidad_id: oblig?.id,
      usuario_email: user?.email,
      automatico: false,
      visibilidad: 'ambos',
      afecta_health_score: true,
      estado_nuevo: 'presentado',
    });

    // 6. Actualizar health score del cliente
    const crm = await base44.entities.ClientCRM.filter({ company_id: empresa.id });
    if (crm[0]) {
      const newScore = Math.min(100, (crm[0].health_score || 75) + 5);
      await base44.entities.ClientCRM.update(crm[0].id, {
        health_score: newScore,
        estado_fiscal: 'verde',
      });
    }

    // 7. Marcar como confirmado
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, estado: 'confirmado' } : i));
  };

  const handleIgnorar = (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, estado: 'ignorado' } : i));
  };

  const handleReprocesar = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const companiesList = companiesLoaded ? companies : await loadCompanies();
    await procesarItem(id, item.file, companiesList);
  };

  const confirmarTodosIdentificados = async () => {
    const pendientes = items.filter(i => i.estado === 'identificado');
    for (const item of pendientes) {
      const empresa = companies.find(c => c.id === item.extraccion?.company_id);
      if (empresa) await handleConfirmar(item, empresa);
    }
  };

  const selectedItem = items.find(i => i.id === selectedId);
  const hayIdentificados = items.some(i => i.estado === 'identificado');

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-64 text-center">
      <div>
        <p className="text-sm font-medium text-foreground">Acceso restringido</p>
        <p className="text-xs text-muted-foreground mt-1">Solo administradores pueden usar esta herramienta</p>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Subida masiva de modelos" subtitle="Sube PDFs · IA identifica cliente y archiva automáticamente">
        {hayIdentificados && (
          <Button onClick={confirmarTodosIdentificados} className="bg-teal hover:bg-teal-dark h-9">
            <Zap className="w-4 h-4 mr-1.5" /> Confirmar todos ({items.filter(i => i.estado === 'identificado').length})
          </Button>
        )}
      </PageHeader>

      {items.length === 0 ? (
        /* Drop zone inicial */
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={cn('border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all',
            dragOver ? 'border-teal bg-teal/5' : 'border-border hover:border-teal/40 hover:bg-secondary/20')}
        >
          <div className="w-16 h-16 bg-teal-light rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <CloudUpload className="w-8 h-8 text-teal" />
          </div>
          <p className="text-lg font-semibold text-foreground mb-1">Arrastra los PDFs aquí</p>
          <p className="text-sm text-muted-foreground mb-4">Modelos 303, 390, 130, 111, 115, 200, 202, 349, 420, 425, Rentas, IS…</p>
          <Button variant="outline" className="mx-auto">
            <Upload className="w-4 h-4 mr-2" /> Seleccionar archivos
          </Button>
          <input ref={fileRef} type="file" multiple accept=".pdf" className="hidden"
            onChange={e => handleFiles(e.target.files)} />
        </div>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-220px)] min-h-96">
          {/* Cola izquierda */}
          <div className="w-72 flex-shrink-0 bg-card border border-border rounded-xl shadow-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Cola de procesamiento</p>
              <button onClick={() => fileRef.current?.click()}
                className="text-xs text-teal hover:underline flex items-center gap-1">
                <Upload className="w-3 h-3" /> Añadir más
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ColaProcesamiento items={items} selectedId={selectedId} onSelect={setSelectedId} onReprocesar={handleReprocesar} />
            </div>
            <input ref={fileRef} type="file" multiple accept=".pdf" className="hidden"
              onChange={e => handleFiles(e.target.files)} />
          </div>

          {/* Panel revisión derecha */}
          <div className="flex-1 bg-card border border-border rounded-xl shadow-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Panel de revisión</p>
              {selectedItem && (
                <div className="flex items-center gap-2">
                  {selectedItem.estado === 'confirmado' && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Archivado
                    </span>
                  )}
                  {['revision','no_identificado'].includes(selectedItem.estado) && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> Requiere revisión manual
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <PanelRevision
                item={selectedItem}
                companies={companies}
                onConfirmar={handleConfirmar}
                onIgnorar={handleIgnorar}
                onReprocesar={handleReprocesar}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}