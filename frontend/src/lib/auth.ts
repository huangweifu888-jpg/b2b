import axios, { AxiosInstance } from 'axios';
import { getAPIBaseURL } from './config';

const AUTH_TOKEN_KEY = 'tradepro.auth.token';
const AUTH_TOKEN_EXPIRES_AT_KEY = 'tradepro.auth.expiresAt';

export type LocalDemoScope = 'hq' | 'agency' | 'client';

/**
 * Account-free sessions are deliberately limited to loopback development.
 * Production builds set VITE_AUTH_MODE=oidc and must obtain/refresh sessions
 * through the identity provider's HttpOnly refresh-token cookie, never localStorage.
 */
export function isLocalDemoAuthEnabled() {
  if (typeof window === 'undefined' || import.meta.env.VITE_AUTH_MODE === 'oidc') return false;
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(getAPIBaseURL());
}

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      const token = this.getStoredToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  getStoredToken() {
    if (typeof window === 'undefined') {
      return null;
    }

    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    const expiresAtRaw = window.localStorage.getItem(AUTH_TOKEN_EXPIRES_AT_KEY);
    const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : NaN;

    if (!token) {
      return null;
    }

    if (Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() >= expiresAt * 1000) {
      this.clearSession();
      return null;
    }

    return token;
  }

  persistSession(token: string, expiresAt?: number | null) {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
      window.localStorage.setItem(AUTH_TOKEN_EXPIRES_AT_KEY, String(expiresAt));
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_EXPIRES_AT_KEY);
    }
  }

  clearSession() {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_TOKEN_EXPIRES_AT_KEY);
  }

  /** Recreates the account-free localhost session after a backend restart. */
  async restoreLocalDemoSession(scope: LocalDemoScope): Promise<boolean> {
    if (!isLocalDemoAuthEnabled()) return false;
    try {
      const response = await fetch(`${this.getBaseURL()}/api/v1/auth/local/demo-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      if (!response.ok) return false;
      const session = await response.json() as { token?: string; expires_at?: number | null };
      if (!session.token) return false;
      this.persistSession(session.token, session.expires_at);
      return true;
    } catch {
      return false;
    }
  }

  /** Renew a formal OIDC access token through the HttpOnly refresh cookie. */
  async refreshOidcSession(): Promise<boolean> {
    if (isLocalDemoAuthEnabled()) return false;
    try {
      const response = await fetch(`${this.getBaseURL()}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!response.ok) return false;
      const session = await response.json() as { token?: string; expires_at?: number | null };
      if (!session.token) return false;
      this.persistSession(session.token, session.expires_at);
      return true;
    } catch {
      return false;
    }
  }

  completeCallbackFromUrl(url?: string) {
    if (typeof window === 'undefined' && !url) {
      return false;
    }

    const targetUrl = url || window.location.href;
    const currentUrl = new URL(targetUrl);
    const token = currentUrl.searchParams.get('token');
    const expiresAtRaw = currentUrl.searchParams.get('expires_at');

    if (!token) {
      return false;
    }

    const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : null;
    this.persistSession(token, expiresAt);
    currentUrl.searchParams.delete('token');
    currentUrl.searchParams.delete('expires_at');
    currentUrl.searchParams.delete('token_type');

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }

    return true;
  }

  async getCurrentUser() {
    try {
      let token = this.getStoredToken();
      if (!token && !isLocalDemoAuthEnabled()) {
        await this.refreshOidcSession();
        token = this.getStoredToken();
      }
      if (!token) {
        return null;
      }

      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/me`
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        if (!isLocalDemoAuthEnabled() && await this.refreshOidcSession()) {
          const retry = await this.client.get(`${this.getBaseURL()}/api/v1/auth/me`);
          return retry.data;
        }
        return null;
      }
      throw new Error(
        (axios.isAxiosError(error) && error.response?.data?.detail) || 'Failed to get user info'
      );
    }
  }

  async login() {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          'tradepro.auth.returnTo',
          `${window.location.pathname}${window.location.search}${window.location.hash}`
        );
      }
      window.location.href = `${this.getBaseURL()}/api/v1/auth/login`;
    } catch (error: unknown) {
      throw new Error(
        (axios.isAxiosError(error) && error.response?.data?.detail) || 'Failed to initiate login'
      );
    }
  }

  async logout() {
    try {
      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/logout`
      );
      // The backend will redirect to OIDC provider logout
      this.clearSession();
      window.location.href = response.data.redirect_url;
    } catch (error: unknown) {
      throw new Error(
        (axios.isAxiosError(error) && error.response?.data?.detail) || 'Failed to logout'
      );
    }
  }
}

export const authApi = new RPApi();
