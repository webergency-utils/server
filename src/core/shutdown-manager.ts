import { Logger } from './types.js';
import { MetadataStore } from './metadata.js';

export interface ShutdownOptions {
  shutdownTimeout?: number;
  logger: Logger;
  nodeServerClose?: () => Promise<void> | void;
  beforeShutdownEmit?: () => void;
  shutdownEmit?: () => void;
}

export class ShutdownManager {
  private isShuttingDown = false;
  
  constructor(private options: ShutdownOptions) {}

  public setupSignals(shutdownFn: (signal?: string) => Promise<void>) {
    const handleSignal = (signal: string) => {
      this.options.logger.warn(`\nReceived ${signal}. Starting graceful shutdown...`, {
        type: 'server_shutdown',
        reason: signal
      });
      shutdownFn(signal);
    };

    if (typeof process !== 'undefined') {
      process.on('SIGTERM', () => handleSignal('SIGTERM'));
      process.on('SIGINT', () => handleSignal('SIGINT'));
    } 
    else if ((globalThis as any).Deno) {
      (globalThis as any).Deno.addSignalListener('SIGTERM', () => handleSignal('SIGTERM'));
      (globalThis as any).Deno.addSignalListener('SIGINT', () => handleSignal('SIGINT'));
    }
  }

  public async shutdown(signal?: string, activeRequestsGetter: () => number = () => 0) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    if (this.options.beforeShutdownEmit) {
      this.options.beforeShutdownEmit();
    }

    await MetadataStore.invokeHook('onModuleDestroy');
    await MetadataStore.invokeHook('beforeApplicationShutdown', signal);

    if (this.options.nodeServerClose) {
      await this.options.nodeServerClose();
    }

    const timeout = this.options.shutdownTimeout || 10000;
    const startTime = Date.now();

    this.options.logger.info(`Waiting for ${activeRequestsGetter()} active requests to finish (Timeout: ${timeout}ms)...`, {
      type: 'server_shutdown',
      activeRequests: activeRequestsGetter(),
      timeout
    });

    const checkActive = async () => {
      while (activeRequestsGetter() > 0) {
        if (Date.now() - startTime > timeout) {
          this.options.logger.warn(`Shutdown timed out after ${timeout}ms. Force killing ${activeRequestsGetter()} remaining requests.`, {
            type: 'server_shutdown',
            reason: 'timeout',
            activeRequests: activeRequestsGetter()
          });
          break;
        }
        await new Promise(r => setTimeout(r, 100));
      }
    };

    await checkActive();
    await MetadataStore.invokeHook('onApplicationShutdown', signal);

    this.options.logger.info('Shutdown complete. Goodbye!', {
      type: 'server_shutdown',
      reason: 'complete'
    });

    if (this.options.shutdownEmit) {
      this.options.shutdownEmit();
    }
    
    if (typeof process !== 'undefined') process.exit(0);
    else if ((globalThis as any).Deno) (globalThis as any).Deno.exit(0);
  }

  public getShuttingDown(): boolean {
    return this.isShuttingDown;
  }

  public setShuttingDown(val: boolean) {
    this.isShuttingDown = val;
  }
}
