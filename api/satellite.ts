// Vercel Serverless Function to proxy Sentinel Hub API and avoid CORS
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cache token for 50 minutes (tokens expire in 1 hour)
let cachedToken: { token: string; expiry: number } | null = null;

async function getSentinelToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token;
  }

  const clientId = process.env.VITE_SENTINEL_CLIENT_ID || process.env.SENTINEL_CLIENT_ID;
  const clientSecret = process.env.VITE_SENTINEL_CLIENT_SECRET || process.env.SENTINEL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Sentinel Hub credentials not configured');
  }

  const response = await fetch('https://services.sentinel-hub.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Sentinel token: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Cache the token (expires in 1 hour, we cache for 50 minutes)
  cachedToken = {
    token: data.access_token,
    expiry: Date.now() + 50 * 60 * 1000,
  };

  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { coordinates, type = 'true-color', date } = req.body;

    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Get authentication token
    const token = await getSentinelToken();

    // Calculate bounding box
    const lats = coordinates.map((c: number[]) => c[0]);
    const lons = coordinates.map((c: number[]) => c[1]);
    const bbox = [
      Math.min(...lons),
      Math.min(...lats),
      Math.max(...lons),
      Math.max(...lats),
    ];

    // Evalscripts for different visualization types
    const evalscripts: Record<string, string> = {
      'true-color': `
        //VERSION=3
        function setup() {
          return {
            input: ["B04", "B03", "B02"],
            output: { bands: 3 }
          };
        }
        function evaluatePixel(sample) {
          return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
        }
      `,
      'ndvi': `
        //VERSION=3
        function setup() {
          return {
            input: ["B04", "B08", "dataMask"],
            output: { bands: 4 }
          };
        }
        function evaluatePixel(sample) {
          let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
          return [ndvi, ndvi, ndvi, sample.dataMask];
        }
      `,
      'moisture': `
        //VERSION=3
        function setup() {
          return {
            input: ["B8A", "B11"],
            output: { bands: 3 }
          };
        }
        function evaluatePixel(sample) {
          let moisture = (sample.B8A - sample.B11) / (sample.B8A + sample.B11);
          return [moisture, moisture, moisture];
        }
      `,
    };

    const requestBody = {
      input: {
        bounds: {
          bbox: bbox,
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
        },
        data: [
          {
            type: 'S2L2A',
            dataFilter: {
              timeRange: {
                from:
                  date ||
                  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split('T')[0] + 'T00:00:00Z',
                to: new Date().toISOString().split('T')[0] + 'T23:59:59Z',
              },
              maxCloudCoverage: 30,
            },
          },
        ],
      },
      output: {
        width: 512,
        height: 512,
        responses: [
          {
            identifier: 'default',
            format: { type: 'image/png' },
          },
        ],
      },
      evalscript: evalscripts[type] || evalscripts['true-color'],
    };

    // Fetch from Sentinel Hub
    const response = await fetch(
      'https://services.sentinel-hub.com/api/v1/process',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sentinel Hub API error:', errorText);
      return res.status(response.status).json({ 
        error: 'Failed to fetch satellite imagery',
        details: errorText 
      });
    }

    // Get the image as buffer
    const buffer = await response.arrayBuffer();
    
    // Return the image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Satellite API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
