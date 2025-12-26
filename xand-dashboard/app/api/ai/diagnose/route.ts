import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { ip } = await request.json();
    
    if (!ip) {
      return NextResponse.json({ error: 'IP address required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // Fetch node details
    const bootstrapUrl = process.env.BOOTSTRAP_NODE_URL || 'http://173.212.207.32:6000/rpc';
    
    const [pnodesRes, statsRes] = await Promise.all([
      fetch(`${bootstrapUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'pnodes',
          params: []
        })
      }),
      fetch(`${bootstrapUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'stats',
          params: []
        })
      })
    ]);

    const pnodesData = await pnodesRes.json();
    const statsData = await statsRes.json();

    const nodes = pnodesData.result || [];
    const stats = statsData.result || {};

    const node = nodes.find((n: any) => n.ip === ip);

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Calculate network averages
    const onlineNodes = nodes.filter((n: any) => n.status === 'Online');
    const avgCpu = onlineNodes.reduce((sum: number, n: any) => sum + (n.stats?.cpu_percent || 0), 0) / onlineNodes.length;
    const avgRam = onlineNodes.reduce((sum: number, n: any) => sum + ((n.stats?.ram_used / n.stats?.ram_total) * 100 || 0), 0) / onlineNodes.length;

    const healthScore = node.derived?.health_score || 0;
    const status = healthScore >= 80 ? 'Healthy' : healthScore >= 60 ? 'Warning' : 'Critical';

    const context = `Analyze this node:
IP: ${node.ip}
Status: ${node.status}
Health Score: ${healthScore}/100
CPU: ${node.stats?.cpu_percent || 0}% (Network avg: ${avgCpu.toFixed(1)}%)
RAM: ${((node.stats?.ram_used / node.stats?.ram_total) * 100 || 0).toFixed(1)}% (Network avg: ${avgRam.toFixed(1)}%)
Uptime: ${node.derived?.uptime_human || 'N/A'}

Provide a brief diagnosis (2-3 sentences) and 2-3 recommendations.`;

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
            content: 'You are a network diagnostics expert. Provide concise analysis and actionable recommendations.'
          },
          {
            role: 'user',
            content: context
          }
        ],
        max_tokens: 400
      })
    });

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || 'Unable to generate diagnosis';

    return NextResponse.json({
      diagnosis: {
        status,
        summary,
        metrics_comparison: {
          cpu: {
            node: node.stats?.cpu_percent || 0,
            network_avg: parseFloat(avgCpu.toFixed(1))
          },
          ram: {
            node: parseFloat(((node.stats?.ram_used / node.stats?.ram_total) * 100 || 0).toFixed(1)),
            network_avg: parseFloat(avgRam.toFixed(1))
          },
          uptime: {
            node: node.derived?.uptime_human || 'N/A',
            network_avg: 'N/A'
          }
        },
        recommendations: []
      }
    });

  } catch (error) {
    console.error('AI diagnose error:', error);
    return NextResponse.json({ error: 'Failed to diagnose node' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
