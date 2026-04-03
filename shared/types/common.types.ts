/**
 * Shared TypeScript types used across the application
 */

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

// User and authentication types
export interface UserInfo {
  id: string;
  email: string;
  roles: string[];
  permissions?: string[];
  organizationId?: string;
  isActive: boolean;
}

export interface JWTPayload {
  sub: string; // user ID
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

// Audit types
export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
}

// Common query filters
export interface DateRangeFilter {
  from: Date | string;
  to?: Date | string;
}

export interface SearchFilters {
  query?: string;
  status?: string;
  dateRange?: DateRangeFilter;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface Registry {
  [key: string]: any;
}
