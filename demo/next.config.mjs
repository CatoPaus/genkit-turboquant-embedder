/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["genkit-turboquant-embedder", "@genkit-ai/dev-local-vectorstore"]
};

export default nextConfig;
