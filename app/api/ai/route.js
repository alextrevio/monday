import Anthropic from '@anthropic-ai/sdk';

// Use edge runtime for faster cold starts (optional - remove if SDK doesn't support it)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY no está configurada en el servidor.' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { system, messages, max_tokens = 1000 } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required' }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens,
      system: system || undefined,
      messages,
    });

    const content = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .filter(Boolean)
      .join('\n');

    return Response.json({ content });
  } catch (err) {
    console.error('Anthropic API error:', err);
    return Response.json(
      { error: err?.message || 'AI request failed' },
      { status: 500 }
    );
  }
}
