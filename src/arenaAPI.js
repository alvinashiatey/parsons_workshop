const SLUG = "off-kilter-dlm29zhmuak";

async function fetchArena(slug) {
  const randomString = Math.random().toString(36).substring(7);
  const contentURl = `https://api.are.na/v2/channels/${slug}?sort=position&order=desc&per=100?nocache=${randomString}`;
  const response = await fetch(contentURl);
  return response.json();
}

async function handleData() {
  const data = await fetchArena(SLUG);
  return data;
}

export default handleData;