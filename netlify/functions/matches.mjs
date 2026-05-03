// Netlify Function: GET /api/matches
// Scrapes lnh.fr on demand and returns structured match data

const LNH_URL = "https://www.lnh.fr";

const TV_CHANNELS = {
  hd1: { name: "beIN Sports 1", short: "beIN 1", color: "#1a1a2e", accent: "#f0c040" },
  hd2: { name: "beIN Sports 2", short: "beIN 2", color: "#1a1a2e", accent: "#f0c040" },
  hd3: { name: "beIN Sports 3", short: "beIN 3", color: "#1a1a2e", accent: "#f0c040" },
  "bein-web": { name: "beIN Sports", short: "beIN", color: "#1a1a2e", accent: "#f0c040" },
  "10max": { name: "beIN Max 10", short: "beIN Max", color: "#1a1a2e", accent: "#f0c040" },
  htvsmall: { name: "Handball TV", short: "HTV", color: "#e30613", accent: "#fff" },
  tf1: { name: "TF1", color: "#003399", accent: "#fff", short: "TF1" },
  m6: { name: "M6", color: "#ff6600", accent: "#fff", short: "M6" },
  "l-equipe": { name: "L'Équipe", color: "#003366", accent: "#fff", short: "L'Éq." },
  canal: { name: "Canal+", color: "#111", accent: "#fff", short: "C+" },
  eurosport: { name: "Eurosport", color: "#003087", accent: "#ff6600", short: "Euro" },
};

function detectChannel(imgSrc) {
  if (!imgSrc) return null;
  const src = imgSrc.toLowerCase();
  // Order matters — more specific keys first
  if (src.includes("10max")) return TV_CHANNELS["10max"];
  if (src.includes("bein-web")) return TV_CHANNELS["bein-web"];
  if (src.includes("hd1")) return TV_CHANNELS["hd1"];
  if (src.includes("hd2")) return TV_CHANNELS["hd2"];
  if (src.includes("hd3")) return TV_CHANNELS["hd3"];
  if (src.includes("htvsmall") || src.includes("htv")) return TV_CHANNELS["htvsmall"];
  if (src.includes("tf1")) return TV_CHANNELS["tf1"];
  if (src.includes("m6")) return TV_CHANNELS["m6"];
  if (src.includes("l-equipe") || src.includes("lequipe")) return TV_CHANNELS["l-equipe"];
  if (src.includes("canal")) return TV_CHANNELS["canal"];
  if (src.includes("eurosport")) return TV_CHANNELS["eurosport"];
  return null;
}

const COMP_META = {
  "Liqui Moly StarLigue": { short: "Starligue", flag: "🇫🇷", level: 1 },
  ProLigue: { short: "ProLigue", flag: "🇫🇷", level: 2 },
  "Ligue des Champions": { short: "Champions", flag: "🏆", level: 0 },
  "European League": { short: "Eur. League", flag: "🌍", level: 0 },
  "Coupe de France": { short: "Coupe de Fr.", flag: "🇫🇷", level: 1 },
};

function parseDateTime(dayStr, timeStr) {
  if (!dayStr || !timeStr) return null;
  // dayStr example: "sam. 02 mai"  timeStr: "20h00"
  const months = {
    jan: 0, fév: 1, mar: 2, avr: 3, mai: 4, juin: 5,
    juil: 6, août: 7, sep: 8, oct: 9, nov: 10, déc: 11,
  };
  const parts = dayStr.replace(/[a-z]+\.\s*/i, "").trim().split(/\s+/);
  const day = parseInt(parts[0]);
  const monthKey = parts[1]?.toLowerCase().substring(0, 3);
  const month = months[monthKey] ?? new Date().getMonth();
  const year = new Date().getFullYear();
  const [h, m] = timeStr.replace("h", ":").split(":").map(Number);
  const dt = new Date(year, month, day, h, m || 0);
  return dt.toISOString();
}

function inferStatus(isoDatetime, hasScore) {
  if (hasScore) return "finished";
  if (!isoDatetime) return "upcoming";
  const now = Date.now();
  const matchMs = new Date(isoDatetime).getTime();
  const diffMin = (now - matchMs) / 60000;
  if (diffMin >= 0 && diffMin < 105) return "live";
  if (diffMin < 0) return "upcoming";
  return "finished";
}

async function scrapeMatches() {
  const res = await fetch(LNH_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`LNH fetch failed: ${res.status}`);
  const html = await res.text();
  return parseMatchesFromHtml(html);
}

