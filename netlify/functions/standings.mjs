const HIGHLIGHTLY_KEY = process.env.HIGHLIGHTLY_KEY;

const LEAGUES = {
  starligue: { id: 29718, name: "Liqui Moly StarLigue", season: 2025 },
  proligue:  { id: 31420, name: "ProLigue",             season: 2025 },
  champions: { id: 132,   name: "Ligue des Champions",  season: 2025 },
  european:  { id: 145,   name: "European League",      season: 2025 },
};

export default async (req) => {
  const url = new URL(req.url);
  const leagueKey = url.searchParams.get("league") || "starligue";
  const league = LEAGUES[leagueKey] || LEAGUES.starligue;

  try {
    const res = await fetch(
      `https://handball.highlightly.net/standings?leagueId=${league.id}&season=${league.season}`,
      {
        headers: {
          "x-rapidapi-key": HIGHLIGHTLY_KEY,
          "x-rapidapi-host": "handball-highlights-api.p.rapidapi.com",
        },
      }
    );
    const data = await res.json();
    const standings = data?.groups?.[0]?.standings || [];

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
