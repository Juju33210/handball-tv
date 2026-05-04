// Netlify Function: GET /api/standings?league=LEAGUE_ID
// Fetches standings from API-Sports handball

const API_KEY = process.env.API_SPORTS_KEY;
const BASE_URL = "https://v1.handball.api-sports.io";

// League IDs on API-Sports
const LEAGUES = {
  starligue: { id: 5, name: "Liqui Moly StarLigue", season: 2025 },
  proligue:  { id: 6, name: "ProLigue", season: 2025 },
  champions: { id: 1, name: "Ligue des Champions", season: 2025 },
  european:  { id: 3, name: "European League", season: 2025 },
};

export default async (req) => {
  const url = new URL(req.url);
  const leagueKey = url.searchParams.get("league") || "starligue";
  const league = LEAGUES[leagueKey] || LEAGUES.starligue;

  try {
    const res = await fetch(
      `${BASE_URL}/standings?league=${league.id}&season=${league.season}`,
      {
        headers: {
          "x-apisports-key": API_KEY,
          "x-rapidapi-host": "v1.handball.api-sports.io",
        },
      }
    );
    const data = await res.json();

    // Extract standings array
    const raw = data?.response?.[0]?.[0] || data?.response?.[0] || [];
    const standings = (Array.isArray(raw) ? raw : []).map((team) => ({
      rank: team.position,
      name: team.team?.name,
      logo: team.team?.logo,
      played: team.games?.played,
      won: team.games?.win?.total,
      drawn: team.games?.draw?.total,
      lost: team.games?.lose?.total,
      goalsFor: team.goals?.for,
      goalsAgainst: team.goals?.against,
      points: team.points,
    }));

    return new Response(
      JSON.stringify({ standings, league: league.name, updatedAt: new Date().toISOString() }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, standings: [] }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = { path: "/api/standings" };
