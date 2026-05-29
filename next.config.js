/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Python backend URL — set NEXT_PUBLIC_API_URL in Vercel env vars
  // Default to localhost for local dev
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
  },
};

module.exports = nextConfig;
