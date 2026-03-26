// ONDC Service — proxied through Lambda server
// NO direct ONDC calls from browser — all go through /api/ondc/*
// Types and UI helpers stay on client

import { serverPost } from '@/lib/serverApi';

export interface ONDCSearchResult {
    transaction_id: string;
    providers: ONDCProvider[];
    raw_response: any;
}

export interface ONDCProvider {
    id: string;
    name: string;
    rating?: string;
    location?: {
        city: string;
        state: string;
        gps?: string;
    };
    items: ONDCItem[];
}

export interface ONDCItem {
    id: string;
    name: string;
    description?: string;
    price: {
        currency: string;
        value: string;
    };
    quantity?: {
        available: number;
        unit: string;
    };
    category?: string;
    image?: string;
    fulfillment?: {
        type: string;
        estimated_delivery: string;
    };
}

export interface ONDCOrder {
    order_id: string;
    transaction_id: string;
    status: 'created' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
    provider: ONDCProvider;
    items: ONDCItem[];
    total_amount: number;
    fulfillment_status: string;
    created_at: number;
}

// ─── Parse server response into typed ONDCProvider[] ────────────

const parseProviders = (data: any): ONDCProvider[] => {
    // Handle array response — ondc_mock_playground returns data: [onSearchResponse]
    if (Array.isArray(data)) {
        return data.flatMap((item: any) => parseProviders(item));
    }
    const catalog = data?.message?.catalog || data?.data?.message?.catalog || {};
    const bppProviders = catalog?.['bpp/providers'] || catalog?.providers || [];

    return bppProviders.map((p: any) => ({
        id: p.id || `prov_${Math.random().toString(36).substring(2, 8)}`,
        name: p.descriptor?.name || p.name || 'Unknown Provider',
        rating: p.rating,
        location: p.location || {
            city: p.locations?.[0]?.city?.name || 'Unknown',
            state: p.locations?.[0]?.state?.name || '',
            gps: p.locations?.[0]?.gps,
        },
        items: (p.items || []).map((item: any) => ({
            id: item.id || `item_${Math.random().toString(36).substring(2, 8)}`,
            name: item.descriptor?.name || item.name || 'Unknown',
            description: item.descriptor?.long_desc || item.descriptor?.short_desc || item.description,
            price: item.price || { currency: 'INR', value: '0' },
            quantity: item.quantity ? {
                available: parseInt(item.quantity.available?.count || item.quantity.available || '0'),
                unit: item.quantity.available?.measure?.unit || item.quantity.unit || 'unit',
            } : undefined,
            category: item.category_id || item.category,
            image: item.descriptor?.images?.[0]?.url || item.image,
            fulfillment: item.fulfillment,
        })),
    }));
};

/**
 * Search ONDC network for agricultural inputs (treatments, fertilizers)
 */
export const searchTreatments = async (
    searchQuery: string,
    location?: { lat: number; lng: number },
    category?: string
): Promise<ONDCSearchResult> => {
    const response = await serverPost<{ transaction_id: string; data: any; source: string }>('/api/ondc/search', {
        searchQuery,
        searchType: 'treatments',
        location,
        category,
    });

    return {
        transaction_id: response.transaction_id,
        providers: parseProviders(response.data),
        raw_response: response.data,
    };
};

/**
 * Search ONDC network for produce buyers
 */
export const searchBuyers = async (
    produceType: string,
    quantity: number,
    unit: string,
    location?: { lat: number; lng: number }
): Promise<ONDCSearchResult> => {
    const response = await serverPost<{ transaction_id: string; data: any; source: string }>('/api/ondc/search', {
        searchQuery: produceType,
        searchType: 'buyers',
        quantity,
        unit,
        location,
    });

    return {
        transaction_id: response.transaction_id,
        providers: parseProviders(response.data),
        raw_response: response.data,
    };
};

/**
 * Select an item from ONDC catalog — gets detailed quote
 */
export const selectItem = async (
    transactionId: string,
    providerId: string,
    itemId: string,
    quantity: number
): Promise<any> => {
    const response = await serverPost('/api/ondc/select', {
        transactionId,
        providerId,
        itemId,
        quantity,
    });
    return response.data;
};

/**
 * Confirm order on ONDC
 */
export const confirmOrder = async (
    transactionId: string,
    providerId: string,
    itemId: string,
    quantity: number,
    paymentMethod: 'PRE-PAID' | 'ON-FULFILLMENT' | 'ON-ORDER'
): Promise<ONDCOrder> => {
    const response = await serverPost<any>('/api/ondc/confirm', {
        transactionId,
        providerId,
        itemId,
        quantity,
        paymentMethod,
    });

    return {
        order_id: response.order_id,
        transaction_id: response.transaction_id || transactionId,
        status: 'confirmed',
        provider: { id: providerId, name: 'ONDC Agri Supplier', items: [] },
        items: [],
        total_amount: 0,
        fulfillment_status: response.fulfillment_status || 'Order Confirmed',
        created_at: Date.now(),
    };
};

// ─── Local Order Storage ────────────────────────────────────────

const ORDERS_KEY = 'kisanmitra_ondc_orders';

export const saveOrder = (order: ONDCOrder): void => {
    const orders = getOrders();
    orders.push(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
};

export const getOrders = (): ONDCOrder[] => {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); }
    catch { return []; }
};

export const getOrderById = (orderId: string): ONDCOrder | undefined => {
    return getOrders().find(o => o.order_id === orderId);
};
