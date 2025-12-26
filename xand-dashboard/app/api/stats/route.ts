import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const bootstrapUrl = process.env.BOOTSTRAP_NODE_URL || 'http://173.212.207.32:6000/rpc';
    
    console.log('Fetching from bootstrap node:', bootstrapUrl);
    
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

    console.log('Bootstrap response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bootstrap error response:', errorText);
      return NextResponse.json({ 
        error: 'Bootstrap node returned error', 
        status: response.status,
        details: errorText 
      }, { status: 500 });
    }

    const data = await response.json();
    console.log('Bootstrap data received:', data);
    
    return NextResponse.json(data.result || data);
  } catch (error: any) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch stats', 
      message: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
