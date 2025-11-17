import { z } from "zod";

// Auth
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  fullName: z.string().min(1, "Full name is required").min(2, "Full name must be at least 2 characters").trim(),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required").min(6, "Password must be at least 6 characters")
    // .min(8, "Password must be at least 8 characters")
    // .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    // .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    // .regex(/[0-9]/, "Password must contain at least one number")
    // .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

// Task Assignment
export const taskAssignmentSchema = z.object({
  title: z.string().min(1, "Task title is required").max(200, "Task title must be less than 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000, "Description must be less than 1000 characters"),
  priority: z.enum(["low", "medium", "high"]),
  deadline: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return date > new Date();
  }, "Deadline must be a future date"),
  requiredSkills: z.string().optional(),
  selectedEmployee: z.string().uuid("Please select an employee"),
});

// Task Progress Update
export const taskProgressSchema = z.object({
  progress: z.number().min(0, "Progress must be at least 0%").max(100, "Progress cannot exceed 100%"),
  hoursLogged: z.number().min(0, "Hours logged cannot be negative").max(100, "Hours logged cannot exceed 100").optional(),
  updateText: z.string().max(500, "Update text must be less than 500 characters").optional(),
});

// Payment Management
export const paymentAmountSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0").max(10000, "Amount cannot exceed $10,000"),
});

// Employee Inbox (Rejection Reason)
export const rejectionReasonSchema = z.object({
  reason: z.string().max(500, "Reason must be less than 500 characters").optional(),
});

// Employee Profile
export const employeeProfileSchema = z.object({
  department: z.string().max(100, "Department must be less than 100 characters").optional(),
  designation: z.string().max(100, "Designation must be less than 100 characters").optional(),
  hourlyRate: z.number().min(0, "Hourly rate cannot be negative").max(500, "Hourly rate cannot exceed $500").optional(),
  skills: z.array(z.string()).min(1, "At least one skill is required"),
});

// Utility functions
export const validateEmail = (email: string) => {
  return z.string().email().safeParse(email).success;
};

export const validatePassword = (password: string) => {
  return signupSchema.shape.password.safeParse(password).success;
};

export const validateFutureDate = (date: string) => {
  return new Date(date) > new Date();
};

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type TaskAssignmentFormData = z.infer<typeof taskAssignmentSchema>;
export type TaskProgressFormData = z.infer<typeof taskProgressSchema>;
export type PaymentAmountFormData = z.infer<typeof paymentAmountSchema>;
export type RejectionReasonFormData = z.infer<typeof rejectionReasonSchema>;
export type EmployeeProfileFormData = z.infer<typeof employeeProfileSchema>;