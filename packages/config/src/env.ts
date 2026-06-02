export type PublicRuntimeEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  siteUrl: string;
};

export type AdminRuntimeEnv = PublicRuntimeEnv & {
  supabaseServiceRoleKey: string;
  adminUrl: string;
  adminEmail?: string;
};

type EnvSource = Record<string, string | undefined>;

declare const process: { env: EnvSource };

function readRequiredEnv(source: EnvSource, key: string) {
  const value = source[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function readPublicEnv(source: EnvSource = process.env): PublicRuntimeEnv {
  return {
    supabaseUrl: readRequiredEnv(source, "NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey:
      source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      readRequiredEnv(source, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    siteUrl: readRequiredEnv(source, "NEXT_PUBLIC_SITE_URL"),
  };
}

export function readAdminEnv(source: EnvSource = process.env): AdminRuntimeEnv {
  return {
    ...readPublicEnv(source),
    supabaseServiceRoleKey: readRequiredEnv(source, "SUPABASE_SERVICE_ROLE_KEY"),
    adminUrl: readRequiredEnv(source, "ADMIN_URL"),
    adminEmail: source.ADMIN_EMAIL,
  };
}
