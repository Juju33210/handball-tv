export default async (req) => {
  const res = await fetch('https://handball.highlightly.net/leagues?countryCode=FR', {
    headers: {
      'x-api-key': process.env.HIGHLIGHTLY_KEY,
      'x-rapidapi-host': 'handball-highlights-api.p.rapidapi.com'
    }
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
};

export const config = { path: "/api/test-standings" };
