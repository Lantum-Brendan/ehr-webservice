export interface Provider {
  id: string;
  name: string;
  specialization: string | null;
  isActive: boolean;
}

export interface CreateProviderInput {
  name: string;
  specialization?: string;
}

export interface ProviderWithDefault extends Provider {
  specialization: string | null;
}
