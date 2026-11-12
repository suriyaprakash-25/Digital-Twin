import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export const AUTH_STATUS = Object.freeze({
  BOOTSTRAPPING: 'bootstrapping',
  AUTHENTICATED: 'authenticated',
  ANONYMOUS: 'anonymous',
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
