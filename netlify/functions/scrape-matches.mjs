// Netlify Scheduled Function — runs every 5 minutes
// Schedule: "*/5 * * * *"
import { schedule } from "@netlify/functions";

const LNH_URL = "https://www.lnh.fr";

// TV channel mapping based on logo filenames seen on lnh.fr
const TV_CHANNELS = {
  hd1: { name: "beIN Sports 1", color: "#000", logo: "bein1" },
  hd2: { name: "beIN Sports 2", color: "#000", logo: "bein2" },
  hd3: { name: "beIN Sports 3", color: "#000", logo: "bein3" },
  "bein-web": { name: "beIN Sports", color: "#000", logo: "bein" },
  "10max": { name: "beIN Sports Max 10", color: "#000", logo: "bein-max" },
  htvsmall: { name: "HandballTV", color: "#e30613", logo: "htv" },
  tf1: { name: "TF1", color: "#003399", logo: "tf1" },
  m6: { name: "M6", color: "#ff6600", logo: "m6" },
  "l-equipe": { name: "L'Équipe", color: "#003366", logo: "lequipe" },
  canal: { name: "Canal+", color: "#000", logo: "canal" },
  eurosport: { name: "Eurosport", color: "#ff6600", logo: "eurosport" },
};

function detectChannel(imgSrc) {
  if (!imgSrc) return null;
  const src = imgSrc.toLowerCase();
  for (const [key, channel] of Object.entries(TV_CHANNELS)) {
    if (src.includes(key)) return channel;
  }
  return null;
}

function parseStatus(match) {
  const now = new Date();
  if (!match.datetime) return "upcoming";
  const matchTime = new Date(match.datetime);
  const diffMs = now - matchTime;
  const diffMin = diffMs / 60000;
  if (match.scoreHome !== null && match.scoreAway !== null) return "finished";
  if (diffMin >= 0 && diffMin < 120) return "live";
  if (diffMin < 0) return "upcoming";
  return "finished";
}

async function fetchMatches() {
  const res = await fetch(LNH_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; HandballTV-App/1.0)" },
  });
  const html = await res.text();

  // Simple regex-based extraction from the LNH homepage match cards
  const matches = [];

  // Extract match blocks — look for the card pattern in the HTML
  // Each match card contains: competition, datetime, teams, score, TV logo
  const cardRegex =
    /<div[^>]*class="[^"]*(?:match-card|calendrier-item|match-item)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*(?:match-card|calendrier-item|match-item)|<\/section|<\/div>\s*<\/div>\s*<\/div>\s*(?:<!--|\n\s*\n))/gi;

  // Fallback: parse the full page HTML for match data
  // Look for competition label
  const competitionBlocks = html.split(
    /(?=Liqui Moly StarLigue|ProLigue|Ligue des Champions|European League|Coupe de France)/
  );

  // Parse using the actual structure seen in the LNH page
  // Match blocks contain TV logo img tags + team names + scores
  const teamPattern =
    /<img[^>]*alt="logo ([^"]+)"[^>]*>[\s\S]*?<\/a>\s*\n\s*([\w\s\-éèêëàâùûüôîïç]+)\s*\n/gi;

  // More reliable: find all match entries between "derniers résultats" and "prochains matchs" markers
  // Using a targeted approach for the specific HTML structure of lnh.fr

  const matchBlockRegex =
    /(?:Liqui Moly StarLigue|ProLigue|European League|Ligue des Champions|Coupe de France)[^\n]*[-–]\s*[^\n]*\n[\s\S]*?(?=(?:Liqui Moly|ProLigue|European|Ligue des|Coupe de|calendrier complet))/gi;

  return extractMatchesFromHtml(html);
}

function extractMatchesFromHtml(html) {
  const matches = [];
  let id = 1;

  // Split HTML into match sections by looking for competition+round headers
  // These appear right before each match card on lnh.fr
  const sections = html.split(
    /(?=(?:Liqui Moly StarLigue|ProLigue|European League|Ligue des Champions|Coupe de France)[^\n<]*(?:J\d+|1\/\d+)[^\n<]*)/
  );

  for (const section of sections) {
    // Extract competition and round
    const compMatch = section.match(
      /(Liqui Moly StarLigue|ProLigue|European League|Ligue des Champions|Coupe de France)[^\n<]*?(J\d+|1\/\d+[^<\n]*)/
    );
    if (!compMatch) continue;

    const competition = compMatch[1].trim();
    const round = compMatch[2].trim();

    // Extract date/time
    const dateMatch = section.match(
      /(?:lun|mar|mer|jeu|ven|sam|dim)\.\s+(\d+\s+\w+)\s+(\d{2}h\d{2})/i
    );
    const datetime = dateMatch ? `${dateMatch[1]} ${dateMatch[2]}` : null;

    // Extract TV channel logo
    const tvMatch = section.match(
      /<img[^>]*src="[^"]*\/televisions\/([^"_]+)[^"]*"[^>]*>/i
    );
    const tvKey = tvMatch ? tvMatch[1].toLowerCase() : null;
    const tvChannel = tvKey ? detectChannel(tvKey) : null;

    // Extract team names
    const teamMatches = [
      ...section.matchAll(/alt="logo ([^"]+)"[\s\S]*?<\/a>\s*\n\s*([^\n<]+)/g),
    ];
    if (teamMatches.length < 2) continue;

    const homeTeam = teamMatches[0]?.[2]?.trim();
    const awayTeam = teamMatches[1]?.[2]?.trim();
    if (!homeTeam || !awayTeam) continue;

    // Extract score if exists
    const scoreMatch = section.match(/(\d+)\s*[-–]\s*(\d+)/);
    const scoreHome = scoreMatch ? parseInt(scoreMatch[1]) : null;
    const scoreAway = scoreMatch ? parseInt(scoreMatch[2]) : null;

    // Extract home team logo URL
    const logoMatches = [
      ...section.matchAll(
        /src="(https:\/\/www\.lnh\.fr\/medias\/sports_teams\/[^"]+)"/g
      ),
    ];

    matches.push({
      id: id++,
      competition,
      round,
      datetime,
      homeTeam,
      awayTeam,
      homeLogo: logoMatches[0]?.[1] || null,
      awayLogo: logoMatches[1]?.[1] || null,
      scoreHome,
      scoreAway,
      tvChannel,
      tvOnly: tvChannel !== null,
    });
  }

  return matches;
}

const handler = schedule("*/5 * * * *", async (event) => {
  try {
    const matches = await fetchMatches();
    console.log(`Scraped ${matches.length} matches from lnh.fr`);
    // In production, you'd store this in a KV store or Netlify Blobs
    // For now, the on-demand function handles the scraping
    return { statusCode: 200 };
  } catch (err) {
    console.error("Scraping error:", err);
    return { statusCode: 500 };
  }
});

export { handler, fetchMatches, detectChannel };
