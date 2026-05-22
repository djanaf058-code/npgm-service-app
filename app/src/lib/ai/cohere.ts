// Cohere embeddings via REST. Replaces Voyage (which blocks datacenter IPs).
// Docs: https://docs.cohere.com/reference/embed
// Model: embed-multilingual-v3.0 — 1024-dim, parity with what migration expects.

const COHERE_URL = 'https://api.cohere.com/v2/embed';
const MODEL = 'embed-multilingual-v3.0';

export async function embed(
  input: string | string[],
  inputType: 'query' | 'document' = 'document'
): Promise<number[][]> {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error('COHERE_API_KEY missing');

  // Cohere v2: input_type uses "search_query" / "search_document".
  const cohereInputType =
    inputType === 'query' ? 'search_query' : 'search_document';

  const resp = await fetch(COHERE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts: Array.isArray(input) ? input : [input],
      model: MODEL,
      input_type: cohereInputType,
      embedding_types: ['float'],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Cohere error ${resp.status}: ${t}`);
  }
  const json = (await resp.json()) as {
    embeddings: { float: number[][] };
  };
  return json.embeddings.float;
}
