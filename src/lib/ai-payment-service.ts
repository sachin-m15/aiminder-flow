import { chatApiClient } from '@/api/chat/client';
import { supabase } from '@/integrations/supabase/client';

export interface EmployeePerformanceData {
  user_id: string;
  performance_score: number;
  tasks_completed: number;
  on_time_rate: number;
  quality_score: number;
  hourly_rate: number;
  avg_completion_time?: string;
}

export interface TaskData {
  id: string;
  title: string;
  estimated_hours: number;
  complexity_multiplier: number;
  started_at?: string;
  completed_at?: string;
  actual_hours_logged: number;
  priority: string;
  required_skills: string[];
}

export interface PaymentCalculationResult {
  estimated_amount: number;
  reasoning: string;
  confidence_score: number;
  calculation_factors: {
    base_hours: number;
    performance_multiplier: number;
    complexity_multiplier: number;
    final_rate: number;
  };
}

export interface PaymentEstimationInput {
  employee: EmployeePerformanceData;
  task: TaskData;
  historical_payments?: Array<{
    amount: number;
    task_complexity: number;
    employee_performance: number;
  }>;
}

/**
 * AI-powered payment estimation service
 * Calculates dynamic payment amounts based on employee performance and task characteristics
 */
export class AIPaymentService {
  private static readonly MAX_RETRIES = 3;
  private static readonly CONFIDENCE_THRESHOLD = 0.7;

  /**
   * Calculate AI-suggested payment amount for a completed task
   */
  static async calculatePayment(input: PaymentEstimationInput): Promise<PaymentCalculationResult> {
    try {
      // Get historical payment data for context
      const historicalData = await this.getHistoricalPaymentData(input.employee.user_id);

      // Generate AI estimation using structured prompt
      const aiResult = await this.callAIForEstimation({
        ...input,
        historical_payments: historicalData
      });

      // Validate and sanitize the result
      const validatedResult = this.validateAndSanitizeResult(aiResult, input);

      return validatedResult;
    } catch (error) {
      console.error('AI Payment calculation failed:', error);
      // Fallback to rule-based calculation
      return this.fallbackCalculation(input);
    }
  }

