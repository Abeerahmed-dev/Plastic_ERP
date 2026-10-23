import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import type { LoginRequest } from '../types/auth.types';
import sabirLogo from '../assets/sabirlogo.png';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const from = location.state?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      setAuth(data.user, data.access_token, data.refresh_token);
      navigate(from, { replace: true });
    },
    onError: (error: import('axios').AxiosError<{message: string}>) => {
      setServerError(
        error.response?.data?.message || 'Login failed. Please check your credentials.'
      );
    },
  });

  const onSubmit = (data: LoginRequest) => {
    setServerError(null);
    loginMutation.mutate(data);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden bg-slate-950">
      {/* Decorative ambient glowing gradient orbs (Pure lightweight CSS) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-blue-600/25 to-indigo-600/10 blur-[130px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-purple-600/20 via-indigo-500/15 to-transparent blur-[140px]" />
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
          Sabir Plastic Store
        </h2>
        <p className="mt-2 text-center text-sm text-slate-300 drop-shadow">
          Sign in to access your dashboard
        </p>
      </div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Glass Mirror Card */}
        <div className="bg-white/[0.12] backdrop-blur-2xl py-8 px-4 shadow-[0_16px_40px_rgba(0,0,0,0.5)] sm:rounded-3xl sm:px-10 border border-white/30 ring-1 ring-white/20">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {serverError && (
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-400/40 backdrop-blur-md flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-100">{serverError}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-white/90 drop-shadow mb-1.5"
              >
                Email address
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
                  placeholder="admin@sabirplastic.com"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs font-medium text-red-300">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-white/90 drop-shadow mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-white/60" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className={`block w-full pl-10 pr-3.5 py-2.5 border ${
                    errors.password ? 'border-red-400 focus:ring-red-400' : 'border-white/30 focus:border-white/80'
                  } rounded-xl bg-white/15 focus:bg-white/25 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md sm:text-sm transition-all duration-200`}
                  placeholder="••••••••"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs font-medium text-red-300">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-500 focus:ring-blue-400 border-white/40 bg-white/20 rounded cursor-pointer"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm font-medium text-white/90 cursor-pointer drop-shadow"
                >
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a
                  href="#"
                  className="font-medium text-blue-300 hover:text-white transition-colors drop-shadow"
                >
                  Forgot your password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-amber-300/40 rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-amber-500/25"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-950" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
