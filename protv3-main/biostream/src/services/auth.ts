// Authentication Service - Backend-based authentication with JWT tokens

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;

  constructor() {
    // Load tokens from localStorage on initialization
    this.loadTokens();
  }

  private loadTokens() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
      this.refreshToken = localStorage.getItem('refresh_token');
      const userData = localStorage.getItem('user');
      if (userData) {
        this.user = JSON.parse(userData);
      }
    }
  }

  private saveTokens(access_token: string, refresh_token: string, user: User) {
    this.accessToken = access_token;
    this.refreshToken = refresh_token;
    this.user = user;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('isAuthenticated', 'true');
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
    }
  }

  getAccessToken(): string | null {
    // Fall back to localStorage in case the token was set externally
    // (e.g. cross-origin handoff from the Next.js landing page)
    if (!this.accessToken && typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token')
    }
    return this.accessToken;
  }

  getUser(): User | null {
    if (!this.user && typeof window !== 'undefined') {
      const userData = localStorage.getItem('user')
      if (userData) {
        try { this.user = JSON.parse(userData) } catch { /* ignore */ }
      }
    }
    return this.user;
  }

  /**
   * Check if the user appears to have a session locally.
   *
   * IMPORTANT: This is a FAST, SYNCHRONOUS check only — it does NOT validate
   * the token with the backend. Use `getCurrentUser()` for actual validation.
   *
   * In production, ProtectedRoute calls `getCurrentUser()` to verify the token
   * before granting access. This method is for UI decisions (show login vs.
   * logout button, etc.) where a fast local check is acceptable.
   */
  isAuthenticated(): boolean {
    const hasToken = !!this.getAccessToken();
    const hasUser = !!this.getUser();
    // Also check that the stored token isn't obviously expired
    // (we validate the JWT exp claim client-side as a cheap first pass)
    if (hasToken && !this.isTokenExpired(this.getAccessToken()!)) {
      return hasUser;
    }
    return false;
  }

  /**
   * Client-side exp check — does NOT verify the signature.
   * This is a cheap first pass only; actual validation happens server-side.
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // convert to ms
      return Date.now() >= exp;
    } catch {
      return true; // can't parse → treat as expired
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const authResponse: AuthResponse = await response.json();
      this.saveTokens(authResponse.access_token, authResponse.refresh_token, authResponse.user);
      
      return authResponse;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const authResponse: AuthResponse = await response.json();
      this.saveTokens(authResponse.access_token, authResponse.refresh_token, authResponse.user);
      
      return authResponse;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      const token = this.getAccessToken()
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  async refreshAccessToken(): Promise<string> {
    // Fall back to localStorage in case refresh token was set externally
    if (!this.refreshToken && typeof window !== 'undefined') {
      this.refreshToken = localStorage.getItem('refresh_token')
    }
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.accessToken = data.access_token;

      // Handle refresh token rotation (new refresh token issued on each refresh)
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('refresh_token', data.refresh_token);
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', data.access_token);
      }

      return data.access_token;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearTokens();
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    const token = this.getAccessToken()
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          try {
            await this.refreshAccessToken();
            return this.getCurrentUser();
          } catch {
            this.clearTokens();
            return null;
          }
        }
        return null;
      }

      const user = await response.json();
      this.user = user;
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(user));
      }
      
      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  // Helper method to get auth headers for API requests
  getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    const token = this.getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }
}

// Export singleton instance
export const authService = new AuthService();
