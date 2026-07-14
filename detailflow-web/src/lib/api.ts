import axios from 'axios';
import { env } from '@/lib/env';
import { emitPlanLimit } from '@/lib/planLimits';
import { useAuthStore } from '@/store/authStore';

type ApiErrorBody = {
  error?: string;
  message?: string;
  title?: string;
  upgrade?: boolean;
};

const api = axios.create({
  baseURL: env.apiUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const body = error.response?.data as ApiErrorBody | undefined;
    const requestUrl = String(error.config?.url ?? '');
    const isAnonymousAuthRequest = [
      '/auth/login',
      '/auth/register-tenant',
      '/auth/accept-invite',
      '/auth/reset-password',
      '/platform/auth/login',
    ].some((path) => requestUrl.endsWith(path));
    if (error.response?.status === 402 && body?.upgrade === true) {
      emitPlanLimit({ message: body.message ?? body.error ?? body.title });
    }
    if (error.response?.status === 401 && !isAnonymousAuthRequest && typeof window !== 'undefined') {
      useAuthStore.getState().logout();
      window.location.href = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return fallback;
  }

  const body = error.response?.data;
  if (body?.upgrade && body.message) {
    return body.message;
  }

  return body?.error
    ?? body?.message
    ?? body?.title
    ?? fallback;
}

export default api;