  /**
   * Get historical payment data for an employee to provide context
   */
  private static async getHistoricalPaymentData(employeeId: string, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          amount_manual,
          amount_ai_suggested,
          tasks!inner (
            complexity_multiplier,
            priority,
            estimated_hours
          )
        `)
        .eq('user_id', employeeId)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(payment => ({
        amount: payment.amount_manual || payment.amount_ai_suggested || 0,
        task_complexity: payment.tasks?.complexity_multiplier || 1.0,
        employee_performance: 0.85 // Default performance score
      }));
    } catch (error) {
      console.warn('Failed to fetch historical payment data:', error);
      return [];
    }
  }

  /**
   * Call AI API with structured prompt for payment estimation
   */
  private static async callAIForEstimation(input: PaymentEstimationInput): Promise<any> {
    const prompt = this.buildEstimationPrompt(input);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const messages: Array<{role: 'user' | 'assistant', content: string}> = [
          {
            role: 'user',
            content: `You are an expert payment analyst for a task management system. Your role is to calculate fair payment amounts based on employee performance, task complexity, and historical data. Always provide calculations with clear reasoning and confidence scores.

Return your response as a valid JSON object with this exact structure:
{
  "estimated_amount": number,
  "reasoning": "string explanation",
  "confidence_score": number between 0-1,
  "calculation_factors": {
    "base_hours": number,
    "performance_multiplier": number,
    "complexity_multiplier": number,
    "final_rate": number
  }
}

${prompt}`
          }
        ];

        const response = await chatApiClient.sendMessage(messages, 'admin');

        if (!response.success) {
          throw new Error(response.error || 'AI API call failed');
        }

        // Try to extract JSON from the response
        const jsonMatch = response.response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in AI response');
        }

        const result = JSON.parse(jsonMatch[0]);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`AI estimation attempt ${attempt} failed:`, error);

        if (attempt < this.MAX_RETRIES) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('All AI estimation attempts failed');
  }

  /**
   * Build structured prompt for AI payment estimation
   */
  private static buildEstimationPrompt(input: PaymentEstimationInput): string {
    const { employee, task, historical_payments } = input;

    return `
Calculate a fair payment amount for the following task completion:

EMPLOYEE PERFORMANCE DATA:
- Performance Score: ${employee.performance_score}/1.0
- Tasks Completed: ${employee.tasks_completed}
- On-Time Rate: ${(employee.on_time_rate * 100).toFixed(1)}%
- Quality Score: ${(employee.quality_score * 100).toFixed(1)}%
- Hourly Rate: $${employee.hourly_rate}
- Average Completion Time: ${employee.avg_completion_time || 'N/A'}

TASK DETAILS:
- Title: ${task.title}
- Estimated Hours: ${task.estimated_hours}
- Complexity Multiplier: ${task.complexity_multiplier}
- Actual Hours Logged: ${task.actual_hours_logged}
- Priority: ${task.priority}
- Required Skills: ${task.required_skills.join(', ') || 'None specified'}
- Time to Complete: ${this.calculateCompletionTime(task)} hours

HISTORICAL PAYMENT CONTEXT:
${historical_payments && historical_payments.length > 0
  ? historical_payments.map(p =>
      `- Amount: $${p.amount}, Complexity: ${p.task_complexity}, Performance: ${p.employee_performance}`
    ).join('\n')
  : 'No historical payment data available'
}

CALCULATION REQUIREMENTS:
1. Base payment = actual hours worked × employee's hourly rate
2. Apply performance multiplier based on employee's metrics (0.8-1.3 range)
3. Apply task complexity multiplier
4. Consider historical payment patterns for similar tasks
5. Ensure payment is reasonable and fair

Provide the estimated amount, detailed reasoning, confidence score, and calculation factors.
`;
  }

  /**
   * Calculate actual completion time from task data
   */
  private static calculateCompletionTime(task: TaskData): number {
    if (task.started_at && task.completed_at) {
      const start = new Date(task.started_at);
      const end = new Date(task.completed_at);
      return (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
    }
    return task.actual_hours_logged || task.estimated_hours;
  }

  /**
   * Validate and sanitize AI result
   */
  private static validateAndSanitizeResult(
    aiResult: any,
    input: PaymentEstimationInput
  ): PaymentCalculationResult {
    // Ensure estimated amount is reasonable
    const minAmount = input.task.actual_hours_logged * input.employee.hourly_rate * 0.5;
    const maxAmount = input.task.actual_hours_logged * input.employee.hourly_rate * 2.0;

    let estimated_amount = aiResult.estimated_amount;
    if (estimated_amount < minAmount || estimated_amount > maxAmount) {
      console.warn(`AI estimated amount ${estimated_amount} outside reasonable range [${minAmount}, ${maxAmount}], adjusting`);
      estimated_amount = Math.max(minAmount, Math.min(maxAmount, estimated_amount));
    }

    // Ensure confidence score is valid
    const confidence_score = Math.max(0, Math.min(1, aiResult.confidence_score || 0.5));

    return {
      estimated_amount: Math.round(estimated_amount * 100) / 100, // Round to cents
      reasoning: aiResult.reasoning || 'AI calculation completed',
      confidence_score,
      calculation_factors: {
        base_hours: aiResult.calculation_factors?.base_hours || input.task.actual_hours_logged,
        performance_multiplier: aiResult.calculation_factors?.performance_multiplier || 1.0,
        complexity_multiplier: aiResult.calculation_factors?.complexity_multiplier || input.task.complexity_multiplier,
        final_rate: aiResult.calculation_factors?.final_rate || input.employee.hourly_rate
      }
    };
  }

  /**
   * Fallback calculation when AI fails
   */
  private static fallbackCalculation(input: PaymentEstimationInput): PaymentCalculationResult {
    const { employee, task } = input;

    // Simple rule-based calculation
    const baseHours = task.actual_hours_logged || task.estimated_hours;
    const baseAmount = baseHours * employee.hourly_rate;

    // Performance multiplier (weighted average of metrics)
    const performanceMultiplier = (
      employee.performance_score * 0.4 +
      employee.on_time_rate * 0.3 +
      employee.quality_score * 0.3
    );

    // Complexity adjustment
    const complexityMultiplier = task.complexity_multiplier;

    // Priority bonus
    const priorityBonus = task.priority === 'high' ? 1.1 : task.priority === 'medium' ? 1.05 : 1.0;

    const estimated_amount = baseAmount * performanceMultiplier * complexityMultiplier * priorityBonus;

    return {
      estimated_amount: Math.round(estimated_amount * 100) / 100,
      reasoning: `Fallback calculation: Base amount ($${baseAmount.toFixed(2)}) × Performance multiplier (${performanceMultiplier.toFixed(2)}) × Complexity (${complexityMultiplier}) × Priority bonus (${priorityBonus})`,
      confidence_score: 0.6,
      calculation_factors: {
        base_hours: baseHours,
        performance_multiplier: performanceMultiplier,
        complexity_multiplier: complexityMultiplier,
        final_rate: employee.hourly_rate * priorityBonus
      }
    };
  }

  /**
   * Process payment estimation for a completed task
   * This is the main entry point called when tasks are completed
   */
  static async processTaskCompletion(taskId: string): Promise<void> {
    try {
      console.log(`Processing AI payment estimation for task ${taskId}`);

      // Get task and employee data
      const taskData = await this.getTaskCompletionData(taskId);
      if (!taskData) {
        console.warn(`No completion data found for task ${taskId}`);
        return;
      }

      // Calculate AI payment
      const estimation = await this.calculatePayment(taskData);

      // Store the AI suggestion in payments table
      await this.storePaymentEstimation(taskId, estimation);

      console.log(`AI payment estimation completed for task ${taskId}: $${estimation.estimated_amount}`);

    } catch (error) {
      console.error(`Failed to process payment estimation for task ${taskId}:`, error);
      // Don't throw - we don't want to block task completion
    }
  }

  /**
   * Get all necessary data for payment calculation
   */
  private static async getTaskCompletionData(taskId: string): Promise<PaymentEstimationInput | null> {
    try {
      // Get task data
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          estimated_hours,
          complexity_multiplier,
          started_at,
          completed_at,
          priority,
          assigned_to
        `)
        .eq('id', taskId)
        .eq('status', 'completed')
        .single();

