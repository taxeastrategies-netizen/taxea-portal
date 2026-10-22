import {Link} from 'react-router-dom';
export default function AccountDeletionInfo(){return <main className="min-h-[100dvh] bg-background text-foreground safe-area-padded px-5 py-10"><article className="max-w-2xl mx-auto space-y-5">
  <Link to="/" className="font-jakarta font-bold text-primary">TAXEA PORTAL</Link>
  <h1 className="text-2xl font-semibold">Eliminación de cuenta y datos</h1>
  <p>Taxea Strategies · Contacto de privacidad: <a className="underline" href="mailto:taxeastrategies@gmail.com">taxeastrategies@gmail.com</a>.</p>
  <h2 className="text-lg font-semibold">Cómo iniciar la eliminación</h2>
  <p>Accede a la versión web o a la app, abre Ajustes → Seguridad → Eliminar mi cuenta y confirma la solicitud. No necesitas llamar ni enviar un correo para iniciarla. Obtendrás un justificante con referencia y fecha inicial de respuesta.</p>
  <Link to="/ajustes?tab=seguridad" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-primary-foreground">Acceder a la eliminación de cuenta</Link>
  <h2 className="text-lg font-semibold">Qué se elimina y qué puede conservarse</h2>
  <p>La tramitación comprende la cuenta y su perfil, accesos e integraciones personales y los datos que ya no deban conservarse. Las facturas, libros, declaraciones y evidencias sujetas a obligaciones legales o responsabilidades pendientes no se destruyen por dar de baja el acceso. La documentación retenida se mantiene con acceso restringido y se informa de su motivo y plazo aplicable en la respuesta al titular.</p>
  <h2 className="text-lg font-semibold">Plazo y confirmación</h2>
  <p>El plazo inicial de respuesta es un mes desde la solicitud. Si corresponde una ampliación legal, se comunicará con su motivo. La eliminación requiere tramitarla, no solo marcar la cuenta como inactiva, y se confirma al finalizar.</p>
  <h2 className="text-lg font-semibold">Servicios y cobros</h2>
  <p>Eliminar la cuenta del portal no debe confundirse con resolver un contrato de asesoría o con cancelar un cobro periódico. Estos aspectos se revisan en el trámite; te informaremos de lo que corresponda antes de cerrarlo. No se realizan cobros ni cancelaciones desde esta página.</p>
  <p className="text-sm text-muted-foreground">No publiques documentos fiscales ni credenciales en formularios abiertos. Si no puedes acceder, el contacto de privacidad puede ayudarte a verificar tu identidad.</p>
  <Link to="/login" className="underline">Volver al acceso</Link>
</article></main>;}
