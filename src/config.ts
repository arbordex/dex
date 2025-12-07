/**
 * Environment configuration
 * Loads and validates environment variables
 */


export type Environment = 'development' | 'staging' | 'production';

export interface Config {
  env: Environment;
  port: number;
  host: string;
  isDev: boolean;
  isStaging: boolean;
  isProd: boolean;
}

function getEnvironment(): Environment {
  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}

function getPort(): number {
  const port = process.env.PORT;
  if (!port) return 3000;

  const parsed = parseInt(port, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 65535) {
    console.warn(`Invalid PORT: ${port}, using 3000`);
    return 3000;
  }
  return parsed;
}

function getHost(): string {
  return process.env.HOST || 'localhost';
}

const env = getEnvironment();
const port = getPort();
const host = getHost();

export const config: Config = {
  env,
  port,
  host,
  isDev: env === 'development',
  isStaging: env === 'staging',
  isProd: env === 'production',
};

export default config;
