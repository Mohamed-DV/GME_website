// Serves a listing image as a real hosted URL (decoded from the base64 data URL
// stored in the backend) so it can be used as an Open Graph preview thumbnail.

const API = process.env.GME_API || 'https://gme-xoap.onrender.com';

export async function handler(event) {
  try {
    const q = event.queryStringParameters || {};
    const id = q.id;
    const index = Math.max(0, parseInt(q.i || '0', 10) || 0);
    if (!id) return { statusCode: 400, body: 'Missing id' };

    const res = await fetch(`${API}/api/listings/${id}`);
    if (!res.ok) return { statusCode: 404, body: 'Listing not found' };
    const data = await res.json();
    const listing = data.listing || data;
    const images = (listing.images || []).filter(Boolean);
    const dataUrl = images[index] || images[0];

    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return { statusCode: 404, body: 'No image' };
    }

    const commaIdx = dataUrl.indexOf(',');
    const meta = dataUrl.slice(0, commaIdx);
    const b64 = dataUrl.slice(commaIdx + 1);
    const mime = (meta.match(/data:(.*?);/) || [])[1] || 'image/jpeg';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
      body: b64,
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, body: 'Image error: ' + err.message };
  }
}
