/**
 * Genera el HTML premium para el email de presentación de obligaciones fiscales
 * Diseño: dark premium, Taxea Strategies
 */

const MODELO_NOMBRES = {
  modelo_303: 'Modelo 303 — IVA Trimestral',
  modelo_390: 'Modelo 390 — Resumen Anual IVA',
  modelo_130: 'Modelo 130 — Pago Fraccionado IRPF',
  modelo_111: 'Modelo 111 — Retenciones IRPF',
  modelo_115: 'Modelo 115 — Retenciones Arrendamientos',
  modelo_202: 'Modelo 202 — Pago Fraccionado Sociedades',
  modelo_200: 'Modelo 200 — Impuesto de Sociedades',
  modelo_349: 'Modelo 349 — Operaciones Intracomunitarias',
  modelo_420_igic: 'Modelo 420 — IGIC Trimestral',
  modelo_425_igic: 'Modelo 425 — Resumen Anual IGIC',
  renta: 'Declaración de la Renta — IRPF',
  cuentas_anuales: 'Cuentas Anuales',
  libros_contables: 'Libros Contables',
  otra: 'Declaración Fiscal',
};

function formatEuro(amount) {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

function getPagoTexto(ex) {
  if (ex.nrc) {
    return {
      texto: 'El importe correspondiente ya ha sido abonado mediante NRC bancario y la presentación ha quedado registrada correctamente.',
      icono: '🏦',
      color: '#10b981'
    };
  }
  if (ex.resultado === 'a_devolver') {
    return {
      texto: 'La declaración ha sido presentada con resultado a devolver. La Administración Tributaria realizará el proceso correspondiente de devolución en los plazos establecidos.',
      icono: '↩️',
      color: '#3b82f6'
    };
  }
  if (!ex.importe || ex.importe === 0) {
    return {
      texto: 'La declaración ha sido presentada sin importe a ingresar. No se requiere ninguna acción adicional por tu parte.',
      icono: '✅',
      color: '#10b981'
    };
  }
  // Por defecto: domiciliación
  return {
    texto: 'El importe será cargado automáticamente por la Administración Tributaria en la cuenta bancaria indicada. No es necesario realizar ningún pago manual.',
    icono: '🏛',
    color: '#f59e0b'
  };
}

export function generarEmailPremium({ modeloKey, ejercicio, periodo, importe, csv, nrc, fechaPresentacion, razonSocial, resultado, portalUrl }) {
  const modeloNombre = MODELO_NOMBRES[modeloKey] || (modeloKey || 'Declaración Fiscal').replace(/_/g, ' ').toUpperCase();
  const fechaStr = fechaPresentacion
    ? new Date(fechaPresentacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const pagoInfo = getPagoTexto({ nrc, importe, resultado });
  const importeStr = formatEuro(importe);
  const portal = portalUrl || 'https://portal.taxea.es';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Obligación fiscal presentada — Taxea Strategies</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER PREMIUM -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d0d0d 0%,#1a1a1a 50%,#0d0d0d 100%);border-radius:16px 16px 0 0;padding:48px 40px 40px;text-align:center;">
            <!-- Logo Taxea -->
            <div style="margin-bottom:28px;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#8b1a2b;width:6px;height:48px;border-radius:3px;vertical-align:top;"></td>
                  <td style="width:14px;"></td>
                  <td style="vertical-align:middle;padding-bottom:4px;">
                    <div style="font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-1px;line-height:1;">TAXEA</div>
                    <div style="font-size:11px;font-weight:400;color:#888888;letter-spacing:3px;text-transform:uppercase;margin-top:3px;">STRATEGIES</div>
                  </td>
                </tr>
              </table>
            </div>
            <!-- Divider -->
            <div style="width:48px;height:2px;background-color:#8b1a2b;margin:0 auto 28px;border-radius:1px;"></div>
            <!-- Título -->
            <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 12px;line-height:1.3;letter-spacing:-0.3px;">
              Tu obligación fiscal ha sido<br>presentada correctamente
            </h1>
            <!-- Subtítulo -->
            <p style="color:#999999;font-size:14px;margin:0;line-height:1.6;max-width:460px;margin-left:auto;margin-right:auto;">
              Tu modelo tributario ha sido presentado ante la Administración Tributaria. 
              Toda la documentación se encuentra disponible en tu área privada de Taxea Portal.
            </p>
          </td>
        </tr>

        <!-- BADGE ESTADO -->
        <tr>
          <td style="background:#111111;padding:20px 40px;text-align:center;border-left:1px solid #222;border-right:1px solid #222;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background-color:#0d2a1a;border:1px solid #1a5c33;border-radius:100px;padding:10px 24px;">
                  <span style="color:#34d399;font-size:13px;font-weight:600;letter-spacing:0.5px;">✅ &nbsp;PRESENTADO CORRECTAMENTE — ${fechaStr.toUpperCase()}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CUERPO BLANCO -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 0;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">

            <!-- Saludo -->
            <p style="color:#1a1a1a;font-size:15px;margin:0 0 24px;line-height:1.6;">
              ${razonSocial ? `Estimado cliente de <strong>${razonSocial}</strong>,` : 'Estimado cliente,'}
            </p>

            <!-- Card modelo principal -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border:1px solid #ebebeb;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="background:linear-gradient(90deg,#0d0d0d,#1f1f1f);padding:16px 24px;">
                  <p style="color:#ffffff;font-size:16px;font-weight:700;margin:0;letter-spacing:-0.2px;">${modeloNombre}</p>
                  ${periodo || ejercicio ? `<p style="color:#888888;font-size:12px;margin:4px 0 0;letter-spacing:0.5px;text-transform:uppercase;">${[ejercicio, periodo].filter(Boolean).join(' &nbsp;·&nbsp; ')}</p>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding:0;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${buildFila('Fecha de presentación', fechaStr, true)}
                    ${importe ? buildFila('Importe', importeStr, false) : ''}
                    ${csv ? buildFila('CSV', csv, true) : ''}
                    ${nrc ? buildFila('NRC', nrc, false) : ''}
                    ${ejercicio ? buildFila('Ejercicio', ejercicio, !nrc && !csv) : ''}
                  </table>
                </td>
              </tr>
            </table>

            <!-- Bloque pago -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-left:3px solid ${pagoInfo.color};border-radius:0 8px 8px 0;padding:0;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="color:#1a1a1a;font-size:13.5px;margin:0;line-height:1.6;">
                    <span style="font-size:16px;margin-right:8px;">${pagoInfo.icono}</span>
                    ${pagoInfo.texto}
                  </p>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <div style="height:1px;background:#f0f0f0;margin-bottom:28px;"></div>

            <!-- Bloque explicativo "¿Qué significa esto?" -->
            <h3 style="color:#1a1a1a;font-size:14px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">¿Qué significa esto?</h3>
            <p style="color:#555555;font-size:14px;line-height:1.7;margin:0 0 28px;">
              Tu obligación fiscal ya ha sido presentada correctamente y <strong>no necesitas realizar ninguna acción adicional</strong> en este momento. 
              Taxea Strategies ha gestionado todos los trámites ante la Agencia Tributaria en tu nombre.
              El justificante oficial está disponible en tu portal privado.
            </p>

          </td>
        </tr>

        <!-- BOTÓN PORTAL -->
        <tr>
          <td style="background-color:#ffffff;padding:0 40px 32px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background-color:#8b1a2b;border-radius:8px;">
                  <a href="${portal}/obligaciones" style="display:inline-block;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 36px;letter-spacing:0.3px;">
                    Acceder a Taxea Portal →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BLOQUE TRANQUILIDAD -->
        <tr>
          <td style="background:#f8f8f8;padding:28px 40px;border:1px solid #e5e5e5;border-top:none;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" style="vertical-align:top;padding-top:2px;">
                  <div style="width:32px;height:32px;background:#0d0d0d;border-radius:50%;text-align:center;line-height:32px;font-size:14px;">🛡</div>
                </td>
                <td style="padding-left:12px;">
                  <p style="color:#1a1a1a;font-size:13px;font-weight:700;margin:0 0 4px;">Tus impuestos están al día</p>
                  <p style="color:#666666;font-size:13px;margin:0;line-height:1.6;">
                    En Taxea Strategies supervisamos continuamente tu situación fiscal, vencimientos y obligaciones para que puedas centrarte en tu negocio con total tranquilidad.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#0d0d0d;padding:32px 40px;border-radius:0 0 16px 16px;text-align:center;">
            <!-- Firma -->
            <p style="color:#ffffff;font-size:14px;font-weight:600;margin:0 0 2px;">Alexis Expósito Acosta</p>
            <p style="color:#666666;font-size:12px;margin:0 0 20px;letter-spacing:0.5px;">CEO & Founder — Taxea Strategies</p>
            <!-- Divider -->
            <div style="width:32px;height:1px;background:#333333;margin:0 auto 20px;"></div>
            <!-- Mensaje final -->
            <p style="color:#555555;font-size:12px;margin:0 0 16px;line-height:1.6;">
              Gracias por confiar en Taxea Strategies como <em>partner</em> fiscal y contable de tu actividad.
            </p>
            <p style="color:#333333;font-size:11px;margin:0;">
              © ${new Date().getFullYear()} Taxea Strategies — <a href="${portal}" style="color:#8b1a2b;text-decoration:none;">taxea.es</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildFila(label, valor, shade) {
  return `<tr>
    <td style="padding:12px 24px;border-bottom:1px solid #ebebeb;background:${shade ? '#f8f8f8' : '#ffffff'};">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;font-weight:500;">${label}</td>
          <td align="right" style="color:#1a1a1a;font-size:13px;font-weight:600;">${valor}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/**
 * Genera email agrupado para varios modelos del mismo cliente
 */
export function generarEmailAgrupado({ modelos, razonSocial, portalUrl }) {
  const portal = portalUrl || 'https://portal.taxea.es';
  const fechaStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const filasModelos = modelos.map((m, i) => {
    const nombre = MODELO_NOMBRES[m.modeloKey] || m.modeloKey?.replace(/_/g, ' ').toUpperCase() || 'Declaración';
    const periodo = [m.ejercicio, m.periodo].filter(Boolean).join(' · ');
    const importe = m.importe ? formatEuro(m.importe) : '';
    return `<tr>
      <td style="padding:14px 24px;border-bottom:1px solid #ebebeb;background:${i % 2 === 0 ? '#f8f8f8' : '#ffffff'};">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="color:#1a1a1a;font-size:13px;font-weight:600;margin:0;">✅ &nbsp;${nombre}</p>
              ${periodo ? `<p style="color:#888888;font-size:11px;margin:3px 0 0;">${periodo}</p>` : ''}
            </td>
            ${importe ? `<td align="right" style="color:#1a1a1a;font-size:13px;font-weight:700;">${importe}</td>` : ''}
          </tr>
        </table>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Obligaciones fiscales presentadas — Taxea Strategies</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0d0d0d 0%,#1a1a1a 50%,#0d0d0d 100%);border-radius:16px 16px 0 0;padding:48px 40px 40px;text-align:center;">
            <div style="margin-bottom:28px;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#8b1a2b;width:6px;height:48px;border-radius:3px;vertical-align:top;"></td>
                  <td style="width:14px;"></td>
                  <td style="vertical-align:middle;padding-bottom:4px;">
                    <div style="font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-1px;line-height:1;">TAXEA</div>
                    <div style="font-size:11px;font-weight:400;color:#888888;letter-spacing:3px;text-transform:uppercase;margin-top:3px;">STRATEGIES</div>
                  </td>
                </tr>
              </table>
            </div>
            <div style="width:48px;height:2px;background-color:#8b1a2b;margin:0 auto 28px;border-radius:1px;"></div>
            <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 12px;line-height:1.3;">
              Tus obligaciones fiscales han sido<br>gestionadas correctamente
            </h1>
            <p style="color:#999999;font-size:14px;margin:0;line-height:1.6;">
              Taxea Strategies ha presentado ${modelos.length} obligaciones fiscales ante la Administración Tributaria.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#111111;padding:20px 40px;text-align:center;border-left:1px solid #222;border-right:1px solid #222;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background-color:#0d2a1a;border:1px solid #1a5c33;border-radius:100px;padding:10px 24px;">
                  <span style="color:#34d399;font-size:13px;font-weight:600;letter-spacing:0.5px;">✅ &nbsp;${modelos.length} MODELOS PRESENTADOS — ${fechaStr.toUpperCase()}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 24px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
            <p style="color:#1a1a1a;font-size:15px;margin:0 0 24px;line-height:1.6;">
              ${razonSocial ? `Estimado cliente de <strong>${razonSocial}</strong>,` : 'Estimado cliente,'}
            </p>
            <h3 style="color:#1a1a1a;font-size:13px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Modelos presentados</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ebebeb;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              ${filasModelos}
            </table>
            <p style="color:#555555;font-size:14px;line-height:1.7;margin:0 0 24px;">
              Todos los modelos han sido presentados correctamente. <strong>No necesitas realizar ninguna acción adicional.</strong>
              Los justificantes están disponibles en tu portal privado.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:0 40px 32px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background-color:#8b1a2b;border-radius:8px;">
                  <a href="${portal}/obligaciones" style="display:inline-block;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 36px;letter-spacing:0.3px;">
                    Ver obligaciones en Taxea Portal →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f8f8;padding:28px 40px;border:1px solid #e5e5e5;border-top:none;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" style="vertical-align:top;padding-top:2px;">
                  <div style="width:32px;height:32px;background:#0d0d0d;border-radius:50%;text-align:center;line-height:32px;font-size:14px;">🛡</div>
                </td>
                <td style="padding-left:12px;">
                  <p style="color:#1a1a1a;font-size:13px;font-weight:700;margin:0 0 4px;">Tus impuestos están al día</p>
                  <p style="color:#666666;font-size:13px;margin:0;line-height:1.6;">
                    En Taxea Strategies supervisamos continuamente tu situación fiscal para que puedas centrarte en tu negocio con total tranquilidad.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#0d0d0d;padding:32px 40px;border-radius:0 0 16px 16px;text-align:center;">
            <p style="color:#ffffff;font-size:14px;font-weight:600;margin:0 0 2px;">Alexis Expósito Acosta</p>
            <p style="color:#666666;font-size:12px;margin:0 0 20px;letter-spacing:0.5px;">CEO & Founder — Taxea Strategies</p>
            <div style="width:32px;height:1px;background:#333333;margin:0 auto 20px;"></div>
            <p style="color:#555555;font-size:12px;margin:0 0 16px;line-height:1.6;">Gracias por confiar en Taxea Strategies como <em>partner</em> fiscal y contable de tu actividad.</p>
            <p style="color:#333333;font-size:11px;margin:0;">© ${new Date().getFullYear()} Taxea Strategies — <a href="${portal}" style="color:#8b1a2b;text-decoration:none;">taxea.es</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}