import {useTheme} from 'next-themes';
import {Monitor,Sun,Moon} from 'lucide-react';
export default function AppearanceSettings(){
  const {theme,setTheme}=useTheme();
  return <section className="bg-card border border-border rounded-xl p-5 mb-5">
    <h2 className="font-jakarta font-semibold">Apariencia</h2>
    <p className="text-xs text-muted-foreground mt-1 mb-4">Sistema sigue los cambios de tema de tu dispositivo, también con la app abierta.</p>
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Tema de la aplicación">
      {[['system','Sistema',Monitor],['light','Claro',Sun],['dark','Oscuro',Moon]].map(([value,label,Icon])=><button key={value} type="button" aria-pressed={(theme||'system')===value} onClick={()=>setTheme(value)} className="min-h-11 rounded-lg border border-border flex items-center justify-center gap-2 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"><Icon className="w-4 h-4"/>{label}</button>)}
    </div>
  </section>;
}
