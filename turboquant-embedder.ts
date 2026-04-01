import { Genkit, z } from 'genkit';
import { Document } from 'genkit/retriever';

/**
 * Zod schema for configuring the TurboQuant embedder.
 * We require the user to provide the base embedder instance that we will wrap.
 */
export const TurboQuantConfigSchema = z.object({
  baseEmbedder: z.any().describe('The base Genkit embedder reference (e.g., googleAI.embedder("text-embedding-004"))'),
});

export type TurboQuantOptions = z.infer<typeof TurboQuantConfigSchema>;

import { createRequire } from 'module';
import path from 'path';

const isNextJsDemo = process.cwd().endsWith('demo');
const addonPath = isNextJsDemo 
    ? path.join(process.cwd(), '../build/Release/turboquant.node')
    : path.join(process.cwd(), './build/Release/turboquant.node');

// Next.js Turbopack strictly analyzes all `require()` calls and crashes on variables.
// We use a dynamic Function constructor to completely hide the Native File require 
// from the bundler's static analysis, forcing Node.js to evaluate it directly at runtime.
const loadBinary = new Function('requireFn', 'binaryPath', 'return requireFn(binaryPath)');
const turboquantAddon = loadBinary(createRequire(import.meta.url), addonPath);

/**
 * Executes the real compiled C++ low-level implementation.
 * Performs absolute 1-bit binary mapping natively against floating point vectors.
 */
export function compressToPolarQuant(vector: number[]): number[] {
  return turboquantAddon.compressToPolarQuant(vector);
}

/**
 * Registers the TurboQuant Embedder middleware within your Genkit instance.
 * 
 * @param ai Genkit instance.
 * @param name Custom name for the embedder. Defaults to 'turboquant/compressor'.
 * @returns The embedder action reference that can be utilized in RAG flows.
 */
export function defineTurboQuantEmbedder(ai: Genkit, name: string = 'turboquant/compressor') {
  return ai.defineEmbedder(
    {
      name,
      configSchema: TurboQuantConfigSchema,
      info: {
        label: 'TurboQuant Compressed Embedder',
        // Optional: specify dimensions if TurboQuant enforces a fixed size
        // dimensions: 256,
      },
    },
    async (inputDocuments, options) => {
      if (!options?.baseEmbedder) {
        throw new Error(
          "TurboQuantEmbedder: 'baseEmbedder' option is required to generate the initial vectors."
        );
      }

      // Request the original high-dimensional embeddings from the wrapped base embedder
      // We process the batch array of Document input using the base embedder.
      const baseResponse = await ai.embedMany({
        embedder: options.baseEmbedder,
        content: inputDocuments.map(doc => doc.text),
      });

      // Map through the original floating point vectors and apply TurboQuant compression algorithm
      const compressedEmbeddings = baseResponse.map((result) => {
        const compressed = compressToPolarQuant(result.embedding);

        // Theoretical memory cost comparisons:
        // A standard float32 vector matrix footprint calculates at 4 bytes per dimension:
        const originalBytes = result.embedding.length * 4;
        
        // Simulating the mathematical storage advantage of TurboQuant which uses 1-bit logic
        // meaning that each dimension now uses merely 1/8th of a byte.
        const compressedBytes = Math.ceil(result.embedding.length / 8); 

        return {
          embedding: compressed,
          metadata: {
            ...((result as any).metadata || {}),
            turboQuantStats: {
              originalBytes,
              compressedBytes,
              bytesSaved: originalBytes - compressedBytes,
            }
          },
        };
      });

      // Return output structured exactly as Genkit's `EmbedResponse`
      return {
        embeddings: compressedEmbeddings,
      };
    }
  );
}
