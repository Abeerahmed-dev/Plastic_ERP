import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Mail, ArrowLeft, Loader2, AlertCircle, CheckCircle2, RotateCw, Send } from 'lucide-react';
import { authService } from '../services/auth.service';
import sabirLogo from '../assets/sabirlogo.png';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const ForgotPassword = () => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string>('');
  const [cooldown, setCooldown] = useState<number>(0);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const forgotMutation = useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
    onSuccess: (data, email) => {
      setServerError(null);
      setSubmittedEmail(email);
      setSuccessMessage(data.message || 'Password reset link has been sent to your email.');
      setCooldown(60); // 60 seconds cooldown for resend
    },
    onError: (error: import('axios').AxiosError<{ message?: string; error?: string }>) => {
      setServerError(
        error.response?.data?.message || error.response?.data?.error || 'Failed to send reset link. Please try again.',
      );
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    setServerError(null);
    setSuccessMessage(null);
    forgotMutation.mutate(data.email);
  };

  const handleResend = () => {
    if (cooldown > 0 || forgotMutation.isPending) return;
    const emailToResend = submittedEmail || getValues('email');
    if (!emailToResend) return;
    setServerError(null);
    forgotMutation.mutate(emailToResend);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden bg-slate-950">
      {/* Decorative ambient glowing gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-blue-600/25 to-indigo-600/10 blur-[130px]" />
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
          Forgot Password
        </h2>
        <p className="mt-2 text-center text-sm text-slate-300 drop-shadow">
          Enter your registered email to receive a password reset link
        </p>
      </div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Glass Mirror Card */}
        <div className="bg-white/[0.12] backdrop-blur-2xl py-8 px-4 shadow-[0_16px_40px_rgba(0,0,0,0.5)] sm:rounded-3xl sm:px-10 border border-white/30 ring-1 ring-white/20">
          {serverError && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-400/40 backdrop-blur-md flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-100">{serverError}</p>
            </div>
          )}

          {successMessage ? (
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">Reset Link Sent</h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  We've sent a password reset link to:
                  <span className="block mt-1 font-semibold text-amber-300 font-mono text-xs">{submittedEmail}</span>
                </p>
                <p className="text-xs text-slate-400 mt-3">
                  Please check your inbox (and spam/junk folder) and click the link to choose a new password.
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 space-y-3">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || forgotMutation.isPending}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-white/20 rounded-xl text-sm font-bold text-white bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  {forgotMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                      Sending...
                    </>
                  ) : cooldown > 0 ? (
                    <>
                      <RotateCw className="w-4 h-4 mr-2 text-amber-400 animate-spin" />
                      Resend link in {cooldown}s
                    </>
                  ) : (
                    <>
                      <RotateCw className="w-4 h-4 mr-2 text-amber-300" />
                      Resend Reset Link
                    </>
                  )}
                </button>

                <Link
                  to="/login"
                  className="w-full inline-flex justify-center items-center py-2 px-4 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-white/90 drop-shadow mb-1.5"
                >
                  Registered Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-white/60" aria-hidden="true" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className={`block w-full pl-10 pr-3.5 py-2.5 border ${
                      errors.email ? 'border-red-400 focus:ring-red-400' : 'border-white/30 focus:border-white/80'
                    } rounded-xl bg-white/15 focus:bg-white/25 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md sm:text-sm transition-all duration-200`}
                    placeholder="name@sabirplastic.com"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs font-medium text-red-300">{errors.email.message}</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={forgotMutation.isPending}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-amber-300/40 rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-amber-500/25"
                >
                  {forgotMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-950" />
                      Sending reset link...
                    </>
                  ) : (
                    <>
                      Send Reset Link
                      <Send className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2 border-t border-white/10">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
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

export default ForgotPassword;

