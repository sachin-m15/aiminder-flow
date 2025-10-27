import { Experimental_Agent as Agent } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getToolsForRole } from '../tools/registry';
import { SYSTEM_PROMPTS } from '../config';

/**
 * Agent registry for role-specific AI agents
 */
export class AgentRegistry {
  private static agents = new Map<string, Agent>();

  /**
   * Get or create an agent for a specific role
   */
  static getAgent(role: 'admin' | 'employee'): Agent {
    const key = role;
    
    if (!this.agents.has(key)) {
      const tools = getToolsForRole(role);
      const systemPrompt = SYSTEM_PROMPTS[role];

      const openaiClient = createOpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      });

      const agent = new Agent({
        model: openaiClient('gpt-4o-2024-11-20'),
        system: systemPrompt,
        tools,
        temperature: 0.7,
        maxSteps: 10,
      });

      this.agents.set(key, agent);
    }

    return this.agents.get(key)!;
  }

  /**
   * Clear all cached agents (useful for testing or development)
   */
  static clearAgents() {
    this.agents.clear();
  }

  /**
   * Get all available agent roles
   */
  static getAvailableRoles(): string[] {
    return ['admin', 'employee'];
  }
}