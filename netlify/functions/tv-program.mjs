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
      const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const dateStr = `${date.getDate()}-${MONTHS_FR[date.getMonth()]}-${date.getFullYear()}`;

      const res = await fetch(`https://www.tvsports.fr/programme-tele/${dateStr}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        }
      });

      console.log(`Fetching ${dateStr}: status ${res.status}`);
if (!res.ok) continue;
const html = await res.text();
console.log(`HTML length for ${dateStr}: ${html.length}`);
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
  // Positive keywords — specific to handball
  const handballKeywords = [
    'handball', 'starligue', 'proligue', 'ehf',
    'hbc nantes', 'psg hand', 'paris hand',
    'chambéry', 'chambery', 'montpellier hb',
    'dunkerque', 'limoges', 'saint-raphaël', 'saint raphael',
    'toulouse handball', 'fenix', 'tremblay',
    'chartres', 'sélestat', 'selestat', 'nîmes hand', 'nimes hand',
    'aix handball', 'dijon hand', 'istres',
  ];
  // Negative keywords — exclude football/other sports
  const excludeKeywords = [
    'fc barcelone - real', 'fc barcelone - madrid',
    'lens -', '- lens', 'red star',
    'fc séville', 'espanyol', 'liga', 'ligue 1',
  ];
  const n = name.toLowerCase();
  if (excludeKeywords.some(k => n.includes(k))) return false;
  return handballKeywords.some(k => n.includes(k));
}

export const config = { path: "/api/tv-program" };
