// Netlify Function: GET /api/live-scores
// Fetches live scores from SofaScore (unofficial API)

export default async (req) => {
  try {
    const today = new Date().toISOString().substring(0, 10);
    const res = await fetch(
      `https://api.sofascore.com/api/v1/sport/handball/scheduled-events/${today}`,
      {
        headers: {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://www.sofascore.com',
  'Referer': 'https://www.sofascore.com/',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
}
      }
    );
    const data = await res.json();
    const events = data.events || [];

    const scores = events.map(e => ({
      id: e.id,
      homeTeam: e.homeTeam?.name,
      awayTeam: e.awayTeam?.name,
      homeScore: e.homeScore?.current ?? null,
      awayScore: e.awayScore?.current ?? null,
      homePeriod1: e.homeScore?.period1 ?? null,
      awayPeriod1: e.awayScore?.period1 ?? null,
      status: e.status?.type || 'notstarted',
      statusDescription: e.status?.description || '',
      minute: e.time?.played ? Math.floor(e.time.played / 60) : null,
    }));

    return new Response(
      JSON.stringify({ scores, date: today, scrapedAt: new Date().toISOString() }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, scores: [] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const config = { path: "/api/live-scores" };
