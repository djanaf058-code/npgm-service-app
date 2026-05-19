// Voyage AI SDK is young; we go through their REST endpoint directly.
// Docs: https://docs.voyageai.com/reference/embeddings-api
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-multilingual-2';

export async function embed(
  input: string | string[],
  inputType: 'query' | 'document' = 'document'
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY missing');

  const resp = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: Array.isArray(input) ? input : [input],
      model: MODEL,
      input_type: inputType,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Voyage error ${resp.status}: ${t}`);
  }
  const json = (await resp.json()) as {
    data: { embedding: number[] }[];
  };
  return json.data.map((d) => d.embedding);
}
