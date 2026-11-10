import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/auth.service';
import sabirLogo from '../assets/sabirlogo.png';

const resetPasswordSchema = z
  .object({
    new_password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const resetMutation = useMutation({
    mutationFn: (data: ResetPasswordFormData) => authService.resetPassword(token, data.new_password),
    onSuccess: () => {
      setServerError(null);
      setIsSuccess(true);
    },
    onError: (error: import('axios').AxiosError<{ message?: string; error?: string }>) => {
      setServerError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Failed to reset password. The link may have expired or is invalid.',
      );
    },
  });

  // Auto redirect to /login after successful reset
  useEffect(() => {
    if (!isSuccess) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/login', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSuccess, navigate]);

  const onSubmit = (data: ResetPasswordFormData) => {
    if (!token) {
      setServerError('Missing reset token. Please request a new password reset link.');
      return;
    }
    setServerError(null);
    resetMutation.mutate(data);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden bg-slate-950">
      {/* Decorative ambient glowing gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-emerald-600/25 to-teal-600/10 blur-[130px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-amber-600/20 via-orange-500/15 to-transparent blur-[140px]" />
        <div className="absolute top-[35%] left-[25%] w-[40vw] h-[40vw] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img
            src={sabirLogo}
            alt="Sabir Plastic"
            className="h-20 w-auto object-contain drop-shadow-2xl filter brightness-110"
          />
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">
          Reset Password
        </h2>
        <p className="mt-2 text-center text-sm text-slate-300 drop-shadow">
          Choose a strong, new password for your account
        </p>
      </div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Glass Mirror Card */}
        <div className="bg-white/[0.12] backdrop-blur-2xl py-8 px-4 shadow-[0_16px_40px_rgba(0,0,0,0.5)] sm:rounded-3xl sm:px-10 border border-white/30 ring-1 ring-white/20">
          {!token ? (
            <div className="space-y-6 text-center">
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-400/40 backdrop-blur-md flex items-start gap-3 text-left">
                <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-100">
                  Invalid or missing password reset link. Please request a new link from the forgot password page.
                </p>
              </div>
              <Link
                to="/forgot-password"
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-amber-300/40 rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 transition cursor-pointer"
              >
                Go to Forgot Password
              </Link>
            </div>
          ) : isSuccess ? (
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Password Reset Successful!</h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Your password has been securely updated. You will be redirected to the sign in page in{' '}
                  <span className="font-bold text-amber-300 font-mono">{countdown}</span> seconds...
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => navigate('/login', { replace: true })}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-amber-300/40 rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 transition cursor-pointer"
                >
                  Proceed to Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {serverError && (
                <div className="p-4 rounded-xl bg-red-500/20 border border-red-400/40 backdrop-blur-md flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-100">{serverError}</p>
                </div>
              )}

              {/* New Password */}
              <div>
                <label
                  htmlFor="new_password"
                  className="block text-sm font-semibold text-white/90 drop-shadow mb-1.5"
                >
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-white/60" aria-hidden="true" />
                  </div>
                  <input
                    id="new_password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`block w-full pl-10 pr-10 py-2.5 border ${
                      errors.new_password ? 'border-red-400 focus:ring-red-400' : 'border-white/30 focus:border-white/80'
                    } rounded-xl bg-white/15 focus:bg-white/25 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md sm:text-sm transition-all duration-200`}
                    placeholder="••••••••"
                    {...register('new_password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.new_password && (
                  <p className="mt-1 text-xs font-medium text-red-300">{errors.new_password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm_password"
                  className="block text-sm font-semibold text-white/90 drop-shadow mb-1.5"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-white/60" aria-hidden="true" />
                  </div>
                  <input
                    id="confirm_password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`block w-full pl-10 pr-10 py-2.5 border ${
                      errors.confirm_password
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-white/30 focus:border-white/80'
                    } rounded-xl bg-white/15 focus:bg-white/25 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md sm:text-sm transition-all duration-200`}
                    placeholder="••••••••"
                    {...register('confirm_password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="mt-1 text-xs font-medium text-red-300">{errors.confirm_password.message}</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={resetMutation.isPending}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-amber-300/40 rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-amber-500/25"
                >
                  {resetMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-950" />
                      Updating password...
                    </>
                  ) : (
                    <>
                      Set New Password
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2 border-t border-white/10">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

