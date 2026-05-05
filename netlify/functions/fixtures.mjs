// Netlify Function: GET /api/fixtures
// Fetches upcoming matches from Highlightly for Starligue and ProLigue

const HIGHLIGHTLY_KEY = process.env.HIGHLIGHTLY_KEY;

const LEAGUES = [
  { id: 29718, name: "Liqui Moly StarLigue", short: "Starligue", flag: "🇫🇷" },
  { id: 31420, name: "ProLigue", short: "ProLigue", flag: "🇫🇷" },
];

function inferStatus(dateStr, descr) {
  const d = descr?.toLowerCase() || '';
  if (d.includes('finished') || d.includes('ended')) return 'finished';
  if (d.includes('started') || d.includes('live') || d.includes('half')) return 'live';
  const now = Date.now();
  const matchMs = new Date(dateStr).getTime();
  const diffMin = (now - matchMs) / 60000;
  if (diffMin < 0) return 'upcoming';
  if (diffMin < 105) return 'live';
  return 'finished';
}

export default async (req) => {
  try {
    const allMatches = [];

    for (const league of LEAGUES) {
      const res = await fetch(
        `https://handball.highlightly.net/matches?leagueId=${league.id}&season=2025`,
        {
          headers: {
            'x-rapidapi-key': HIGHLIGHTLY_KEY,
            'x-rapidapi-host': 'handball-highlights-api.p.rapidapi.com',
          },
        }
      );
      const data = await res.json();
      const matches = data.data || [];

      for (const m of matches) {
        // Convert UTC to France timezone (UTC+2)
        const utcDate = new Date(m.date);
        const frDate = new Date(utcDate.getTime());
        const isoFr = frDate.toISOString();

        const status = inferStatus(m.date, m.state?.description);
        const scoreHome = m.state?.score?.current
          ? parseInt(m.state.score.current.split(':')[0])
          : null;
        const scoreAway = m.state?.score?.current
          ? parseInt(m.state.score.current.split(':')[1])
          : null;

        allMatches.push({
          id: m.id,
          competition: league.name,
          competitionShort: league.short,
          competitionFlag: league.flag,
          round: m.week ? `J${m.week}` : '',
          datetime: isoFr,
          homeTeam: m.homeTeam?.name,
          awayTeam: m.awayTeam?.name,
          homeLogo: m.homeTeam?.logo || null,
          awayLogo: m.awayTeam?.logo || null,
          scoreHome,
          scoreAway,
          tvChannel: null,
          tvChannels: [],
          tvOnly: false,
          status,
          isStarMatch: false,
          source: 'highlightly',
        });
      }
    }

    // Filter only upcoming matches beyond today
    const now = new Date();
    const upcoming = allMatches
      .filter(m => new Date(m.datetime) > now)
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    // Enrich with TV channels from tvsports.fr
    try {
      const tvRes = await fetch('https://handball-tv.netlify.app/api/tv-program');
      const tvData = await tvRes.json();
      const tvEvents = tvData.events || [];

      for (const match of upcoming) {
        const matchTime = new Date(match.datetime).getTime();
        const home = match.homeTeam?.toLowerCase() || '';
        const away = match.awayTeam?.toLowerCase() || '';

        for (const event of tvEvents) {
          const eventTime = new Date(event.startDate).getTime();
          const diffMin = Math.abs(matchTime - eventTime) / 60000;
          if (diffMin > 60) continue;

          const eventName = event.name.toLowerCase();
          const homeShort = home.split(' ')[0];
          const awayShort = away.split(' ')[0];

          if (eventName.includes(homeShort) || eventName.includes(awayShort)) {
            const ch = {
              name: event.channel,
              short: event.channel?.replace('beIN Sports', 'beIN').replace('Eurosport', 'Euro'),
              cssClass: event.channel?.toLowerCase().includes('bein') ? 'bein' :
                        event.channel?.toLowerCase().includes('eurosport') ? 'other' :
                        event.channel?.toLowerCase().includes('handball') ? 'htv' : 'other',
              logo: event.channelLogo,
            };
            match.tvChannel = ch;
            match.tvChannels = [ch];
            match.tvOnly = true;
            break;
          }
        }
      }
    } catch (e) {
      console.error('TV enrichment failed:', e);
    }

    return new Response(
      JSON.stringify({ matches: upcoming, total: upcoming.length, scrapedAt: new Date().toISOString() }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, matches: [] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const config = { path: "/api/fixtures" };
