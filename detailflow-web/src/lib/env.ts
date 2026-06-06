const defaultApiUrl = process.env.NODE_ENV === 'production'
  ? '/api'
  : 'http://localhost:5000/api';

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || defaultApiUrl,
  upgradeUrl: process.env.NEXT_PUBLIC_UPGRADE_URL || '',
};
