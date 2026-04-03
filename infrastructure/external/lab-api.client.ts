import axios, { AxiosInstance } from "axios";
import { logger } from "../../shared/logger/index.js";
import { config } from "../../core/config/index.js";

/**
 * External API client for laboratory services
 * Handles integration with external lab partners for order submission and result retrieval
 */

export interface LabOrderRequest {
  patientMrn: string;
  patientName: string;
  testCodes: string[];
  priority: "normal" | "stat" | "urgent";
  orderingProviderId: string;
  specimenInfo?: {
    type: string;
    collectionDate: Date;
  };
}

export interface LabOrderResponse {
  orderId: string;
  labOrderNumber: string;
  status: "received" | "processing" | "completed" | "cancelled";
  estimatedTurnaround?: string;
}

export class LabApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.external.labApiUrl || "http://localhost:4001",
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "EHR-Webservice/1.0",
      },
    });

    // Request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(
          { method: config.method, url: config.url, data: config.data },
          "External API request",
        );
        return config;
      },
      (error) => {
        logger.error({ error }, "External API request error");
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          { status: response.status, url: response.config.url },
          "External API response",
        );
        return response;
      },
      (error) => {
        logger.error(
          { error: error.message, url: error.config?.url },
          "External API error",
        );
        return Promise.reject(error);
      },
    );
  }

  /**
   * Submit lab order to external lab system
   */
  async submitOrder(order: LabOrderRequest): Promise<LabOrderResponse> {
    try {
      const response = await this.client.post("/orders", order);
      return response.data;
    } catch (error: any) {
      logger.error(
        { error: error.message, order },
        "Failed to submit lab order",
      );
      throw new Error(`Lab API error: ${error.message}`);
    }
  }

  /**
   * Pull results from lab system
   */
  async getResults(orderId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/orders/${orderId}/results`);
      return response.data.results || [];
    } catch (error: any) {
      logger.error(
        { error: error.message, orderId },
        "Failed to get lab results",
      );
      throw new Error(`Lab API error: ${error.message}`);
    }
  }

  /**
   * Cancel lab order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    try {
      await this.client.post(`/orders/${orderId}/cancel`, { reason });
    } catch (error: any) {
      logger.error(
        { error: error.message, orderId },
        "Failed to cancel lab order",
      );
      throw new Error(`Lab API error: ${error.message}`);
    }
  }
}

// Export singleton instance
export const labApiClient = new LabApiClient();
