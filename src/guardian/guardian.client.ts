import type { GuardianAction, DetectedEntity, GuardianActionConfig } from '../types';

/**
 * Guardian Client - Pre-LLM Protection
 * 
 * Fast, local PII detection to prevent sensitive data from reaching LLMs.
 * Built for B2B SaaS protecting their LLM products from users sending PII.
 * 
 * Design principles:
 * - Fast: < 100ms latency (regex + local ML)
 * - Fail-safe: If detection fails, allow call (don't break user experience)
 * - Redacted reasoning: "Passport GB1****789 detected" for audit trails
 * - Local-first: Most detection happens client-side for speed
 */

export interface GuardianScanRequest {
  sandbox: string;
  provider: string;
  model: string;
  systemPrompt: string;
  userInput: string;
}

export interface GuardianResult {
  action: GuardianAction;
  violations: string[];
  reasoning: string; // Redacted: "Email j****@example.com detected"
  cleanPrompt: string; // Redacted version
  confidence: number; // 0-1
  detectedEntities: DetectedEntity[];
  recommendations?: string[];
}

export class GuardianClient {
  private endpoint: string;
  private continumKey: string;
  private localPatterns!: Map<string, RegExp>;

  constructor(endpoint: string, continumKey: string) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.continumKey = continumKey;
    this.initializeLocalPatterns();
  }

  /**
   * Fast local PII patterns for immediate detection
   * These run client-side for < 10ms latency
   */
  private initializeLocalPatterns() {
    this.localPatterns = new Map([
      // Email addresses
      ['EMAIL', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
      
      // US SSN
      ['SSN', /\b\d{3}-?\d{2}-?\d{4}\b/g],
      
      // Credit cards (basic Luhn check would be better)
      ['CREDIT_CARD', /\b(?:\d{4}[-\s]?){3}\d{4}\b/g],
      
      // Phone numbers
      ['PHONE', /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g],
      
      // UK Passport
      ['PASSPORT', /\b[A-Z]{1,2}[0-9]{6,7}\b/g],
      
      // US Passport
      ['PASSPORT', /\b[0-9]{9}\b/g],
      
      // IP addresses (can be PII in some contexts)
      ['IP_ADDRESS', /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g],
      
      // Basic health identifiers
      ['HEALTH_ID', /\b(?:MRN|MR|PATIENT)[#:\s]*[A-Z0-9]{6,12}\b/gi],
      
      // Address patterns
      ['ADDRESS', /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi],
    ]);
  }

  /**
   * Scan prompt for PII before sending to LLM
   * Two-tier approach:
   * 1. Fast local regex scan (< 10ms)
   * 2. If needed, call remote ML model (< 100ms)
   */
  async scanPrompt(request: GuardianScanRequest): Promise<GuardianResult> {
    try {
      // Tier 1: Fast local pattern matching
      const localResult = this.scanLocalPatterns(request.userInput);
      
      if (localResult.detectedEntities.length > 0) {
        // Found PII locally - apply action based on sandbox config
        // Note: guardianAction should come from sandbox config in production
        return this.buildGuardianResult(localResult, request, 'REDACT_AND_CONTINUE');
      }
      
      // Tier 2: Remote ML scan for complex cases (optional)
      // Only if local scan found nothing but we want deeper analysis
      if (this.shouldUseRemoteScan(request)) {
        return await this.scanRemote(request);
      }
      
      // No PII detected
      return {
        action: 'ALLOW',
        violations: [],
        reasoning: 'No sensitive data detected',
        cleanPrompt: request.userInput,
        confidence: 0.95,
        detectedEntities: []
      };
      
    } catch (error) {
      // Fail safe - if guardian fails, allow the call
      console.warn('[Guardian] Scan failed, allowing call:', error);
      return {
        action: 'ALLOW',
        violations: [],
        reasoning: 'Guardian scan failed - allowing call',
        cleanPrompt: request.userInput,
        confidence: 0,
        detectedEntities: []
      };
    }
  }

  private scanLocalPatterns(text: string): { detectedEntities: DetectedEntity[] } {
    const detectedEntities: DetectedEntity[] = [];
    
    for (const [type, pattern] of this.localPatterns) {
      const matches = Array.from(text.matchAll(pattern));
      
      for (const match of matches) {
        if (match.index !== undefined) {
          const originalValue = match[0];
          const redactedValue = this.redactValue(type, originalValue);
          
          detectedEntities.push({
            type: type as any,
            originalValue,
            redactedValue,
            start: match.index,
            end: match.index + originalValue.length,
            confidence: this.calculateConfidence(type),
            severity: this.getSeverity(type),
          });
        }
      }
    }
    
    return { detectedEntities };
  }

  private calculateConfidence(type: string): number {
    const confidenceMap: Record<string, number> = {
      EMAIL: 0.95,
      CREDIT_CARD: 0.9,
      SSN: 0.85,
      PHONE: 0.8,
      PASSPORT: 0.9,
      HEALTH_ID: 0.75,
      ADDRESS: 0.7,
      IP_ADDRESS: 0.6,
    };
    
    return confidenceMap[type] || 0.5;
  }

  private getSeverity(type: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const severityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      EMAIL: 'HIGH',
      CREDIT_CARD: 'CRITICAL',
      SSN: 'CRITICAL',
      PHONE: 'MEDIUM',
      PASSPORT: 'HIGH',
      HEALTH_ID: 'HIGH',
      ADDRESS: 'MEDIUM',
      IP_ADDRESS: 'LOW',
    };
    
    return severityMap[type] || 'MEDIUM';
  }

  /**
   * Create redacted version following the pattern: "Passport GB1****789 detected"
   * Shows enough for tracing but protects sensitive data
   */
  private redactValue(type: string, value: string): string {
    switch (type) {
      case 'EMAIL':
        const [local, domain] = value.split('@');
        return `${local.charAt(0)}****@${domain}`;
        
      case 'SSN':
        return `***-**-${value.slice(-4)}`;
        
      case 'CREDIT_CARD':
        const cleaned = value.replace(/[-\s]/g, '');
        return `****-****-****-${cleaned.slice(-4)}`;
        
      case 'PHONE':
        return `***-***-${value.slice(-4)}`;
        
      case 'PASSPORT':
        if (value.length >= 4) {
          return `${value.substring(0, 2)}****${value.slice(-2)}`;
        }
        return '****';
        
      case 'HEALTH_ID':
        return `${value.substring(0, 2)}****${value.slice(-2)}`;
        
      default:
        return '****';
    }
  }

  private buildGuardianResult(
    localResult: { detectedEntities: DetectedEntity[] },
    request: GuardianScanRequest,
    guardianAction: GuardianActionConfig = 'REDACT_AND_CONTINUE'
  ): GuardianResult {
    let cleanPrompt = request.userInput;
    const violations: string[] = [];
    const reasoningParts: string[] = [];
    
    // Apply redactions and build reasoning
    for (const entity of localResult.detectedEntities) {
      cleanPrompt = cleanPrompt.replace(
        entity.originalValue,
        `[REDACTED_${entity.type}]`
      );
      
      violations.push(`${entity.type}_DETECTED`);
      reasoningParts.push(`${entity.type.toLowerCase()} ${entity.redactedValue} detected`);
    }
    
    // Determine action based on guardianAction configuration
    let action: GuardianAction = 'ALLOW';
    
    if (guardianAction === 'ALLOW_ALL') {
      // Guardian disabled - allow everything
      action = 'ALLOW';
    } else if (guardianAction === 'BLOCK_ON_DETECT') {
      // Block if any PII detected
      action = 'BLOCK';
    } else if (guardianAction === 'REDACT_AND_CONTINUE') {
      // Redact PII and continue with LLM call
      action = 'REDACT';
    }
    
    // Calculate average confidence
    const avgConfidence = localResult.detectedEntities.length > 0
      ? localResult.detectedEntities.reduce((sum, e) => sum + e.confidence, 0) / localResult.detectedEntities.length
      : 1.0;
    
    return {
      action,
      violations,
      reasoning: reasoningParts.length > 0 ? reasoningParts.join(', ') : 'No sensitive information detected',
      cleanPrompt,
      confidence: Math.round(avgConfidence * 100) / 100,
      detectedEntities: localResult.detectedEntities
    };
  }

  private shouldUseRemoteScan(request: GuardianScanRequest): boolean {
    // Use remote scan for complex cases or specific sandboxes
    return request.sandbox.includes('strict') || 
           request.userInput.length > 1000 ||
           request.userInput.includes('medical') ||
           request.userInput.includes('patient');
  }

  private async scanRemote(request: GuardianScanRequest): Promise<GuardianResult> {
    const response = await fetch(`${this.endpoint}/guardian/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-continum-key': this.continumKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Remote scan failed: ${response.status}`);
    }

    return await response.json() as GuardianResult;
  }
}