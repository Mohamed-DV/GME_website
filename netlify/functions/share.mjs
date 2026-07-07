// Renders a lightweight HTML page with Open Graph / Twitter meta tags so that
// shared listing links show a rich preview (title, description, thumbnail) in
// WhatsApp, Facebook, Messenger, etc. Real visitors are redirected to the SPA.

const API = process.env.GME_API || 'https://gme-xoap.onrender.com';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function handler(event) {
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host;
  const origin = `${proto}://${host}`;

  // id can arrive via /s/:id  or  ?id=
  let id = (event.queryStringParameters && event.queryStringParameters.id) || '';
  if (!id && event.path) {
    const m = event.path.match(/\/s\/([^/?]+)/);
    if (m) id = m[1];
  }

  const spaUrl = `${origin}/?item=${encodeURIComponent(id)}`;
  const redirect = `<script>location.replace(${JSON.stringify(spaUrl)});</script>`;

  try {
    const res = await fetch(`${API}/api/listings/${id}`);
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    const l = data.listing || data;
    const d = l.details || {};

    const price = d.price != null ? `${Number(d.price).toLocaleString('fr-FR')} MAD` : '';
    const title = `${l.title}${price ? ' — ' + price : ''}`;
    const descBits = [d.brand, d.model, d.year, d.fuelType, d.mileage ? d.mileage.toLocaleString('fr-FR') + ' km' : '', l.city]
      .filter(Boolean)
      .join(' · ');
    const description = [descBits, l.description].filter(Boolean).join(' — ') || 'GME Automobile';
    const hasImg = (l.images || []).filter(Boolean).length > 0;
    const image = hasImg ? `${origin}/api/listing-image?id=${encodeURIComponent(id)}&i=0` : `${origin}/`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} | GME Automobile</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GME Automobile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(spaUrl)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="900">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(spaUrl)}">
</head>
<body style="background:#0a0a0a;color:#fff;font-family:sans-serif;text-align:center;padding:3rem">
<p>Redirection vers GME Automobile…</p>
<p><a href="${esc(spaUrl)}" style="color:#E8192C">Voir l'annonce</a></p>
${redirect}
</body>
</html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      body: html,
    };
  } catch (err) {
    // Fallback: still redirect the human to the app
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>GME Automobile</title></head><body>${redirect}<a href="${esc(spaUrl)}">GME Automobile</a></body></html>`,
    };
  }
}
