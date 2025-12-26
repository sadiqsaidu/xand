import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();
    
    if (!question) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // Fetch network data first
    const bootstrapUrl = process.env.BOOTSTRAP_NODE_URL || 'http://173.212.207.32:6000/rpc';
    
    const [statsRes, pnodesRes] = await Promise.all([
      fetch(`${bootstrapUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'stats',
          params: []
        })
      }),
      fetch(`${bootstrapUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'pnodes',
          params: []
        })
      })
    ]);

    const statsData = await statsRes.json();
    const pnodesData = await pnodesRes.json();

    const stats = statsData.result || {};
    const nodes = pnodesData.result || [];

    // Prepare context for AI
    const context = `Network Stats:
- Total Nodes: ${stats.total_nodes || 0}
- Online Nodes: ${stats.online_nodes || 0}
- Offline Nodes: ${stats.offline_nodes || 0}
- Network Score: ${stats.network_score || 0}/100
- Countries: ${stats.countries_count || 0}

Question: ${question}`;

    // Call OpenRouter
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://xandeum.network',
        'X-Title': 'Xandeum Explorer'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for the Xandeum network explorer. Answer questions about network statistics concisely.'
          },
          {
            role: 'user',
            content: context
          }
        ],
        max_tokens: 300
      })
    });

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || 'Unable to generate response';

    return NextResponse.json({
      answer,
      data_snapshot: {
        total_nodes: stats.total_nodes || 0,
        online_nodes: stats.online_nodes || 0,
        network_score: stats.network_score || 0,
        countries_count: stats.countries_count || 0
      }
    });

  } catch (error) {
    console.error('AI ask error:', error);
    return NextResponse.json({ error: 'Failed to process AI request' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
