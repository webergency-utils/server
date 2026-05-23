import { MetadataStore } from '../core/metadata.js';
import { RequestProcessor } from '../core/request-processor.js';
import { MicroserviceAdapter } from './adapter.js';

export class Microservice {
  constructor(private adapter: MicroserviceAdapter) {}

  async start(): Promise<void> {
    await this.adapter.listen(async (pattern, payload, connection) => {
      const endpoint = MetadataStore.getEndpoints().find(
        (ep: any) => ep.httpMethod === 'RPC' && ep.path === pattern
      );

      if (!endpoint) {
        throw new Error(`Pattern "${pattern}" not registered`);
      }

      try {
        const result = await RequestProcessor.executeRpc(endpoint, payload);
        return result;
      } catch (err: any) {
        // If execution threw an error with structural data (like validation errors),
        // pass it through. Otherwise wrap it.
        if (err.data) {
          throw err;
        }
        throw new Error(err.message || 'Internal RPC error');
      }
    });
  }

  async shutdown(): Promise<void> {
    await this.adapter.close();
  }
}
