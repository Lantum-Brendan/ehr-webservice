import axios, { AxiosInstance } from "axios";
import { logger } from "../../shared/logger/index.js";
import { config } from "../../core/config/index.js";

/**
 * External API client for insurance/payer systems
 * Handles eligibility checks, claims submission, and benefit inquiries
 */

export interface EligibilityRequest {
  patientId: string;
  memberId: string;
  providerId: string;
  serviceCodes: string[];
  serviceDate: Date;
}

export interface EligibilityResponse {
  eligible: boolean;
  coverageStatus: "active" | "inactive" | "terminated";
  benefits: {
    deductibleRemaining: number;
    copay: number;
    coinsurance: number;
    maxBenefits?: number;
  }[];
  notes?: string;
}

export class InsuranceApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.external.insuranceApiUrl || "http://localhost:4002",
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "EHR-Webservice/1.0",
      },
    });

    // Interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(
          { method: config.method, url: config.url },
          "Insurance API request",
        );
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error(
          { error: error.message, url: error.config?.url },
          "Insurance API error",
        );
        return Promise.reject(error);
      },
    );
  }

  /**
   * Check patient insurance eligibility and benefits
   */
  async checkEligibility(
    request: EligibilityRequest,
  ): Promise<EligibilityResponse> {
    try {
      const response = await this.client.post("/eligibility", request);
      return response.data;
    } catch (error: any) {
      logger.error(
        { error: error.message, request },
        "Failed to check eligibility",
      );
      throw new Error(`Insurance API error: ${error.message}`);
    }
  }

  /**
   * Submit insurance claim
   */
  async submitClaim(
    claimData: any,
  ): Promise<{ claimId: string; status: string }> {
    try {
      const response = await this.client.post("/claims", claimData);
      return response.data;
    } catch (error: any) {
      logger.error(
        { error: error.message, claimData },
        "Failed to submit claim",
      );
      throw new Error(`Insurance API error: ${error.message}`);
    }
  }

  /**
   * Check claim status
   */
  async getClaimStatus(
    claimId: string,
  ): Promise<{ status: string; paidAmount?: number }> {
    try {
      const response = await this.client.get(`/claims/${claimId}`);
      return response.data;
    } catch (error: any) {
      logger.error(
        { error: error.message, claimId },
        "Failed to get claim status",
      );
      throw new Error(`Insurance API error: ${error.message}`);
    }
  }
}

// Export singleton instance
export const insuranceApiClient = new InsuranceApiClient();
