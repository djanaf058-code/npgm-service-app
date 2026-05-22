// Mistral embeddings via REST. Replaces Voyage/Cohere (both block our IP).
// Docs: https://docs.mistral.ai/api/#tag/embeddings
// Model: mistral-embed — 1024-dim, matches our DB schema exactly.

const MISTRAL_URL = 'https://api.mistral.ai/v1/embeddings';
const MODEL = 'mistral-embed';

export async function embed(
  input: string | string[],
  // Mistral doesn't differentiate query/document — kept for API parity
  // with the previous Voyage/Cohere wrappers that take an input_type.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _inputType: 'query' | 'document' = 'document'
): Promise<number[][]> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error('MISTRAL_API_KEY missing');

  const resp = await fetch(MISTRAL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: Array.isArray(input) ? input : [input],
      model: MODEL,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Mistral error ${resp.status}: ${t}`);
  }
  const json = (await resp.json()) as {
    data: { embedding: number[] }[];
  };
  return json.data.map((d) => d.embedding);
}
