import { serverGet, serverPost } from '@/lib/serverApi';

export interface LedgerEntry {
    userId: string;
    timestamp: string;
    type: 'DISEASE_ANALYSIS' | 'ONDC_ORDER' | 'NEGOTIATION_ACCEPTED' | 'OTHER';
    title: string;
    details: any;
}

export const getLedgerHistory = async (userId: string = 'farmer_001'): Promise<LedgerEntry[]> => {
    try {
        const response = await serverGet<{ entries: LedgerEntry[] }>('/api/ledger', { userId });
        return response.entries || [];
    } catch (error) {
        console.error('Failed to fetch ledger history:', error);
        return [];
    }
};

export const addLedgerEntry = async (
    userId: string = 'farmer_001',
    type: LedgerEntry['type'],
    title: string,
    details: any
): Promise<boolean> => {
    try {
        await serverPost('/api/ledger', { userId, type, title, details });
        return true;
    } catch (error) {
        console.error('Failed to add ledger entry:', error);
        return false;
    }
};
