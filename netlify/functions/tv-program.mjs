// Netlify Function: GET /api/tv-program
// Scrapes tvsports.fr for handball TV schedule

export default async (req) => {
  try {
    const results = [];
    const today = new Date();

    // Fetch next 7 days
    for (let i = 0; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

      const res = await fetch(`https://www.tvsports.fr/programme-tele/${dateStr}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        }
      });

      if (!res.ok) continue;
      const html = await res.text();

      // Extract JSON-LD
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      if (!jsonLdMatch) continue;

      for (const block of jsonLdMatch) {
        try {
          const content = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim();
          const data = JSON.parse(content);
          const items = data?.itemListElement || [];

          for (const item of items) {
            const event = item?.item;
            if (!event || event['@type'] !== 'BroadcastEvent') continue;

            const name = event.name?.toLowerCase() || '';
            // Filter handball only
            if (!isHandball(name)) continue;

            results.push({
              name: event.name,
              startDate: event.startDate,
              endDate: event.endDate,
              channel: event.publishedOn?.name || null,
              channelLogo: event.publishedOn?.logo || null,
            });
          }
        } catch (e) { continue; }
      }
    }

    return new Response(
      JSON.stringify({ events: results, scrapedAt: new Date().toISOString() }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, events: [] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

function isHandball(name) {
  const keywords = [
    'handball', 'hand', 'starligue', 'proligue', 'nantes', 'psg hand',
    'montpellier', 'barcelone', 'champions league', 'european league',
    'ehf', 'ligue des champions'
  ];
  return keywords.some(k => name.includes(k));
}

export const config = { path: "/api/tv-program" };
