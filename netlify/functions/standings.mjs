const HIGHLIGHTLY_KEY = process.env.HIGHLIGHTLY_KEY;

const LEAGUES = {
  starligue: { id: 29718, name: "Liqui Moly StarLigue", season: 2025 },
  proligue:  { id: 31420, name: "ProLigue",             season: 2025 },
  champions: { id: 132,   name: "Ligue des Champions",  season: 2025 },
  european:  { id: 145,   name: "European League",      season: 2025 },
};

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
    const standings = (data?.groups?.[0]?.standings || []).map(t => ({
  ...t,
  team: {
    ...t.team,
    logo: t.team.logo || LNH_LOGOS[t.team.name] || null,
  }
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
