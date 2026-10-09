'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, User, Building2, ArrowLeft, Phone, Hash } from 'lucide-react';
import { useAuth } from '../providers';
import { api, apiError } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [accountType, setAccountType] = useState<'individual' | 'business'>('individual');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    tin: '',
    businessName: '',
    category: 'trader',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('type');
    if (requested === 'business') setAccountType('business');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      setStep(2);
      setError('');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const registerData = await api.register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        role: accountType,
        tin: formData.tin,
        ...(accountType === 'business' ? { businessName: formData.businessName, category: formData.category } : {}),
      });
      login(registerData.user);

      // Redirect to appropriate dashboard
      router.push(accountType === 'business' ? '/dashboard/business' : '/dashboard/taxpayer');
    } catch (err) {
      setError(apiError(err, 'Registration failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const categories = [
    { value: 'employer_organisation', label: 'Employer / Organisation' },
    { value: 'trader', label: 'Trader / Retailer / Wholesaler' },
    { value: 'manufacturer', label: 'Manufacturer' },
    { value: 'service_provider', label: 'Service Provider' },
    { value: 'self_employed_professional', label: 'Self-Employed / Professional' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'landlord_property', label: 'Landlord / Property Owner' },
    { value: 'hospitality_events', label: 'Hotel / Restaurant / Event Centre' },
    { value: 'entertainment_media', label: 'Entertainment / Media Operator' },
    { value: 'transport_haulage', label: 'Transport / Haulage Operator' },
    { value: 'livestock_agro', label: 'Livestock / Agricultural Dealer' },
    { value: 'gaming_betting', label: 'Gaming / Lottery / Betting Operator' },
    { value: 'other', label: 'Other Business / Organisation' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="inline-flex items-center text-gray-600 hover:text-primary-500 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">₦</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Account</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Register for the YIRS Blockchain Revenue System
            </p>
          </div>

          {/* Account Type Selector */}
          <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-8">
            <button
              type="button"
              onClick={() => setAccountType('individual')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
                accountType === 'individual' 
                  ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <User className="w-5 h-5" />
              Individual
            </button>
            <button
              type="button"
              onClick={() => setAccountType('business')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
                accountType === 'business' 
                  ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Building2 className="w-5 h-5" />
              Business
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center mb-8">
            <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`} />
            <div className="w-4" />
            <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`} />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="input-primary"
                      placeholder="Demo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="input-primary"
                      placeholder="Taxpayer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input-primary pl-12"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="input-primary pl-12"
                      placeholder="+234 800 123 4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={5}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input-primary pl-12 pr-12"
                      placeholder="Minimum 5 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="input-primary pl-12"
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tax Identification Number (TIN)
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      required
                      minLength={10}
                      maxLength={20}
                      value={formData.tin}
                      onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                      className="input-primary pl-12"
                      placeholder="Enter your TIN"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Enter the taxpayer TIN/reference for this account.</p>
                </div>

                {accountType === 'business' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Business Name
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={formData.businessName}
                          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                          className="input-primary pl-12"
                          placeholder="Damaturu Demo Enterprise"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Business Category
                      </label>
                      <select
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="input-primary"
                      >
                        {categories.map((cat) => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="flex items-start">
                  <input
                    type="checkbox"
                    required
                    id="terms"
                    className="w-4 h-4 mt-1 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <label htmlFor="terms" className="ml-3 text-sm text-gray-600 dark:text-gray-300">
                    I agree to the{' '}
                    <Link href="/terms" className="text-primary-500 hover:text-primary-600">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-primary-500 hover:text-primary-600">Privacy Policy</Link>
                  </label>
                </div>
              </>
            )}

            <div className="flex gap-4">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 btn-secondary"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 btn-primary flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : step === 1 ? (
                  'Continue'
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 dark:text-gray-300">
              Already have an account?{' '}
              <Link href="/login" className="text-primary-500 hover:text-primary-600 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