function parseMatchesFromHtml(html) {
  const matches = [];
  let id = 1;

  // The LNH homepage lists match cards.
  // Each card has a structure with competition label, date, TV logo(s), teams, score.
  // We split by the competition+round header pattern.
  
  // Find all "competition - round\nday time" blocks and their following content
  const blockRegex =
    /((?:Liqui Moly StarLigue|ProLigue|European League|Ligue des Champions|Coupe de France)[^<\n]*?(?:J\d+|1\/\d+[^<\n]*))\s*\n\s*((?:lun|mar|mer|jeu|ven|sam|dim)\.[^\n]+)\n([\s\S]*?)(?=(?:Liqui Moly StarLigue|ProLigue|European League|Ligue des Champions|Coupe de France)[^<\n]*?(?:J\d+|1\/\d+)|calendrier complet)/gi;

  let m;
  while ((m = blockRegex.exec(html)) !== null) {
    const compRound = m[1].trim();
    const dateTimeLine = m[2].trim();
    const body = m[3];

    // Parse competition name
    const compNameMatch = compRound.match(
      /^(Liqui Moly StarLigue|ProLigue|European League|Ligue des Champions|Coupe de France)/
    );
    const competition = compNameMatch ? compNameMatch[1] : "Handball";

    // Parse round
    const roundMatch = compRound.match(/(J\d+|1\/\d+[^\s]*|\d+\/\d+[^\s]*)/);
    const round = roundMatch ? roundMatch[1] : "";

    // Parse date and time
    const dayMatch = dateTimeLine.match(
      /((?:lun|mar|mer|jeu|ven|sam|dim)\.\s+\d+\s+\w+)/i
    );
    const timeMatch = dateTimeLine.match(/(\d{2}h\d{2})/);
    const datetime = parseDateTime(
      dayMatch?.[1] || null,
      timeMatch?.[1] || null
    );

    // Parse TV channel(s) — can be multiple
    const tvImgs = [...body.matchAll(/src="([^"]*televisions[^"]+)"/gi)];
    const tvChannels = tvImgs
      .map((t) => detectChannel(t[1]))
      .filter(Boolean)
      .filter((v, i, a) => a.findIndex((x) => x.name === v.name) === i); // deduplicate

    const tvChannel = tvChannels[0] || null;

    // Parse team logos and names
    const teamLogoRx = /src="(https:\/\/www\.lnh\.fr\/medias\/sports_teams\/[^"]+)"/g;
    const teamNameRx = /alt="logo ([^"]+)"/g;

    const logos = [...body.matchAll(teamLogoRx)].map((x) => x[1]);
    const names = [...body.matchAll(teamNameRx)].map((x) => x[1].trim());

    if (names.length < 2) continue;

    // Parse score
    const scoreMatch = body.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})/);
    const scoreHome = scoreMatch ? parseInt(scoreMatch[1]) : null;
    const scoreAway = scoreMatch ? parseInt(scoreMatch[2]) : null;
    const hasScore = scoreHome !== null && scoreAway !== null;

    const status = inferStatus(datetime, hasScore);
    const meta = COMP_META[competition] || { short: competition, flag: "🏐", level: 3 };

    // Parse stats/info link
    const linkMatch = body.match(/href="(https:\/\/www\.lnh\.fr\/[^"]+calendriers[^"]+)"/);

    matches.push({
      id: id++,
      competition,
      competitionShort: meta.short,
      competitionFlag: meta.flag,
      competitionLevel: meta.level,
      round,
      datetime,
      homeTeam: names[0],
      awayTeam: names[1],
      homeLogo: logos[0] || null,
      awayLogo: logos[1] || null,
      scoreHome,
      scoreAway,
      tvChannel,
      tvChannels,
      tvOnly: tvChannel !== null,
      status,
      lnhUrl: linkMatch ? linkMatch[1] : LNH_URL,
      isStarMatch: body.includes("STARMATCH"),
    });
  }

  return matches;
}

export default async (req) => {
  try {
    const matches = await scrapeMatches();

    // Sort: live first, then upcoming by date, then finished
    const order = { live: 0, upcoming: 1, finished: 2 };
    matches.sort((a, b) => {
      const statusDiff = order[a.status] - order[b.status];
      if (statusDiff !== 0) return statusDiff;
      if (a.datetime && b.datetime)
        return new Date(a.datetime) - new Date(b.datetime);
      return 0;
    });

    return new Response(JSON.stringify({ matches, scrapedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=180", // cache 3 min
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("matches function error:", err);
    return new Response(JSON.stringify({ error: err.message, matches: [] }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/api/matches" };
