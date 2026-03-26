import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { ReactNode, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';

export const CALLBACK_URL = 'com.kisanmitra.app://dev-4xewe5kduufko3fg.us.auth0.com/capacitor/com.kisanmitra.app/callback';

// Inner component that has access to Auth0 context for handling deep links
const Auth0DeepLinkHandler = ({ children }: { children: ReactNode }) => {
  const { handleRedirectCallback } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
        try {
          await handleRedirectCallback(url);
          navigate('/dashboard', { replace: true });
        } catch (e) {
          console.error('Auth0 callback error:', e);
        } finally {
          await Browser.close();
        }
      }
    });

    return () => { listenerPromise.then(l => l.remove()); };
  }, [handleRedirectCallback, navigate]);

  return <>{children}</>;
};

const Auth0ProviderWithHistory = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

  const onRedirectCallback = (appState: any) => {
    navigate(appState?.returnTo || '/dashboard', { replace: true });
  };

  const redirectUri = Capacitor.isNativePlatform()
    ? CALLBACK_URL
    : window.location.origin + '/dashboard';

  if (!domain || !clientId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>⚠️ Auth0 Configuration Required</h2>
        <p>Please set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID in your .env file</p>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{ redirect_uri: redirectUri }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}
      useRefreshTokensFallback={false}
      cacheLocation="localstorage"
    >
      <Auth0DeepLinkHandler>
        {children}
      </Auth0DeepLinkHandler>
    </Auth0Provider>
  );
};

export default Auth0ProviderWithHistory;
