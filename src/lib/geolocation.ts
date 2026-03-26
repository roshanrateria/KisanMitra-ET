/**
 * Geolocation utility for getting current user location
 * Handles permission requests and errors gracefully
 */

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

/**
 * Get the user's current location
 * Returns null if geolocation is unavailable or permission is denied
 * 
 * @returns Promise resolving to coordinates or null
 */
export async function getCurrentLocation(): Promise<LocationCoordinates | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  });
}
