import {useTheme} from 'next-themes';
import {Monitor,Sun,Moon} from 'lucide-react';
import {useState} from 'react';
import useCopyTextPreference from '@/hooks/useCopyTextPreference';
import useMobileViewport from '@/hooks/useMobileViewport';
import {allowsCopyText,setCopyTextMode} from '@/lib/copyTextPreference.mjs';
export default function AppearanceSettings(){
  const {theme,setTheme}=useTheme();
  const copyMode=useCopyTextPreference(),mobile=useMobileViewport(),copyAllowed=allowsCopyText(copyMode,mobile);
  const [copyMessage,setCopyMessage]=useState('');
  const changeCopy=mode=>setCopyMessage(setCopyTextMode(mode)?'Preferencia guardada en este dispositivo.':'Preferencia activa solo en esta sesión.');
  return <section className="bg-card border border-border rounded-xl p-5 mb-5">
    <h2 className="font-jakarta font-semibold">Apariencia</h2>
    <p className="text-xs text-muted-foreground mt-1 mb-4">Sistema sigue los cambios de tema de tu dispositivo, también con la app abierta.</p>
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Tema de la aplicación">
      {[['system','Sistema',Monitor],['light','Claro',Sun],['dark','Oscuro',Moon]].map(([value,label,Icon])=><button key={value} type="button" aria-pressed={(theme||'system')===value} onClick={()=>setTheme(value)} className="min-h-11 rounded-lg border border-border flex items-center justify-center gap-2 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"><Icon className="w-4 h-4"/>{label}</button>)}
    </div>
    <div className="mt-4 border-t border-border pt-4"><button type="button" role="switch" aria-checked={copyAllowed} aria-label="Permitir seleccionar texto para copiar" onClick={()=>changeCopy(copyAllowed?'deny':'allow')} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm"><span>Permitir seleccionar texto para copiar</span><span aria-hidden="true" className={`rounded-full px-3 py-1 text-xs ${copyAllowed?'bg-primary text-primary-foreground':'bg-secondary text-muted-foreground'}`}>{copyAllowed?'Activado':'Desactivado'}</span></button><p className="mt-1 text-xs text-muted-foreground">En automático se evita la selección accidental en móvil y se permite en ordenador. Los campos editables y el zoom siguen disponibles.</p><button type="button" onClick={()=>changeCopy('auto')} className="mt-1 min-h-11 text-xs text-primary">Restablecer selección automática</button>{copyMessage&&<p role="status" className="text-xs text-muted-foreground">{copyMessage}</p>}</div>
  </section>;
}

