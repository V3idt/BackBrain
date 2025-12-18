/**
 * Branding Configuration
 * 
 * Single source of truth for all branding-related strings.
 * Update these values to rebrand the entire application.
 */

export const BRANDING = {
  /** Display name (PascalCase) */
  name: 'BackBrain',
  
  /** Package name (lowercase) */
  nameLower: 'backbrain',
  
  /** Environment variable prefix (UPPERCASE) */
  nameUpper: 'BACKBRAIN',
  
  /** VS Code extension display name */
  displayName: 'BackBrain',
  
  /** VS Code extension publisher */
  publisher: 'backbrain',
  
  /** Package scope for npm */
  scope: '@backbrain',
  
  /** Environment variable prefix with underscore */
  envPrefix: 'BACKBRAIN_',
  
  /** Command prefix for VS Code */
  commandPrefix: 'backbrain',
  
  /** Configuration prefix for VS Code settings */
  configPrefix: 'backbrain',
} as const;

/**
 * Get environment variable with branding prefix
 */
export function getEnvVar(name: string): string | undefined {
  return process.env[`${BRANDING.envPrefix}${name}`];
}

/**
 * Get VS Code command ID with branding prefix
 */
export function getCommandId(command: string): string {
  return `${BRANDING.commandPrefix}.${command}`;
}

/**
 * Get VS Code configuration key with branding prefix
 */
export function getConfigKey(key: string): string {
  return `${BRANDING.configPrefix}.${key}`;
}
