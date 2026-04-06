import type { 
  SandboxConfig, 
  CreateSandboxDto, 
  UpdateSandboxDto 
} from '../types';

/**
 * Sandbox Config Client - Programmatic Sandbox Management
 * 
 * Allows developers to create and manage sandboxes programmatically
 * during development and testing without context-switching to dashboard.
 * 
 * Design principles:
 * - Developer-friendly: Create sandboxes in code
 * - Type-safe: Full TypeScript support
 * - Aligned with API: Matches backend exactly
 * 
 * Note: For viewing violations, compliance reports, and team management,
 * use the dashboard web UI.
 */

export interface SandboxListResponse {
  id: string;
  customerId: string;
  name: string;
  slug: string;
  description?: string;
  sandboxType: string;
  customRules: string[];
  alertThreshold: string;
  guardianAction: string;
  region: string;
  regulations: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    guardianScans: number;
  };
}

export class SandboxConfigClient {
  private endpoint: string;
  private continumKey: string;

  constructor(endpoint: string, continumKey: string) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.continumKey = continumKey;
  }

  /**
   * Create a new sandbox configuration
   * 
   * @example
   * ```typescript
   * const sandbox = await continum.sandboxes.create({
   *   slug: 'pii_strict',
   *   name: 'Strict PII Detection',
   *   sandboxType: 'PII_DETECTION',
   *   guardianAction: 'BLOCK_ON_DETECT',
   *   alertThreshold: 'HIGH',
   *   region: 'EU',
   *   regulations: ['GDPR', 'EU_AI_ACT']
   * });
   * ```
   */
  async create(dto: CreateSandboxDto): Promise<SandboxConfig> {
    const response = await fetch(`${this.endpoint}/sandboxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-continum-key': this.continumKey,
      },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create sandbox: ${response.status} ${error}`);
    }

    return (await response.json()) as SandboxConfig;
  }

  /**
   * List all sandboxes for the current customer
   * 
   * @example
   * ```typescript
   * const sandboxes = await continum.sandboxes.list();
   * console.log(`You have ${sandboxes.length} sandboxes`);
   * ```
   */
  async list(): Promise<SandboxListResponse[]> {
    const response = await fetch(`${this.endpoint}/sandboxes`, {
      method: 'GET',
      headers: {
        'x-continum-key': this.continumKey,
      },
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to list sandboxes: ${response.status} ${error}`);
    }

    return (await response.json()) as SandboxListResponse[];
  }

  /**
   * Get a specific sandbox by slug
   * 
   * @example
   * ```typescript
   * const sandbox = await continum.sandboxes.get('pii_strict');
   * console.log(`Guardian action: ${sandbox.guardianAction}`);
   * ```
   */
  async get(slug: string): Promise<SandboxConfig> {
    const response = await fetch(`${this.endpoint}/sandboxes/${slug}`, {
      method: 'GET',
      headers: {
        'x-continum-key': this.continumKey,
      },
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get sandbox: ${response.status} ${error}`);
    }

    return (await response.json()) as SandboxConfig;
  }

  /**
   * Update an existing sandbox
   * 
   * @example
   * ```typescript
   * await continum.sandboxes.update('pii_strict', {
   *   alertThreshold: 'CRITICAL',
   *   customRules: ['Flag partial card numbers']
   * });
   * ```
   */
  async update(slug: string, dto: UpdateSandboxDto): Promise<SandboxConfig> {
    const response = await fetch(`${this.endpoint}/sandboxes/${slug}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-continum-key': this.continumKey,
      },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to update sandbox: ${response.status} ${error}`);
    }

    return (await response.json()) as SandboxConfig;
  }

  /**
   * Toggle sandbox active state (pause/resume)
   * 
   * @example
   * ```typescript
   * // Pause sandbox
   * await continum.sandboxes.toggle('pii_strict');
   * 
   * // Resume sandbox
   * await continum.sandboxes.toggle('pii_strict');
   * ```
   */
  async toggle(slug: string): Promise<SandboxConfig> {
    const response = await fetch(`${this.endpoint}/sandboxes/${slug}/toggle`, {
      method: 'PATCH',
      headers: {
        'x-continum-key': this.continumKey,
      },
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to toggle sandbox: ${response.status} ${error}`);
    }

    return (await response.json()) as SandboxConfig;
  }

  /**
   * Delete a sandbox
   * 
   * @example
   * ```typescript
   * await continum.sandboxes.delete('old_sandbox');
   * ```
   */
  async delete(slug: string): Promise<{ message: string }> {
    const response = await fetch(`${this.endpoint}/sandboxes/${slug}`, {
      method: 'DELETE',
      headers: {
        'x-continum-key': this.continumKey,
      },
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to delete sandbox: ${response.status} ${error}`);
    }

    return (await response.json()) as { message: string };
  }
}
