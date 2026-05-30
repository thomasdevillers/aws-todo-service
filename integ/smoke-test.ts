const API_URL = process.env.API_URL;
if (!API_URL) {
  console.error('API_URL not set');
  process.exit(1);
}

async function run() {
  const res = await fetch(`${API_URL}/todos`);
  if (!res.ok) {
    throw new Error(`smoke test failed: GET /todos returned ${res.status}`);
  }
  console.log(`smoke test ok: GET /todos returned ${res.status}`);
}

run().catch((err) => {
  console.error('SMOKE TEST FAILED:', err.message);
  process.exit(1);
});