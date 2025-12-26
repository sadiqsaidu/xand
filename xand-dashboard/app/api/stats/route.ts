import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const bootstrapUrl = process.env.BOOTSTRAP_NODE_URL || 'http://173.212.207.32:6000/rpc';
    
    // Fetch from bootstrap node
    const response = await fetch(`${bootstrapUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'stats',
        params: []
      })
    });

    const data = await response.json();
    
    return NextResponse.json(data.result || {});
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
