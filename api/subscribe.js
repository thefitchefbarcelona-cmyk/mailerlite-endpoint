// api/subscribe.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const contentType = (req.headers['content-type'] || '').toLowerCase();
  let email = '';

  try {
    if (contentType.includes('application/json')) {
      // body puede venir ya parseado o como string
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      email = body.email || '';
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // body puede venir como string "email=foo%40bar.com"
      const bodyStr = typeof req.body === 'string' ? req.body : '';
      if (bodyStr) {
        const p = new URLSearchParams(bodyStr);
        email = p.get('email') || '';
      } else {
        email = (req.body && req.body.email) || '';
      }
    } else if (contentType.includes('multipart/form-data')) {
      // Multipart upload (rara para formularios simples). Intentamos leer si ya fue parseado.
      email = req.body?.email || '';
    } else {
      // Fallback: intentar leer req.body
      email = req.body?.email || '';
    }
  } catch (err) {
    console.error('Error parsing body:', err);
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // Validación básica de email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid or missing email' });
  }

  try {
    const apiKey = process.env.MAILERLITE_API_KEY;
    if (!apiKey) {
      console.error('MAILERLITE_API_KEY missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Llamada a MailerLite Connect API
    const resp = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim()
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('MailerLite error:', resp.status, data);
      // devolver mensaje útil para depuración
      return res.status(500).json({ error: 'MailerLite error', details: data });
    }

    // Si la petición viene desde un formulario del navegador (no XHR/fetch), redirigimos a /gracias
    const acceptHeader = (req.headers['accept'] || '').toLowerCase();
    if (!acceptHeader.includes('application/json')) {
      res.writeHead(302, { Location: '/gracias' });
      return res.end();
    }

    // Respuesta JSON para pruebas con fetch/curl
    return res.status(200).json({ success: true, mailerlite: data });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
