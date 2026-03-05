function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get GEMINI_API_KEY() {
    return requireEnv("GEMINI_API_KEY");
  },
  get DATABASE_URL() {
    return process.env.DATABASE_URL || "file:./dev.db";
  },
  get PORT() {
    return parseInt(process.env.PORT || "8080", 10);
  },
} as const;
