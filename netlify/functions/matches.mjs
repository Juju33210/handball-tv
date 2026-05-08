// Netlify Function: GET /api/matches
// Scrapes lnh.fr and returns structured match data

const LNH_URL = "https://www.lnh.fr";

const TV_CHANNELS = {
  hd1:       { name: "beIN Sports 1",   short: "beIN 1",   cssClass: "bein", logo: "https://www.tvsports.fr/assets/icons/tv/bein1.webp" },
  hd2:       { name: "beIN Sports 2",   short: "beIN 2",   cssClass: "bein", logo: "https://www.tvsports.fr/assets/icons/tv/bein2.webp" },
  hd3:       { name: "beIN Sports 3",   short: "beIN 3",   cssClass: "bein", logo: "https://www.tvsports.fr/assets/icons/tv/bein3.webp" },
  "bein-web":{ name: "beIN Sports",     short: "beIN",     cssClass: "bein", logo: "https://www.tvsports.fr/assets/icons/tv/bein1.webp" },
  "10max":   { name: "beIN Max 10",     short: "beIN Max", cssClass: "bein", logo: "https://www.tvsports.fr/assets/icons/tv/bein-max10.webp" },
  htvsmall:  { name: "Handball TV",     short: "HTV",      cssClass: "htv",  logo: "https://www.tvsports.fr/assets/icons/tv/handballtv.webp" },
  htv:       { name: "Handball TV",     short: "HTV",      cssClass: "htv",  logo: "https://www.tvsports.fr/assets/icons/tv/handballtv.webp" },
  tf1:       { name: "TF1",             short: "TF1",      cssClass: "free", logo: "https://www.tvsports.fr/assets/icons/tv/tf1.webp" },
  m6:        { name: "M6",              short: "M6",       cssClass: "free", logo: "https://www.tvsports.fr/assets/icons/tv/m6.webp" },
  "l-equipe":{ name: "L'Équipe",        short: "L'Éq.",    cssClass: "free", logo: "https://www.tvsports.fr/assets/icons/tv/lequipe.webp" },
  lequipe:   { name: "L'Équipe",        short: "L'Éq.",    cssClass: "free", logo: "https://www.tvsports.fr/assets/icons/tv/lequipe.webp" },
  canal:     { name: "Canal+",          short: "C+",       cssClass: "other", logo: "https://www.tvsports.fr/assets/icons/tv/canal+.webp" },
  eurosport: { name: "Eurosport",       short: "Euro",     cssClass: "other", logo: "https://www.tvsports.fr/assets/icons/tv/eurosport1.webp" },
};

function detectChannel(imgSrc) {
  if (!imgSrc) return null;
  const src = imgSrc.toLowerCase();
  if (src.includes("10max"))    return TV_CHANNELS["10max"];
  if (src.includes("bein-web")) return TV_CHANNELS["bein-web"];
  if (src.includes("hd1"))      return TV_CHANNELS["hd1"];
  if (src.includes("hd2"))      return TV_CHANNELS["hd2"];
  if (src.includes("hd3"))      return TV_CHANNELS["hd3"];
  if (src.includes("htvsmall") || src.includes("/htv")) return TV_CHANNELS["htv"];
  if (src.includes("tf1"))      return TV_CHANNELS["tf1"];
  if (src.includes("m6"))       return TV_CHANNELS["m6"];
  if (src.includes("l-equipe") || src.includes("lequipe")) return TV_CHANNELS["l-equipe"];
  if (src.includes("canal"))    return TV_CHANNELS["canal"];
  if (src.includes("eurosport"))return TV_CHANNELS["eurosport"];
  return null;
}

const COMP_META = {
  "Liqui Moly StarLigue": { short: "Starligue",   flag: "🇫🇷" },
  "StarLigue":            { short: "Starligue",   flag: "🇫🇷" },
  "ProLigue":             { short: "ProLigue",    flag: "🇫🇷" },
  "Ligue des Champions":  { short: "Champions",   flag: "🏆" },
  "European League":      { short: "Eur. League", flag: "🌍" },
  "Coupe de France":      { short: "Coupe Fr.",   flag: "🇫🇷" },
};