      if (taskError || !taskData) {
        console.error('Failed to fetch task data:', taskError);
        return null;
      }

      // Get employee profile data
      const { data: employeeData, error: employeeError } = await supabase
        .from('employee_profiles')
        .select(`
          user_id,
          performance_score,
          tasks_completed,
          on_time_rate,
          quality_score,
          hourly_rate,
          avg_completion_time
        `)
        .eq('user_id', taskData.assigned_to)
        .single();

      if (employeeError || !employeeData) {
        console.error('Failed to fetch employee data:', employeeError);
        return null;
      }

      // Get actual hours logged from task updates
      const { data: updates } = await supabase
        .from('task_updates')
        .select('hours_logged')
        .eq('task_id', taskId)
        .not('hours_logged', 'is', null);

      const actualHoursLogged = updates?.reduce((sum, update) => sum + (update.hours_logged || 0), 0) || 0;

      // Get required skills
      const { data: skills } = await supabase
        .from('task_required_skills')
        .select('skill')
        .eq('task_id', taskId);

      const requiredSkills = skills?.map(s => s.skill).filter(Boolean) || [];

      const employee = employeeData as EmployeePerformanceData;
      const task: TaskData = {
        id: taskData.id,
        title: taskData.title,
        estimated_hours: taskData.estimated_hours || 0,
        complexity_multiplier: taskData.complexity_multiplier || 1.0,
        started_at: taskData.started_at,
        completed_at: taskData.completed_at,
        actual_hours_logged: actualHoursLogged,
        priority: taskData.priority || 'medium',
        required_skills: requiredSkills
      };

      return { employee, task };
    } catch (error) {
      console.error('Error fetching task completion data:', error);
      return null;
    }
  }

  /**
   * Store the AI payment estimation in the database
   */
  private static async storePaymentEstimation(
    taskId: string,
    estimation: PaymentCalculationResult
  ): Promise<void> {
    try {
      // Check if payment record already exists
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('task_id', taskId)
        .single();

      const paymentData = {
        amount_ai_suggested: estimation.estimated_amount,
        // Store reasoning and factors as JSON in a new column or update existing record
      };

      if (existingPayment) {
        // Update existing payment
        await supabase
          .from('payments')
          .update(paymentData)
          .eq('id', existingPayment.id);
      } else {
        // Create new payment record
        const { data: task } = await supabase
          .from('tasks')
          .select('assigned_to')
          .eq('id', taskId)
          .single();

        if (task?.assigned_to) {
          await supabase
            .from('payments')
            .insert({
              user_id: task.assigned_to,
              task_id: taskId,
              ...paymentData,
              status: 'pending'
            });
        }
      }
    } catch (error) {
      console.error('Failed to store payment estimation:', error);
      throw error;
    }
  }
}

export default AIPaymentService;