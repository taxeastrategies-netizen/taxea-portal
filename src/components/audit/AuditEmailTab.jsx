import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Mail, Copy, Download, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AuditEmailTab({ caseId }) {
  const queryClient = useQueryClient();
  const [recipientType, setRecipientType] = useState('gestoria');
  const [emailContent, setEmailContent] = useState('');
  const [generating, setGenerating] = useState(false);

  const { data: findings = [] } = useQuery({
    queryKey: ['auditFindings', caseId],
    queryFn: () => base44.entities.TaxeaAuditFinding.filter({ auditCaseId: caseId }),
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateAuditEmail', { auditCaseId: caseId, recipientType });
      const data = res.data || res;
      if (data.error) {
        toast.error(data.error);
      } else {
        setEmailContent(data.emailContent);
        toast.success('Borrador de email generado');
      }
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(emailContent);
    toast.success('Email copiado al portapapeles');
  };

  const handleDownload = () => {
    const blob = new Blob([emailContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `borrador_email_${recipientType}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border shadow-card p-4">
        <h3 className="font-jakarta font-semibold text-foreground mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-teal" /> Borrador de email
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Genera un borrador profesional para solicitar documentos, aclarar bloqueos o comunicar hallazgos.
          {findings.length} hallazgos disponibles como contexto.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={recipientType} onValueChange={setRecipientType}>
            <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gestoria">Gestoría</SelectItem>
              <SelectItem value="cliente">Cliente</SelectItem>
              <SelectItem value="asesor">Asesor externo</SelectItem>
              <SelectItem value="notaria">Notaría</SelectItem>
              <SelectItem value="tercero">Tercero</SelectItem>
              <SelectItem value="interna">Administración interna</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={generating || findings.length === 0} className="bg-teal hover:bg-teal-dark h-9">
            {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Mail className="w-4 h-4 mr-1.5" />}
            {generating ? 'Generando...' : 'Generar email'}
          </Button>
        </div>
      </div>

      {emailContent && (
        <div className="bg-card rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h4 className="text-sm font-semibold text-foreground">Borrador para {recipientType}</h4>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 text-xs">
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} className="h-7 text-xs">
                <Download className="w-3 h-3 mr-1" /> Descargar
              </Button>
            </div>
          </div>
          <div className="p-4">
            <textarea
              className="w-full min-h-[300px] text-sm font-mono p-3 rounded-lg border border-border bg-slate-50/50 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
            />
          </div>
          <div className="px-4 py-2 border-t border-border bg-amber-50/50">
            <p className="text-xs text-amber-700">
              El email no se envía automáticamente. Revisa el contenido antes de usarlo. No afirmar como cerrado lo que depende de revisión profesional.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}