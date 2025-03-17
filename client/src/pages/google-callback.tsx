import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function GoogleCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      console.error('OAuth error:', error);
      window.close();
      return;
    }

    if (!code || !state) {
      console.error('Missing authorization code or state');
      window.close();
      return;
    }

    // Verify state matches what we stored
    const storedState = window.opener?.sessionStorage.getItem('oauthState');
    if (!storedState || storedState !== state) {
      console.error('Invalid OAuth state');
      window.close();
      return;
    }

    // The server will handle the token exchange and send back user data
    // via postMessage in the response HTML

    // If for some reason this component is navigated to directly (not in a popup)
    // redirect back to the home page after a short delay
    const timer = setTimeout(() => {
      setLocation('/');
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-6 max-w-sm mx-auto">
        <h1 className="text-xl font-semibold mb-2">Authentication in progress...</h1>
        <p className="text-muted-foreground">Please wait while we complete your sign-in.</p>
      </div>
    </div>
  );
}