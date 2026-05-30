
const API_URL = process.env.API_URL;
if (!API_URL) {
  console.error('API_URL env var not set');
  process.exit(1);
}

interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

async function expect200<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${label} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

async function run() {
  console.log(`integ-test against ${API_URL}`);

  // 1. Create
  const created = await expect200<Todo>(
    await fetch(`${API_URL}/todos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'integ test todo' }),
    }),
    'POST /todos',
  );
  if (!created.id) throw new Error('expected id on created todo');
  console.log('  ✓ POST /todos returned id', created.id);

  // 2. Read by id
  const fetched = await expect200<Todo>(
    await fetch(`${API_URL}/todos/${created.id}`),
    'GET /todos/{id}',
  );
  if (fetched.id !== created.id) throw new Error('id mismatch');
  if (fetched.title !== 'integ test todo') throw new Error('title mismatch');
  console.log('  ✓ GET /todos/{id} returns the same todo');

  // 3. List includes the new todo
  const list = await expect200<Todo[]>(
    await fetch(`${API_URL}/todos`),
    'GET /todos',
  );
  if (!list.some((t) => t.id === created.id)) throw new Error('list did not contain created todo');
  console.log('  ✓ GET /todos contains the created todo');

  // 4. Delete
  const delRes = await fetch(`${API_URL}/todos/${created.id}`, { method: 'DELETE' });
  if (delRes.status !== 204) throw new Error(`DELETE expected 204, got ${delRes.status}`);
  console.log('  ✓ DELETE /todos/{id} returns 204');

  // 5. Confirm gone
  const goneRes = await fetch(`${API_URL}/todos/${created.id}`);
  if (goneRes.status !== 404) throw new Error(`expected 404 after delete, got ${goneRes.status}`);
  console.log('  ✓ GET /todos/{id} after delete returns 404');

  // 6. 400 on missing title
  const badRes = await fetch(`${API_URL}/todos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (badRes.status !== 400) throw new Error(`expected 400 for missing title, got ${badRes.status}`);
  console.log('  ✓ POST /todos {} returns 400');

  console.log('all integ tests passed');
}

run().catch((err) => {
  console.error('INTEG TEST FAILED:', err.message);
  process.exit(1);
});
