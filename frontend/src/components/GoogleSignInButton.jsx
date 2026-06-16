import { useEffect, useRef } from 'react';

const GoogleSignInButton = ({ onSuccess, onError, text = 'signin_with' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const initializeGoogleButton = () => {
      if (!isMounted) return;
      
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.warn('VITE_GOOGLE_CLIENT_ID is not configured in the environment file (.env).');
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="text-xs text-red-500 text-center p-3 border border-red-200 rounded-xl bg-red-50/50 font-medium">
              Google Client ID not configured. <br/>
              <span class="text-[10px] text-red-400 font-normal">Add VITE_GOOGLE_CLIENT_ID inside frontend/.env</span>
            </div>
          `;
        }
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              onSuccess(response.credential);
            } else {
              onError && onError(new Error('No Google credential returned.'));
            }
          },
          cancel_on_tap_outside: true
        });

        window.google.accounts.id.renderButton(
          containerRef.current,
          {
            theme: 'outline',
            size: 'large',
            width: containerRef.current?.offsetWidth || 350,
            text: text,
            shape: 'rectangular',
            logo_alignment: 'left'
          }
        );
      } catch (err) {
        console.error('Failed to initialize Google Sign-In:', err);
        onError && onError(err);
      }
    };

    // Check if the script is already loaded
    if (window.google?.accounts?.id) {
      initializeGoogleButton();
    } else {
      const scriptId = 'google-gsi-client';
      let script = document.getElementById(scriptId);

      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      const handleScriptLoad = () => {
        initializeGoogleButton();
      };

      script.addEventListener('load', handleScriptLoad);

      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          initializeGoogleButton();
          clearInterval(interval);
        }
      }, 200);

      return () => {
        isMounted = false;
        script.removeEventListener('load', handleScriptLoad);
        clearInterval(interval);
      };
    }
  }, [onSuccess, onError, text]);

  return (
    <div ref={containerRef} className="w-full flex justify-center min-h-[44px]" />
  );
};

export default GoogleSignInButton;
