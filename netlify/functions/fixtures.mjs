// Netlify Function: GET /api/fixtures
// Fetches upcoming matches from Highlightly for Starligue and ProLigue

const HIGHLIGHTLY_KEY = process.env.HIGHLIGHTLY_KEY;

const LEAGUES = [
  { id: 29718, name: "Liqui Moly StarLigue", short: "Starligue", flag: "🇫🇷" },
  { id: 31420, name: "ProLigue", short: "ProLigue", flag: "🇫🇷" },
];

// Logo mapping from lnh.fr for known teams
const LNH_LOGOS = {
  "PSG": "https://www.lnh.fr/medias/sports_teams/paris__logo__2024-2025.png",
  "Nantes": "https://www.lnh.fr/medias/sports_teams/nantes__logo__2023-2024.png",
  "Montpellier": "https://www.lnh.fr/medias/sports_teams/montpellier__logo__2024-2025.png",
  "Chambéry Savoie": "https://www.lnh.fr/medias/sports_teams/chambery__logo__2024-2025.png",
  "Saint-Raphaël Var Handball": "https://www.lnh.fr/medias/sports_teams/saint-raphael__logo__2024-2025.png",
  "Fenix Toulouse Handball": "https://www.lnh.fr/medias/sports_teams/toulouse__logo__2023-2024.png",
  "Tremblay": "https://www.lnh.fr/medias/sports_teams/tremblay__logo__2023-2024.png",
  "Provence Aix": "https://www.lnh.fr/medias/sports_teams/aix__logo__2025-2026.png",
  "Cesson-Rennes Métropole": "https://www.lnh.fr/medias/sports_teams/cesson__logo__2023-2024.png",
  "USAM Nîmes Gard": "https://www.lnh.fr/medias/sports_teams/nimes__logo__2025-2026.png",
  "Selestat Alsace Handball": "https://www.lnh.fr/medias/sports_teams/selestat__logo__2023-2024.png",
  "Dunkerque": "https://www.lnh.fr/medias/sports_teams/dunkerque__logo__2023-2024.png",
  "Chartres": "https://www.lnh.fr/medias/sports_teams/chartres__logo__2023-2024.png",
  "Dijon": "https://www.lnh.fr/medias/sports_teams/dijon__logo__2023-2024.png",
  "Istres": "https://www.lnh.fr/medias/sports_teams/istres__logo__2023-2024.png",
  "Limoges": "https://www.lnh.fr/medias/sports_teams/limoges__logo__2023-2024.png",
  "Pau Billere": "https://www.lnh.fr/medias/sports_teams/pau-billere__logo__2024-2025.png",
  "Pau Billère": "https://www.lnh.fr/medias/sports_teams/pau-billere__logo__2024-2025.png",
  "Ivry": "https://www.lnh.fr/medias/sports_teams/ivry__logo__2023-2024.png",
  "Caen Handball": "https://www.lnh.fr/medias/sports_teams/caen__logo__2024-2025.png",
  "US Créteil": "https://www.lnh.fr/medias/sports_teams/creteil__logo__2025-2026.png",
  "Massy Essonne HB": "https://www.lnh.fr/medias/sports_teams/massy__logo__2023-2024.png",
  "Pontault-Combault Handball": "https://www.lnh.fr/medias/sports_teams/pontault__logo__2023-2024.png",
  "Cherbourg": "https://www.lnh.fr/medias/sports_teams/cherbourg__logo__2023-2024.png",
  "Frontignan": "https://www.lnh.fr/medias/sports_teams/frontignan__logo__2023-2024.png",
  "Valence": "https://www.lnh.fr/medias/sports_teams/valence__logo__2024-2025.png",
  "Besançon": "https://www.lnh.fr/medias/sports_teams/besancon__logo__2023-2024.png",
  "Sarrebourg": "https://www.lnh.fr/medias/sports_teams/sarrebourg__logo__2023-2024.png",
  "Saran Loiret Handball": "https://www.lnh.fr/medias/sports_teams/saran__logo__2024-2025.png",
  "Angers": "https://www.lnh.fr/medias/sports_teams/angers__logo__2023-2024.png",
  "Saintes": "https://www.lnh.fr/medias/sports_teams/saintes__logo__2025-2026.png",
};

function inferStatus(dateStr, descr) {
  const d = descr?.toLowerCase() || '';
  if (d.includes('finished') || d.includes('ended')) return 'finished';
  if (d.includes('in progress') || d.includes('half time')) return 'live';
  // "Not started" → rely on datetime
  // Highlightly dates are in UTC, France is UTC+2
  // So a match at 20h00 France = 18h00 UTC
  // We compare UTC timestamps directly
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
        const isoFr = utcDate.toISOString();

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
          homeLogo: m.homeTeam?.logo?.replace('https://highlightly.net', 'https://www.highlightly.net') || LNH_LOGOS[m.homeTeam?.name] || null,
          awayLogo: m.awayTeam?.logo?.replace('https://highlightly.net', 'https://www.highlightly.net') || LNH_LOGOS[m.awayTeam?.name] || null,
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
// Also check reverse — tvsports may use city name instead of club name
const homeWords = home.split(' ');
const awayWords = away.split(' ');
const homeMatches = homeWords.some(w => w.length > 3 && eventName.includes(w));
const awayMatches = awayWords.some(w => w.length > 3 && eventName.includes(w));
if (homeMatches || awayMatches) {
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
