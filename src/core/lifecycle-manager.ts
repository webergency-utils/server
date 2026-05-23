import { store } from './registry.js';

export class LifecycleManager {
  public static getAllInstances(): any[] {
    const instances = new Set<any>();

    // 1. Modules, Providers & Controllers in each module
    for (const m of store.moduleInstances.values()) {
      if (m.moduleClass && m.moduleClass.name) {
        const modInst = m.instances.get(m.moduleClass.name);
        if (modInst) instances.add(modInst);
      }
      for (const inst of m.instances.values()) {
        if (inst && typeof inst === 'object') {
          instances.add(inst);
        }
      }
    }

    // 2. Fallback/legacy global instances
    for (const inst of store.instances.values()) {
      if (inst && typeof inst === 'object') {
        instances.add(inst);
      }
    }
    for (const inst of store.controllers.values()) {
      if (inst && typeof inst === 'object') {
        instances.add(inst);
      }
    }
    for (const inst of store.guards.values()) {
      if (inst && typeof inst === 'object') {
        instances.add(inst);
      }
    }
    for (const inst of store.interceptors.values()) {
      if (inst && typeof inst === 'object') {
        instances.add(inst);
      }
    }

    return Array.from(instances);
  }

  public static async invokeHook(hookName: string, ...args: any[]) {
    const instances = this.getAllInstances();
    for (const instance of instances) {
      if (instance && typeof instance[hookName] === 'function') {
        await instance[hookName](...args);
      }
    }
  }
}
