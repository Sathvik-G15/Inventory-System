// Offline service for handling data synchronization and caching
export class OfflineService {
  private static readonly STORAGE_PREFIX = 'invenai_';
  private static readonly SYNC_QUEUE_KEY = 'sync_queue';
  private static isOnline = navigator.onLine;

  static init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncQueuedData();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  static isNetworkOnline(): boolean {
    return this.isOnline;
  }

  // Cache data for offline access
  static cacheData(key: string, data: any): void {
    try {
      const cacheKey = this.STORAGE_PREFIX + key;
      const cacheData = {
        data,
        timestamp: Date.now(),
        version: 1
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  // Retrieve cached data
  static getCachedData(key: string): any {
    try {
      const cacheKey = this.STORAGE_PREFIX + key;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cacheData = JSON.parse(cached);
        // Check if data is less than 24 hours old
        if (Date.now() - cacheData.timestamp < 24 * 60 * 60 * 1000) {
          return cacheData.data;
        }
      }
    } catch (error) {
      console.error('Failed to retrieve cached data:', error);
    }
    return null;
  }

  // Queue operations for when back online
  static queueForSync(operation: {
    method: string;
    url: string;
    data?: any;
    timestamp: number;
  }): void {
    try {
      const queueKey = this.STORAGE_PREFIX + this.SYNC_QUEUE_KEY;
      const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
      queue.push(operation);
      localStorage.setItem(queueKey, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to queue operation:', error);
    }
  }

  // Sync queued operations when online
  static async syncQueuedData(): Promise<void> {
    try {
      const queueKey = this.STORAGE_PREFIX + this.SYNC_QUEUE_KEY;
      const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
      
      if (queue.length === 0) return;

      console.log(`Syncing ${queue.length} queued operations...`);
      
      const successfulOps: any[] = [];
      
      for (const operation of queue) {
        try {
          const response = await fetch(operation.url, {
            method: operation.method,
            headers: operation.data ? { 'Content-Type': 'application/json' } : {},
            body: operation.data ? JSON.stringify(operation.data) : undefined,
            credentials: 'include'
          });
          
          if (response.ok) {
            successfulOps.push(operation);
            console.log(`Synced operation: ${operation.method} ${operation.url}`);
          }
        } catch (error) {
          console.error(`Failed to sync operation:`, error);
        }
      }
      
      // Remove successful operations from queue
      if (successfulOps.length > 0) {
        const remainingQueue = queue.filter((op: any) => !successfulOps.includes(op));
        localStorage.setItem(queueKey, JSON.stringify(remainingQueue));
        
        // Refresh cached data after successful sync
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to sync queued data:', error);
    }
  }

  // Enhanced fetch with offline support
  static async fetchWithOffline(url: string, options: RequestInit = {}): Promise<Response> {
    const cacheKey = `fetch_${url}`;
    
    try {
      // Try network first
      if (this.isOnline) {
        const response = await fetch(url, options);
        
        // Cache successful GET requests
        if (response.ok && (!options.method || options.method === 'GET')) {
          const data = await response.clone().json();
          this.cacheData(cacheKey, data);
        }
        
        return response;
      }
    } catch (error) {
      console.log('Network request failed, checking cache:', error);
    }

    // If offline or network failed, try cache for GET requests
    if (!options.method || options.method === 'GET') {
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        console.log('Serving from cache:', url);
        return new Response(JSON.stringify(cachedData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // For write operations when offline, queue them
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      this.queueForSync({
        method: options.method,
        url,
        data: options.body ? JSON.parse(options.body as string) : undefined,
        timestamp: Date.now()
      });
      
      // Return a mock success response
      return new Response(JSON.stringify({ 
        message: 'Operation queued for sync when online',
        queued: true 
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    throw new Error('No cached data available and offline');
  }

  // Clear all cached data
  static clearCache(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Get cache status
  static getCacheStatus(): {
    isOnline: boolean;
    cacheSize: number;
    queuedOperations: number;
    lastSync: number | null;
  } {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(this.STORAGE_PREFIX)
      );
      
      const queueKey = this.STORAGE_PREFIX + this.SYNC_QUEUE_KEY;
      const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
      
      const lastSyncKey = this.STORAGE_PREFIX + 'last_sync';
      const lastSync = localStorage.getItem(lastSyncKey);
      
      return {
        isOnline: this.isOnline,
        cacheSize: keys.length,
        queuedOperations: queue.length,
        lastSync: lastSync ? parseInt(lastSync) : null
      };
    } catch (error) {
      console.error('Failed to get cache status:', error);
      return {
        isOnline: this.isOnline,
        cacheSize: 0,
        queuedOperations: 0,
        lastSync: null
      };
    }
  }

  // Import/Export data for backup
  static exportData(): string {
    try {
      const data: any = {};
      const keys = Object.keys(localStorage);
      
      keys.forEach(key => {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          data[key] = localStorage.getItem(key);
        }
      });
      
      return JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        data
      });
    } catch (error) {
      console.error('Failed to export data:', error);
      return '';
    }
  }

  static importData(exportedData: string): boolean {
    try {
      const parsed = JSON.parse(exportedData);
      
      if (parsed.version === 1 && parsed.data) {
        Object.entries(parsed.data).forEach(([key, value]) => {
          localStorage.setItem(key, value as string);
        });
        return true;
      }
    } catch (error) {
      console.error('Failed to import data:', error);
    }
    return false;
  }
}

// Initialize offline service when module loads
OfflineService.init();
