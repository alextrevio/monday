// Client-side helper that calls our Next.js API route.
// The API route hides the ANTHROPIC_API_KEY on the server.

export async function callClaude(system, userMessage, maxTokens = 1000) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.content || '';
}
