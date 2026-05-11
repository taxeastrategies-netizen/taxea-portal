import { useRef, useState } from 'react';
import { Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_FILES = 200;
const MAX_FILE_MB = 10;
const MAX_TOTAL_MB = 500;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

export default function BulkDropZone({ onFilesAdded }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const processFiles = (fileList) => {
    const files = Array.from(fileList).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return ['pdf','jpg','jpeg','png','webp'].includes(ext);
    });

    const valid = files
      .slice(0, MAX_FILES)
      .filter(f => f.size <= MAX_FILE_MB * 1024 * 1024);

    // Check total
    const totalMB = valid.reduce((s, f) => s + f.size, 0) / 1024 / 1024;
    const capped = totalMB > MAX_TOTAL_MB
      ? valid.slice(0, Math.floor(MAX_FILES * (MAX_TOTAL_MB / totalMB)))
      : valid;

    onFilesAdded(capped);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer',
        dragging ? 'border-teal bg-teal-light/40 scale-[1.01]' : 'border-border hover:border-teal/50 hover:bg-accent/30'
      )}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <div className="w-16 h-16 bg-teal-light rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Upload className="w-8 h-8 text-teal" />
      </div>
      <p className="font-jakarta font-bold text-foreground text-lg mb-1">
        Arrastra tus documentos aquí
      </p>
      <p className="text-muted-foreground text-sm mb-4">
        PDF, JPG, JPEG, PNG, WEBP · Hasta 200 archivos · Máx 10 MB por archivo
      </p>
      <Button variant="outline" size="sm" className="gap-2" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>
        <FolderOpen className="w-4 h-4" /> Seleccionar archivos
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPT}
        multiple
        onChange={e => processFiles(e.target.files)}
      />
    </div>
  );
}