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
            if (!isHandball(event.name, event.publishedOn?.name)) continue;

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
          'Cache-Control': 'no-cache',
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

function isHandball(name, channel) {
  const n = name.toLowerCase();
  const c = (channel || '').toLowerCase();

  // Exclude obvious football channels
  const footballChannels = ['ligue 1', 'ligue1', 'bein sports 4', 'bein sports 5',
    'bein sports 6', 'bein sports 7', 'bein sports 8', 'bein sports 9',
    'canal +', 'canal+', 'tnt sports', 'prime video', 'amazon'];
  if (footballChannels.some(k => c.includes(k))) return false;

  // Exclude obvious football keywords in name
  const footballNames = ['fc barcelone - real', 'fc barcelone - madrid',
    'real madrid', 'liga', 'bundesliga', 'serie a', 'premier league',
    'red star -', '- red star', 'fc séville', 'espanyol',
    'lens -', '- lens', 'paris fc', 'paris-sg -', '- paris-sg'];
  if (footballNames.some(k => n.includes(k))) return false;

  // Must match handball keywords OR handball-specific channels
  const handballKeywords = ['handball', 'starligue', 'proligue', 'ehf',
    'hbc nantes', 'psg hand', 'paris hand', 'chambéry', 'chambery',
    'montpellier hb', 'dunkerque', 'limoges', 'saint-raphaël',
    'toulouse handball', 'fenix', 'tremblay', 'chartres', 'sélestat',
    'selestat', 'nîmes hand', 'aix handball', 'dijon hand', 'istres'];
  const handballChannels = ['eurosport', 'handball'];
  
  return handballKeywords.some(k => n.includes(k)) ||
         handballChannels.some(k => c.includes(k));
}

export const config = { path: "/api/tv-program" };
