// Central API client — all calls go through the server
// The server URL is the only env var the frontend needs

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Make a POST request to the server
 */
export const serverPost = async <T = any>(path: string, body?: any): Promise<T> => {
    const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error (${response.status})`);
    }

    return response.json();
};

/**
 * Make a GET request to the server
 */
export const serverGet = async <T = any>(path: string, params?: Record<string, string>): Promise<T> => {
    const url = new URL(`${API_URL}${path}`);
    if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    }

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error (${response.status})`);
    }

    return response.json();
};

/**
 * Upload multipart form data to the server (for disease detection)
 */
export const serverUpload = async <T = any>(path: string, formData: FormData): Promise<T> => {
    const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error (${response.status})`);
    }

    return response.json();
};
