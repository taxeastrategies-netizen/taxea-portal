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

async function extraerConIA(file) {
  // Solo usamos el nombre del archivo (sin subir) para la extracción básica
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Analiza el nombre de este archivo PDF fiscal y extrae todos los datos posibles.
Archivo: "${file.name}"

Extrae: modelo fiscal, ejercicio, periodo, trimestre, NIF/CIF del cliente, razón social, importe, CSV/NRC si aparece en el nombre.

Para el modelo usa uno de: modelo_303, modelo_390, modelo_130, modelo_111, modelo_115, modelo_202, modelo_200, modelo_349, modelo_420_igic, modelo_425_igic, renta, cuentas_anuales, libros_contables, otra.

Indica confianza: alta (NIF claro + modelo claro), media (modelo claro pero sin NIF), baja (ambiguo).`,
    response_json_schema: {
      type: 'object',
      properties: {
        modelo: { type: 'string' },
        ejercicio: { type: 'string' },
        periodo: { type: 'string' },
        trimestre: { type: 'string' },
        nif_cif: { type: 'string' },
        razon_social: { type: 'string' },
        importe: { type: 'number' },
        csv: { type: 'string' },
        nrc: { type: 'string' },
        confianza: { type: 'string' }
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
    const extraccion = await extraerConIA(file);
    const empresa = await buscarEmpresa(companiesList, extraccion?.nif_cif, extraccion?.razon_social);

    const estado = empresa
      ? (extraccion?.confianza === 'baja' ? 'revision' : 'identificado')
      : 'no_identificado';

    const previewUrl = file.type === 'application/pdf' ? URL.createObjectURL(file) : null;

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
    // 1. Subir PDF
    const { file_url } = await base44.integrations.Core.UploadFile({ file: item.file });

    // 2. Nombre formateado
    const nombreArchivo = `${empresa.razon_social?.replace(/\s+/g,'_')}_${empresa.nif_cif}_${ex.modelo || 'doc'}_${ex.ejercicio || ''}_${ex.periodo || ''}.pdf`;

    // 3. Archivar en Documentos
    const carpeta = MODELO_A_CARPETA[ex.modelo] || 'fiscal_declaraciones';
    await base44.entities.Document.create({
      company_id: empresa.id,
      nombre: nombreArchivo,
      carpeta,
      archivo_url: file_url,
      tipo_archivo: 'application/pdf',
      anio: parseInt(ex.ejercicio) || new Date().getFullYear(),
      trimestre: ex.trimestre,
      estado: 'aprobado',
      etiquetas: [ex.modelo, 'presentado', 'taxea'].filter(Boolean),
      subido_por: user?.email,
    });

    // 4. Buscar obligación y actualizar
    if (ex.modelo && ex.periodo) {
      const obligaciones = await base44.entities.TaxObligation.filter({ company_id: empresa.id, modelo: ex.modelo });
      const oblig = obligaciones.find(o => o.periodo === ex.periodo) || obligaciones[0];
      if (oblig) {
        await base44.entities.TaxObligation.update(oblig.id, {
          estado: 'presentado',
          justificante_url: file_url,
          comentarios_asesor: `Presentado por Taxea. ${ex.csv ? `CSV: ${ex.csv}` : ''} ${ex.nrc ? `NRC: ${ex.nrc}` : ''}`.trim(),
          importe: ex.importe,
        });
      }
    }

    // 5. Notificación interna + email
    const modeloLabel = (ex.modelo || 'Modelo fiscal').replace(/_/g, ' ').toUpperCase();
    const periodo = ex.periodo || ex.trimestre || ex.ejercicio || '';
    await base44.entities.Notification.create({
      company_id: empresa.id,
      destinatario_email: empresa.email || empresa.owner_email,
      titulo: `✅ ${modeloLabel} presentado`,
      mensaje: `Tu asesor ha presentado el ${modeloLabel} ${periodo}. Puedes descargarlo desde tu portal.`,
      tipo: 'obligacion_proxima',
      leida: false,
      url_referencia: '/obligaciones',
    });
    if (empresa.email) {
      await base44.integrations.Core.SendEmail({
        to: empresa.email,
        subject: `${modeloLabel} presentado — ${periodo}`,
        body: `Hola,\n\nTu asesor Taxea ha presentado el ${modeloLabel} correspondiente al periodo ${periodo}.\n\nPuedes acceder al justificante desde tu portal.\n\nUn saludo,\nEquipo Taxea`
      });
    }

    // 6. Timeline
    await base44.entities.TimelineEvent.create({
      company_id: empresa.id,
      tipo: 'modelo_presentado',
      titulo: `${modeloLabel} presentado`,
      descripcion: `Presentado por Taxea${periodo ? ` — Periodo: ${periodo}` : ''}${ex.csv ? ` — CSV: ${ex.csv}` : ''}`,
      color: 'verde',
      usuario_email: user?.email,
      automatico: false,
      visibilidad: 'ambos',
    });

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