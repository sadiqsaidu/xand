import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // TODO: This should connect to a database that stores node information
    // For now, returning mock data based on the original implementation structure
    
    const stats = {
      total: 156,
      online: 142,
      with_public_rpc: 89,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch stats', 
      message: error.message
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
