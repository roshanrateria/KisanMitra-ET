// API integrations for weather, soil, market prices, satellite imagery
// Weather proxied through Lambda server — NO API keys on client
// Soil data stays client-side (public API, no key needed)

import { serverGet, serverPost } from '@/lib/serverApi';

export interface WeatherData {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  weather: Array<{
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  clouds?: {
    all: number;
  };
  name: string;
  coord?: {
    lat: number;
    lon: number;
  };
}

export const getWeather = async (lat: number, lon: number): Promise<WeatherData | null> => {
  try {
    const data = await serverGet<WeatherData>('/api/weather', {
      lat: lat.toString(),
      lon: lon.toString(),
    });
    return data;
  } catch (error) {
    console.error('Failed to fetch weather data:', error);
    return null;
  }
};

export interface ForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  humidity: number;
  description: string;
  icon: string;
  rainMm: number;
  windSpeed: number;
}

export interface ForecastData {
  city?: string;
  daily: ForecastDay[];
}

export const getForecast = async (lat: number, lon: number): Promise<ForecastData | null> => {
  try {
    const data = await serverGet<ForecastData>('/api/forecast', {
      lat: lat.toString(),
      lon: lon.toString(),
    });
    return data;
  } catch (error) {
    console.error('Failed to fetch forecast:', error);
    return null;
  }
};

export const getSoilData = async (lat: number, lon: number): Promise<any> => {
  try {
    // Proxied through server to avoid CORS on data.gov.in
    const data = await serverGet<any>('/api/soil', {
      lat: lat.toString(),
      lon: lon.toString(),
    });
    return data;
  } catch (error) {
    console.error('Failed to fetch soil data:', error);
    return null;
  }
};

export interface MarketPrice {
  slNo: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  priceDate: string;
}

export const getMarketPrices = async (commodity: string): Promise<MarketPrice[]> => {
  try {
    const apiKey = '579b464db66ec23bdd000001960c083f814e49f57f6262d1ea6d9203';
    const resourceId = '9ef84268-d588-465a-a308-a864a43d0070';
    
    let url = `https://api.data.gov.in/resource/${resourceId}?api-key=${apiKey}&format=json&limit=20`;
    if (commodity) {
      // Sometimes APIs are case sensitive, we capitalize first letter
      const trimmed = commodity.trim();
      const formattedCommodity = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      url += `&filters%5Bcommodity%5D=${encodeURIComponent(formattedCommodity)}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.records || !Array.isArray(data.records) || data.records.length === 0) {
      console.warn(`No market data found for commodity: ${commodity}`);
      return [];
    }
    
    const livePrices: MarketPrice[] = data.records.map((r: any, index: number) => {
      // prices are floats/doubles in the API response
      return {
        slNo: (index + 1).toString(),
        district: r.district || 'Unknown',
        market: r.market || 'Unknown',
        commodity: r.commodity || commodity,
        variety: r.variety || 'Other',
        grade: r.grade || 'FAQ',
        minPrice: Number(r.min_price) || 0,
        maxPrice: Number(r.max_price) || 0,
        modalPrice: Number(r.modal_price) || 0,
        priceDate: r.arrival_date || new Date().toLocaleDateString('en-GB').split('/').join('-')
      };
    });

    return livePrices;
  } catch (error) {
    console.error('Failed to fetch market prices:', error);
    return [];
  }
};

export const getCropRecommendations = async (soilData: any, weather: WeatherData | null): Promise<string[]> => {
  const crops = ['Wheat', 'Rice', 'Cotton', 'Sugarcane', 'Maize', 'Bajra', 'Jowar'];
  return crops.slice(0, 3);
};

// ─── Agromonitoring stubs (Agromonitoring API integration placeholder) ──────

export const createAgroPolygon = async (
  name: string,
  coordinates: Array<[number, number]>
): Promise<{ id: string } | null> => {
  try {
    const data = await serverPost<{ id: string }>('/api/agro/polygon', { name, coordinates });
    return data;
  } catch {
    return null;
  }
};

export const getAgroNDVI = async (polygonId: string): Promise<any | null> => {
  try {
    const data = await serverGet<any>('/api/agro/ndvi', { polygonId });
    return data;
  } catch {
    return null;
  }
};
