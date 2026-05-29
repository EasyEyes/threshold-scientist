export async function fetchGlossaryData() {
  const response = await fetch("/.netlify/functions/glossary");
  return response.json();
}

export async function fetchGlossaryVersion() {
  const response = await fetch("/.netlify/functions/glossary?versionOnly=1");
  return response.json();
}

export async function pinGlossaryVersion(username, experimentName) {
  const response = await fetch("/.netlify/functions/glossary", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, experimentName }),
  });
  return response.json();
}
