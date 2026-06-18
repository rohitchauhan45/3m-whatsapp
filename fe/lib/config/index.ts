import authConfig from './auth-config.json';
import type { AuthConfig } from '@/lib/types/auth-config';

export const getAuthConfig = (): AuthConfig => {
  return authConfig as AuthConfig;
};

