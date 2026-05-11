/**
 * TaxeaLogo — componente de marca reutilizable
 *
 * variant:
 *   "full"    → logo completo (fondo claro, para panel oscuro: sobre card blanca)
 *   "sidebar" → versión compacta para sidebar oscuro (invertida)
 *   "topbar"  → versión para topbar claro
 *   "isotipo" → solo iniciales, para favicon/loader
 *
 * dark: true cuando el contenedor es oscuro (aplica filtro invert)
 */

const LOGO_URL =
  'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/35e9bbe29_IMG_20260111_164937_14712.webp';

export function TaxeaIsotipo({ size = 36, className = '' }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #7a1a22 0%, #b82535 100%)',
        boxShadow: '0 2px 12px rgba(184,37,53,0.35)',
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* T elegante con trazo fino */}
        <path
          d="M3 5h18M12 5v14"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* línea accent roja suave debajo */}
        <path
          d="M8 19c1.2-.4 2.6-.6 4-.6s2.8.2 4 .6"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function TaxeaLogoFull({ height = 56, onDark = false, className = '' }) {
  if (onDark) {
    // Sobre fondo oscuro: tarjeta blanca que contiene el logo original
    return (
      <div
        className={`inline-flex items-center justify-center rounded-2xl ${className}`}
        style={{
          background: 'rgba(255,255,255,0.97)',
          padding: '10px 20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.08) inset',
        }}
      >
        <img
          src={LOGO_URL}
          alt="Taxea Strategies"
          style={{ height, width: 'auto', display: 'block', objectFit: 'contain' }}
          draggable={false}
        />
      </div>
    );
  }

  // Sobre fondo claro: logo directo
  return (
    <img
      src={LOGO_URL}
      alt="Taxea Strategies"
      className={className}
      style={{ height, width: 'auto', display: 'block', objectFit: 'contain' }}
      draggable={false}
    />
  );
}

export function TaxeaSidebarLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <TaxeaIsotipo size={32} />
      <div className="flex flex-col leading-none">
        <span
          className="text-white font-jakarta font-bold tracking-wide"
          style={{ fontSize: 14, letterSpacing: '0.06em' }}
        >
          TAXEA
        </span>
        <span
          className="font-inter font-normal tracking-widest uppercase"
          style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.18em' }}
        >
          Strategies
        </span>
      </div>
    </div>
  );
}