const MONTHS = {
  jan:0, "fév":1, feb:1, mar:2, avr:3, apr:3,
  mai:4, may:4, juin:5, jun:5,
  juil:6, jul:6, "août":7, aug:7,
  sep:8, oct:9, nov:10, "déc":11, dec:11
};

function parseDateTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  const clean = dateTimeStr.replace(/\s+/g, ' ').trim();
  const m = clean.match(/(\d{1,2})\s+(\w+)\s+(\d{2})h(\d{2})/);
  if (!m) return null;
  const day   = parseInt(m[1]);
  const month = MONTHS[m[2].toLowerCase().substring(0,3)] ?? new Date().getMonth();
  const hour  = parseInt(m[3]);
  const min   = parseInt(m[4]);
  const year  = new Date().getFullYear();
  // Crée la date en heure française (UTC+1 hiver / UTC+2 été)
const date = new Date(year, month, day, hour, min);
// Offset France : détecté automatiquement via Intl
const tzOffset = new Date().toLocaleString('fr-FR', {timeZone: 'Europe/Paris', timeZoneName: 'short'}).includes('UTC+2') ? 2 : 1;
date.setHours(date.getHours() - tzOffset);
return date.toISOString();
}

// Default kickoff times by day of week (France time)
const DEFAULT_KICKOFF = { 0: 15, 1: 20, 2: 20, 3: 20, 4: 20, 5: 20, 6: 15 };

function inferStatus(isoDatetime, isFinish, isLive) {
  if (isFinish) return "finished";
  if (!isoDatetime) {
    return isLive ? "live" : "upcoming";
  }
  const now = Date.now();
  const matchMs = new Date(isoDatetime).getTime();
  const diffMin = (now - matchMs) / 60000;
  if (diffMin < 0) return "upcoming";
  if (diffMin < 105) return "live";
  return "finished";
}

