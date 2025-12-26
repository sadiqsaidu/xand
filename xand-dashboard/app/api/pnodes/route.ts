import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const bootstrapUrl = process.env.BOOTSTRAP_NODE_URL || 'http://173.212.207.32:6000/rpc';
    
    console.log('Fetching pnodes from:', bootstrapUrl);
    
    // Fetch from bootstrap node
    const response = await fetch(`${bootstrapUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pnodes',
        params: []
      })
    });

    console.log('Pnodes response status:', response.status);

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
    console.log('Pnodes data received, count:', data.result?.length || 0);
    
    return NextResponse.json(data.result || []);
  } catch (error: any) {
    console.error('Pnodes fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch pnodes',
      message: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
