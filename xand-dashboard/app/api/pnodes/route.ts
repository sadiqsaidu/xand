import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // TODO: This should connect to a database that stores node information
    // For now, returning mock data based on the original implementation structure
    
    const mockNodes = Array.from({ length: 25 }, (_, i) => ({
      id: `pnode-${i + 1}`,
      address: `192.168.${Math.floor(i / 255)}.${(i % 255) + 1}:9001`,
      ip: `192.168.${Math.floor(i / 255)}.${(i % 255) + 1}`,
      version: '1.18.26',
      cpuPercent: Math.random() * 100,
      ramUsedBytes: Math.floor(Math.random() * 8000000000),
      ramTotalBytes: 16000000000,
      diskUsedBytes: Math.floor(Math.random() * 500000000000),
      diskTotalBytes: 1000000000000,
      lastSeenTimestamp: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 600),
      online: Math.random() > 0.1,
    }));

    return NextResponse.json(mockNodes);
  } catch (error: any) {
    console.error('Pnodes fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch pnodes',
      message: error.message
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
