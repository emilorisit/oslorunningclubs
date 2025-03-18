import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * API request queue item
 */
interface QueueItem {
  id: string;
  requestFn: () => Promise<AxiosResponse>;
  retryCount: number;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

/**
 * Resilient HTTP client with rate limiting, queueing and exponential backoff
 */
export class ResilientApiClient {
  private rateLimitRemaining = 100;
  private rateLimitReset = 0;
  private requestQueue: QueueItem[] = [];
  private isProcessingQueue = false;
  private baseDelay = 1000; // 1 second base delay for retries
  private maxRetries = 5;
  private queueConcurrency = 1; // How many requests to process concurrently
  private activeConcurrency = 0;
  private defaultMinDelayBetweenRequests = 200; // ms between requests

  constructor(
    private options: {
      name?: string;
      baseURL?: string;
      defaultHeaders?: Record<string, string>;
      maxRetries?: number;
      baseDelay?: number;
      minDelayBetweenRequests?: number;
      queueConcurrency?: number;
    } = {}
  ) {
    this.maxRetries = options.maxRetries || this.maxRetries;
    this.baseDelay = options.baseDelay || this.baseDelay;
    this.queueConcurrency = options.queueConcurrency || this.queueConcurrency;
    
    console.log(`Initialized resilient API client ${options.name || ''} with max ${this.queueConcurrency} concurrent requests`);
  }

  /**
   * Make a GET request with resilience features
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url,
      ...config
    });
  }

  /**
   * Make a POST request with resilience features
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      ...config
    });
  }

  /**
   * Make a generic request with resilience features
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const queueId = Math.random().toString(36).substring(2, 15);
    
    // Add base URL and default headers from constructor
    const fullConfig: AxiosRequestConfig = {
      ...config,
      baseURL: config.baseURL || this.options.baseURL,
      headers: {
        ...this.options.defaultHeaders,
        ...config.headers
      }
    };
    
    // Create the request function
    const requestFn = async () => {
      return axios.request(fullConfig);
    };
    
    // Queue the request
    return this.queueRequest(queueId, requestFn);
  }

  /**
   * Add a request to the processing queue with exponential backoff
   */
  private async queueRequest<T = any>(
    id: string,
    requestFn: () => Promise<AxiosResponse>,
    retryCount = 0
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Add to queue
      this.requestQueue.push({
        id,
        requestFn,
        retryCount,
        resolve: (response: AxiosResponse) => resolve(response.data),
        reject
      });
      
      // Start processing if not already running
      if (this.activeConcurrency < this.queueConcurrency && !this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with rate limiting awareness
   */
  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0 || this.activeConcurrency >= this.queueConcurrency) {
      this.isProcessingQueue = false;
      return;
    }
    
    this.isProcessingQueue = true;
    this.activeConcurrency++;
    
    // Check if we need to wait for rate limit reset
    const now = Date.now() / 1000;
    if (this.rateLimitRemaining <= 5 && this.rateLimitReset > now) {
      const waitTime = (this.rateLimitReset - now) * 1000 + 1000; // Add 1 second buffer
      console.log(`Rate limit nearly reached (${this.rateLimitRemaining} remaining), waiting ${waitTime/1000}s before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Get next request
    const item = this.requestQueue.shift();
    if (!item) {
      this.activeConcurrency--;
      this.processQueue(); // Continue with next item if available
      return;
    }
    
    // Process with delay between requests to avoid overwhelming the API
    const minDelay = this.options.minDelayBetweenRequests || this.defaultMinDelayBetweenRequests;
    const startTime = Date.now();
    
    try {
      console.log(`Processing request ${item.id} (attempt ${item.retryCount + 1}/${this.maxRetries + 1})`);
      
      // Execute request
      const response = await item.requestFn();
      
      // Update rate limit info from headers
      this.updateRateLimits(response);
      
      // Resolve with the data
      item.resolve(response);
      
      // Calculate how long the request took
      const requestTime = Date.now() - startTime;
      const delayNeeded = Math.max(0, minDelay - requestTime);
      
      // Wait before processing next item
      if (delayNeeded > 0) {
        await new Promise(resolve => setTimeout(resolve, delayNeeded));
      }
    } catch (error: any) {
      // Log the error
      console.error(`Request ${item.id} failed:`, error.message);
      
      // If this is a specific rate limiting or temporary error, retry with backoff
      if (this.shouldRetry(error) && item.retryCount < this.maxRetries) {
        // Calculate backoff time with exponential increase and jitter
        const backoffTime = Math.min(
          30000, // Max 30 seconds
          this.baseDelay * Math.pow(2, item.retryCount) + 
          Math.random() * 1000 // Add up to 1 second of jitter
        );
        
        console.log(`Retrying request ${item.id} in ${backoffTime/1000}s (attempt ${item.retryCount + 1}/${this.maxRetries})`);
        
        // Wait for backoff time
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Re-queue with increased retry count
        this.requestQueue.unshift({
          ...item,
          retryCount: item.retryCount + 1
        });
      } else {
        // Max retries reached or non-retriable error
        console.error(`Request ${item.id} failed after ${item.retryCount + 1} attempts`);
        item.reject(error);
      }
    } finally {
      this.activeConcurrency--;
      this.processQueue(); // Continue with next item
    }
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimits(response: AxiosResponse): void {
    const rateLimitHeader = response.headers['x-ratelimit-limit'];
    const rateLimitRemainingHeader = response.headers['x-ratelimit-remaining'];
    const rateLimitResetHeader = response.headers['x-ratelimit-reset'];
    
    if (rateLimitRemainingHeader) {
      this.rateLimitRemaining = parseInt(rateLimitRemainingHeader);
    }
    
    if (rateLimitResetHeader) {
      this.rateLimitReset = parseInt(rateLimitResetHeader);
    }
    
    if (this.rateLimitRemaining <= 20) {
      console.log(`Rate limit status: ${this.rateLimitRemaining} remaining, resets in ${Math.max(0, this.rateLimitReset - Date.now()/1000)}s`);
    }
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(error: any): boolean {
    // No response means network error
    if (!error.response) {
      return true;
    }
    
    const status = error.response.status;
    
    // Retry on rate limiting
    if (status === 429) {
      return true;
    }
    
    // Retry on server errors
    if (status >= 500 && status < 600) {
      return true;
    }
    
    // Retry on gateway errors
    if (status === 502 || status === 503 || status === 504) {
      return true;
    }
    
    // Don't retry on client errors (except rate limiting)
    if (status >= 400 && status < 500) {
      return false;
    }
    
    // Default to retry for unknown errors
    return true;
  }
}

// Export a singleton instance
export const resilientApi = new ResilientApiClient({
  name: 'strava-api',
  baseURL: 'https://www.strava.com/api/v3',
  queueConcurrency: 2,
  maxRetries: 5,
  baseDelay: 2000,
  minDelayBetweenRequests: 500
});