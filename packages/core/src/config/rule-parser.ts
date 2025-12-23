import { VibeRule, DEFAULT_VIBE_RULES } from './vibe-rules';
import { createLogger } from '../utils/logger';

const logger = createLogger('RuleParser');

interface VibeRuleConfig {
    id: string;
    title: string;
    description: string;
    severity: string;
    pattern?: string;
    type: 'regex' | 'logic' | 'ai';
    aiPrompt?: string;
    examples?: { code: string; issue: string }[];
}

export class RuleParser {
    static parseRules(jsonContent: string, baseRules: VibeRule[] = DEFAULT_VIBE_RULES): VibeRule[] {
        const rules = [...baseRules];

        try {
            const config = JSON.parse(jsonContent) as { rules: VibeRuleConfig[] };

            if (Array.isArray(config.rules)) {
                logger.info(`Found ${config.rules.length} custom Vibe rules`);

                for (const ruleConfig of config.rules) {
                    try {
                        // Validation
                        if (ruleConfig.type === 'ai' && !ruleConfig.aiPrompt) {
                            logger.warn(`Rule ${ruleConfig.id} is type 'ai' but missing 'aiPrompt'. Skipping.`);
                            continue;
                        }

                        if (ruleConfig.type === 'regex' && ruleConfig.pattern) {
                            // Basic ReDoS check: look for nested quantifiers like (a+)+
                            // This is a heuristic and not exhaustive
                            const redosPattern = /\([^)]+[\+\*]\)[\+\*]/;
                            if (redosPattern.test(ruleConfig.pattern)) {
                                logger.warn(`Rule ${ruleConfig.id} has potential ReDoS pattern. Skipping.`);
                                continue;
                            }
                        }

                        const rule: VibeRule = {
                            id: ruleConfig.id,
                            title: ruleConfig.title,
                            description: ruleConfig.description,
                            severity: this.parseSeverity(ruleConfig.severity),
                            type: ruleConfig.type,
                            aiPrompt: ruleConfig.aiPrompt,
                            examples: ruleConfig.examples,
                            pattern: ruleConfig.type === 'regex' && ruleConfig.pattern
                                ? new RegExp(ruleConfig.pattern, 'g')
                                : ruleConfig.pattern
                        };

                        // Check if rule overrides existing one
                        const existingIndex = rules.findIndex(r => r.id === rule.id);
                        if (existingIndex >= 0) {
                            rules[existingIndex] = rule;
                        } else {
                            rules.push(rule);
                        }
                    } catch (err) {
                        logger.error(`Failed to parse rule ${ruleConfig.id}`, { error: err });
                    }
                }
            }
        } catch (error) {
            logger.error('Error parsing rule configuration', { error });
        }

        return rules;
    }

    private static parseSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
        const normalized = severity.toLowerCase();
        if (['low', 'medium', 'high', 'critical'].includes(normalized)) {
            return normalized as 'low' | 'medium' | 'high' | 'critical';
        }
        return 'medium'; // Default
    }
}