function estimateDatetime(isLive, isFinish) {
  if (!isLive && !isFinish) return null;
  const now = new Date();
  const hour = DEFAULT_KICKOFF[now.getDay()] || 20;
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  // If current time is before estimated kickoff, use yesterday
  if (now < d) d.setDate(d.getDate() - 1);
  return d.toISOString();
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parseMatchesFromHtml(html) {
  const matches = [];

  const itemRegex = /<div[^>]*class="([^"]*calendars-listing-item[^"]*)"[^>]*id="(\d+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*calendars-listing-item|<\/section|<footer)/g;

  let m;
  while ((m = itemRegex.exec(html)) !== null) {
    const itemClass = m[1];
    const matchId   = parseInt(m[2]);
    const block     = m[3];

    const isFinish = itemClass.includes('finish');
    const isLive   = itemClass.includes('live');

    const compBlock = block.match(/<div[^>]*class="col-competitions"[^>]*>([\s\S]*?)<\/div>/);
    if (!compBlock) continue;

    const compSpan = compBlock[1].match(/<span[^>]*class="competition"[^>]*>\s*([\s\S]*?)\s*<\/span>/);
    if (!compSpan) continue;
    const compLine = stripTags(compSpan[1]).trim();

    const afterBr = compBlock[1].split(/<br\s*\/?>/i)[1] || '';
    const dateLine = stripTags(afterBr).trim();

    const dashIdx  = compLine.lastIndexOf(' - ');
    const compName = dashIdx > -1 ? compLine.substring(0, dashIdx).trim() : compLine;
    const round    = dashIdx > -1 ? compLine.substring(dashIdx + 3).trim() : '';

    const meta     = COMP_META[compName] || { short: compName, flag: "🏐" };
    const datetime = parseDateTime(dateLine);

    const tvChannels = [];
    const tvImgRx = /src="([^"]*televisions[^"]+)"/gi;
    let tvM;
    while ((tvM = tvImgRx.exec(block)) !== null) {
      const ch = detectChannel(tvM[1]);
      if (ch && !tvChannels.find(x => x.name === ch.name)) tvChannels.push(ch);
    }

    const teamBlocks = [...block.matchAll(/<div[^>]*class="team-logo"[^>]*>([\s\S]*?)(?=<div[^>]*class="(?:team-logo|scores)|$)/g)];
    if (teamBlocks.length < 2) continue;

    const parseTeam = (tb) => {
      const logoM = tb[1].match(/src="(https:\/\/www\.lnh\.fr\/medias\/sports_teams\/[^"]+)"/);
      const nameM = tb[1].match(/<div[^>]*class="team-name"[^>]*>\s*([^<]+)\s*<\/div>/);
      return {
        logo: logoM?.[1] || null,
        name: nameM?.[1]?.trim() || '?',
      };
    };

    const home = parseTeam(teamBlocks[0]);
    const away = parseTeam(teamBlocks[1]);

    const scoreM = block.match(/<div[^>]*class="scores[^"]*"[^>]*>\s*(\d+)\s*-\s*(\d+)\s*<\/div>/);
    const scoreHome = scoreM ? parseInt(scoreM[1]) : null;
    const scoreAway = scoreM ? parseInt(scoreM[2]) : null;

    const status = inferStatus(datetime, isFinish, isLive);
    const isStarMatch = block.toLowerCase().includes('starmatch');

    matches.push({
      id: matchId,
      competition: compName,
      competitionShort: meta.short,
      competitionFlag: meta.flag,
      round,
      datetime,
      homeTeam: home.name,
      awayTeam: away.name,
      homeLogo: home.logo,
      awayLogo: away.logo,
      scoreHome,
      scoreAway,
      tvChannel: tvChannels[0] || null,
      tvChannels,
      tvOnly: tvChannels.length > 0,
      status,
      isStarMatch,
    });
  }

  return matches;
}

async function fetchTVProgram() {
  try {
    const res = await fetch('https://handball-tv.netlify.app/api/tv-program');
    const data = await res.json();
    return data.events || [];
  } catch (e) {
    return [];
  }
}

function findTVChannel(match, tvEvents) {
  if (!match.datetime) return null;
  const matchTime = new Date(match.datetime).getTime();
  const home = match.homeTeam.toLowerCase();
  const away = match.awayTeam.toLowerCase();

  for (const event of tvEvents) {
    const eventTime = new Date(event.startDate).getTime();
    const diffMin = Math.abs(matchTime - eventTime) / 60000;
    if (diffMin > 60) continue; // Must be within 60 min

    const eventName = event.name.toLowerCase();
    // Check if both teams appear in event name
    const homeShort = home.split(' ')[0];
    const awayShort = away.split(' ')[0];
    if (eventName.includes(homeShort) || eventName.includes(awayShort)) {
      return {
        name: event.channel,
        short: event.channel?.replace('beIN Sports', 'beIN').replace('Eurosport', 'Euro'),
        cssClass: event.channel?.toLowerCase().includes('bein') ? 'bein' :
                  event.channel?.toLowerCase().includes('eurosport') ? 'other' :
                  event.channel?.toLowerCase().includes('handball') ? 'htv' : 'other',
        logo: event.channelLogo,
      };
    }
  }
  return null;
}

async function scrapeMatches() {
  const res = await fetch(LNH_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9",
      "Cache-Control": "no-cache",
    },
  });
  if (!res.ok) throw new Error(`LNH fetch failed: ${res.status}`);
  const html = await res.text();
  const matches = parseMatchesFromHtml(html);

  // Enrich with TV channels from tvsports.fr
  const tvEvents = await fetchTVProgram();
  for (const match of matches) {
    if (!match.tvChannel && tvEvents.length > 0) {
      const found = findTVChannel(match, tvEvents);
      if (found) {
        match.tvChannel = found;
        match.tvChannels = [found];
        match.tvOnly = true;
      }
    }
  }

  // Enrich with live scores from Highlightly
  return matches;
}

export default async (req) => {
  try {
    const matches = await scrapeMatches();

    const order = { live: 0, upcoming: 1, finished: 2 };
    matches.sort((a, b) => {
      const sd = order[a.status] - order[b.status];
      if (sd !== 0) return sd;
      if (a.datetime && b.datetime) return new Date(a.datetime) - new Date(b.datetime);
      return 0;
    });

    return new Response(
      JSON.stringify({ matches, scrapedAt: new Date().toISOString() }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=180",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("matches function error:", err);
    return new Response(
      JSON.stringify({ error: err.message, matches: [] }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = { path: "/api/matches" };
