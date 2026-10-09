'use client';

import { TonConnectUIProvider, useTonConnectUI } from '@tonconnect/ui-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import { api, type User } from '@/lib/api';

interface ThemeContextType { theme: 'light' | 'dark'; toggleTheme: () => void; }
const ThemeContext = createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => undefined });
export const useTheme = () => useContext(ThemeContext);

interface AuthContextType {
  user: User | null; token: string | null; login: (user: User) => void; logout: () => Promise<void>;
  isAuthenticated: boolean; isLoading: boolean; refreshSession: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType>({ user: null, token: null, login: () => undefined, logout: async () => undefined, isAuthenticated: false, isLoading: true, refreshSession: async () => undefined });
export const useAuth = () => useContext(AuthContext);

function WalletProofBridge({ authenticated }: { authenticated: boolean }) {
  const [tonConnectUI] = useTonConnectUI();
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;

    const prepareChallenge = async () => {
      try {
        tonConnectUI.setConnectRequestParameters({ state: 'loading' });
        const { payload } = await api.requestWalletChallenge();
        if (!cancelled) tonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: payload } });
      } catch (error) {
        console.error('Could not prepare TON Proof challenge', error);
        if (!cancelled) tonConnectUI.setConnectRequestParameters(null);
      }
    };

    void prepareChallenge();
    const unsubscribe = tonConnectUI.onStatusChange(async wallet => {
      if (!wallet) {
        await prepareChallenge();
        return;
      }
      const item = wallet.connectItems?.tonProof;
      if (!item || !('proof' in item)) return;
      try {
        await api.verifyWallet({ address: wallet.account.address, walletStateInit: wallet.account.walletStateInit, network: wallet.account.chain, proof: item.proof });
      } catch (error) {
        console.error('TON Proof verification failed', error);
      } finally {
        // Always prepare a fresh nonce for the next reconnect/verification attempt.
        await prepareChallenge();
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [authenticated, tonConnectUI]);
  return null;
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } } }));
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = async () => {
    try { setUser((await api.getProfile()).user); } catch { setUser(null); } finally { setIsLoading(false); }
  };

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) { setTheme(saved); document.documentElement.classList.toggle('dark', saved === 'dark'); }
    void refreshSession();
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); localStorage.setItem('theme', next); document.documentElement.classList.toggle('dark', next === 'dark');
  };
  const logout = async () => { try { await api.logout(); } finally { setUser(null); } };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <AuthContext.Provider value={{ user, token: user ? 'cookie-session' : null, login: setUser, logout, isAuthenticated: Boolean(user), isLoading, refreshSession }}>
          <TonConnectUIProvider manifestUrl={`${appUrl}/tonconnect-manifest.json`}>
            <WalletProofBridge authenticated={Boolean(user)} />
            {children}
          </TonConnectUIProvider>
        </AuthContext.Provider>
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}
