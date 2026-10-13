import { z } from 'zod';

export const payFrequencyEnum = z.enum(['WEEKLY', 'MONTHLY', 'CONTRACT']);
export type PayFrequency = z.infer<typeof payFrequencyEnum>;

export const createUserSchema = z
  .object({
    name: z.string().min(2, 'Name is required').max(100),
    grant_access: z.boolean().optional().default(false),
    email: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val.toLowerCase() : null))
      .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
        message: 'Invalid email format',
      }),
    password: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim().length > 0 ? val : null)),
    role_id: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
    job_title: z.string().max(100).optional().nullable(),
    joining_date: z.string().optional().nullable(),
    pay_frequency: payFrequencyEnum.default('MONTHLY'),
    base_salary: z.coerce.number().min(0, 'Base salary must be non-negative').default(0),
    salary_amount: z.coerce.number().min(0).optional(),
    last_paid_date: z.string().optional().nullable(),
    is_active: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.grant_access) {
      if (!data.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Email is required when granting system login access',
          path: ['email'],
        });
      }
      if (!data.password || data.password.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must be at least 8 characters when granting system access',
          path: ['password'],
        });
      }
      if (!data.role_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'System Role is required when granting system login access',
          path: ['role_id'],
        });
      }
    }
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  grant_access: z.boolean().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val.toLowerCase() : null))
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Invalid email format',
    }),
  password: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val : null)),
  role_id: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  is_active: z.boolean().optional(),
  job_title: z.string().max(100).optional().nullable(),
  joining_date: z.string().optional().nullable(),
  pay_frequency: payFrequencyEnum.optional(),
  base_salary: z.coerce.number().min(0, 'Base salary must be non-negative').optional(),
  salary_amount: z.coerce.number().min(0).optional(),
  last_paid_date: z.string().optional().nullable(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
