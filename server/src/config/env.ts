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
  get DEBUG() {
    return process.env.DEBUG === "true";
  },
  get JWT_SECRET() {
    return requireEnv("JWT_SECRET");
  },
  get JWT_EXPIRES_IN() {
    return process.env.JWT_EXPIRES_IN || "7d";
  },
} as const;
