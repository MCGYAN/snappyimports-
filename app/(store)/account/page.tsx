'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OrderHistory from './OrderHistory';
import AddressBook from './AddressBook';
import MyShipments from './MyShipments';
import FinancialDocuments from './FinancialDocuments';
import DeliveryRequests from './DeliveryRequests';
import OrderStatus from './OrderStatus';
import { supabase } from '@/lib/supabase';

const ACCOUNT_TABS = [
  'profile',
  'status',
  'orders',
  'shipments',
  'documents',
  'deliveries',
  'addresses',
  'security',
] as const;

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'status';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [portalData, setPortalData] = useState<{
    packages: any[];
    board: any | null;
    documents: any[];
    orderStatus: any[];
    rmbStatus: any[];
  }>({ packages: [], board: null, documents: [], orderStatus: [], rmbStatus: [] });
  const [portalLoading, setPortalLoading] = useState({
    shipments: false,
    documents: false,
    status: false,
  });
  const [portalLoaded, setPortalLoaded] = useState({
    shipments: false,
    documents: false,
    status: false,
  });

  // Update active tab when URL param changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && (ACCOUNT_TABS as readonly string[]).includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const goToTab = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    if (tab !== 'status') params.delete('order');
    if (tab !== 'documents') params.delete('document');
    router.replace(`/account?${params.toString()}`, { scroll: false });
  };

  const mobileTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const el = mobileTabRefs.current[activeTab];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeTab]);

  // Profile Form States
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form States
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }

      setUser(session.user);
      setAccessToken(session.access_token);
      setProfileData({
        firstName: session.user.user_metadata?.first_name || '',
        lastName: session.user.user_metadata?.last_name || '',
        email: session.user.email || '',
        phone: session.user.phone || ''
      });
      setLoading(false);

      // Guest records are normally claimed during sign-in. Recheck quietly here
      // without making the account screen wait for database updates.
      void fetch('/api/orders/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: '{}',
      }).catch(() => null);
    }
    checkUser();
  }, [router]);

  useEffect(() => {
    const section =
      activeTab === 'shipments'
        ? 'shipments'
        : activeTab === 'documents'
          ? 'documents'
          : activeTab === 'status'
            ? 'status'
            : null;
    if (!section || !accessToken || portalLoaded[section] || portalLoading[section]) return;

    const loadPortalSection = async () => {
      setPortalLoading((current) => ({ ...current, [section]: true }));
      try {
        const include =
          section === 'shipments'
            ? 'packages,board'
            : section === 'documents'
              ? 'documents'
              : 'order-status';
        const response = await fetch(`/api/account/portal?include=${include}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load account records.');
        setPortalData((current) => ({ ...current, ...result }));
      } catch (error) {
        console.error(`[account ${section}]`, error);
      } finally {
        setPortalLoaded((current) => ({ ...current, [section]: true }));
        setPortalLoading((current) => ({ ...current, [section]: false }));
      }
    };

    void loadPortalSection();
  }, [accessToken, activeTab, portalLoaded, portalLoading]);

  const reloadDocuments = async () => {
    if (!accessToken) return;
    setPortalLoading((current) => ({ ...current, documents: true }));
    try {
      const response = await fetch('/api/account/portal?include=documents', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load account records.');
      setPortalData((current) => ({ ...current, documents: result.documents || [] }));
    } catch (error) {
      console.error('[account documents refresh]', error);
    } finally {
      setPortalLoading((current) => ({ ...current, documents: false }));
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone // Storing phone in metadata for now
        }
      });

      if (error) throw error;
      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwordData.password.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.password
      });
      if (error) throw error;
      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setPasswordData({ password: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { clearAuthCookies } = await import('@/lib/auth-remember');
    clearAuthCookies();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <i className="ri-loader-4-line animate-spin text-4xl text-brand-primary"></i>
      </div>
    );
  }

  const quickActions = [
    {
      icon: 'ri-medal-line',
      title: 'Loyalty Program',
      description: 'Earn points and rewards',
      link: '/loyalty'
    },
    {
      icon: 'ri-user-add-line',
      title: 'Refer & Earn',
      description: 'Invite friends and earn rewards',
      link: '/referral'
    }
  ];

  const securityOptions = [
    {
      icon: 'ri-mail-check-line',
      title: 'Verify Email',
      description: user?.email,
      status: user?.email_confirmed_at ? 'verified' : 'unverified',
      link: '#' // /account/verify-email
    },
    {
      icon: 'ri-phone-line',
      title: 'Verify Phone',
      description: user?.phone || 'No phone added',
      status: user?.phone_confirmed_at ? 'verified' : 'unverified',
      link: '#' // /account/verify-phone
    }
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8 lg:py-12 pb-24 lg:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
            <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
              <div className="w-12 h-12 md:w-16 md:h-16 flex-shrink-0 rounded-full bg-brand-light flex items-center justify-center text-brand-primary text-xl md:text-2xl font-bold shadow-inner border-2 border-white">
                {profileData.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate pr-2">{profileData.firstName ? `Hello, ${profileData.firstName}!` : 'Welcome Back'}</h1>
                <p className="text-gray-500 text-sm font-medium truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-red-600 hover:border-red-200 transition-all font-bold shadow-sm w-full md:w-auto justify-center md:justify-start"
            >
              Sign Out
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Desktop Sidebar Navigation */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-24">
                <nav className="p-2 space-y-1">
                  {[
                    { id: 'profile', icon: 'ri-user-settings-line', label: 'Profile Settings' },
                    { id: 'status', icon: 'ri-map-pin-line', label: 'Order status' },
                    { id: 'orders', icon: 'ri-archive-line', label: 'Past orders' },
                    { id: 'shipments', icon: 'ri-ship-2-line', label: 'My Shipments' },
                    { id: 'documents', icon: 'ri-file-list-3-line', label: 'Invoices & Receipts' },
                    { id: 'deliveries', icon: 'ri-calendar-check-line', label: 'Deliveries' },
                    { id: 'addresses', icon: 'ri-map-pin-2-line', label: 'Addresses' },
                    { id: 'security', icon: 'ri-shield-keyhole-line', label: 'Security' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => goToTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-left group ${activeTab === tab.id
                        ? 'bg-brand-primary text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-brand-primary'
                        }`}
                    >
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Mobile Horizontal Navigation */}
            <div className="sticky top-16 z-20 -mx-4 mb-2 border-b border-slate-200/80 bg-gray-50/95 px-4 py-2 backdrop-blur lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide [-webkit-overflow-scrolling:touch]">
                {[
                  { id: 'profile', icon: 'ri-user-settings-line', label: 'Profile' },
                  { id: 'status', icon: 'ri-map-pin-line', label: 'Status' },
                  { id: 'orders', icon: 'ri-archive-line', label: 'Past' },
                  { id: 'shipments', icon: 'ri-ship-2-line', label: 'Shipments' },
                  { id: 'documents', icon: 'ri-file-list-3-line', label: 'Receipts' },
                  { id: 'deliveries', icon: 'ri-calendar-check-line', label: 'Deliveries' },
                  { id: 'addresses', icon: 'ri-map-pin-2-line', label: 'Address' },
                  { id: 'security', icon: 'ri-shield-keyhole-line', label: 'Security' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    ref={(node) => {
                      mobileTabRefs.current[tab.id] = node;
                    }}
                    type="button"
                    onClick={() => goToTab(tab.id)}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold whitespace-nowrap transition-all border shadow-sm ${
                      activeTab === tab.id
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    <i className={`${tab.icon} text-base`} aria-hidden />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3">
              <div className="min-h-[420px] rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-6 md:p-8">
                {activeTab === 'profile' && (
                  <div className="max-w-2xl">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Information</h2>
                    <p className="text-gray-500 mb-8">Update your personal details and contact info.</p>

                    {profileMessage.text && (
                      <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${profileMessage.type === 'success' ? 'bg-blue-50 text-brand-primary border border-blue-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        <i className={`text-xl mt-0.5 ${profileMessage.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`}></i>
                        <div>{profileMessage.text}</div>
                      </div>
                    )}

                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-900">First Name</label>
                          <input
                            type="text"
                            value={profileData.firstName}
                            onChange={e => setProfileData({ ...profileData, firstName: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-brand-accent transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-900">Last Name</label>
                          <input
                            type="text"
                            value={profileData.lastName}
                            onChange={e => setProfileData({ ...profileData, lastName: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-brand-accent transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-900">Email Address</label>
                        <div className="relative">
                          <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                          <input
                            type="email"
                            value={profileData.email}
                            disabled
                            className="w-full pl-11 pr-4 py-3 border-2 border-gray-100 bg-gray-50/50 rounded-xl text-gray-500 cursor-not-allowed"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold bg-gray-200 text-gray-600 px-2 py-1 rounded">Read Only</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-900">Phone Number</label>
                        <div className="relative">
                          <i className="ri-phone-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                          <input
                            type="tel"
                            value={profileData.phone}
                            onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                            placeholder="+1 555 000 0000"
                            className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-brand-accent transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <button
                          type="submit"
                          disabled={profileLoading}
                          className="px-8 py-3 bg-brand-primary hover:bg-brand-accent hover:text-white text-white rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:shadow-none"
                        >
                          {profileLoading ? 'Saving Info...' : 'Save Profile Information'}
                        </button>
                      </div>
                    </form>

                    <div className="mt-12 pt-12 border-t border-gray-100">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Change Password</h3>
                      <p className="text-gray-500 mb-6">Ensure your account uses a strong, unique password.</p>

                      {passwordMessage.text && (
                        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${passwordMessage.type === 'success' ? 'bg-blue-50 text-brand-primary border border-blue-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                          <i className={`text-xl mt-0.5 ${passwordMessage.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`}></i>
                          <div>{passwordMessage.text}</div>
                        </div>
                      )}

                      <form onSubmit={handleChangePassword} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-900">New Password</label>
                            <div className="relative">
                              <i className="ri-lock-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                              <input
                                type="password"
                                value={passwordData.password}
                                onChange={e => setPasswordData({ ...passwordData, password: e.target.value })}
                                className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-brand-accent transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-900">Confirm Password</label>
                            <div className="relative">
                              <i className="ri-lock-check-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                              <input
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-brand-accent transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={passwordLoading}
                          className="px-8 py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold transition-all shadow-lg shadow-gray-900/10 active:scale-95 disabled:opacity-50 disabled:shadow-none"
                        >
                          {passwordLoading ? 'Updating...' : 'Update Password'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {activeTab === 'status' && (
                  <OrderStatus
                    orders={portalData.orderStatus || []}
                    rmbOrders={portalData.rmbStatus || []}
                    loading={portalLoading.status || !portalLoaded.status}
                    focusOrderNumber={searchParams.get('order')}
                  />
                )}

                {activeTab === 'orders' && <OrderHistory />}

                {activeTab === 'shipments' && (
                  <MyShipments
                    data={{ packages: portalData.packages, board: portalData.board }}
                    loading={portalLoading.shipments || !portalLoaded.shipments}
                  />
                )}

                {activeTab === 'documents' && (
                  <FinancialDocuments
                    documents={portalData.documents}
                    loading={portalLoading.documents || !portalLoaded.documents}
                    accessToken={accessToken}
                    onRefresh={reloadDocuments}
                  />
                )}

                {activeTab === 'deliveries' && <DeliveryRequests />}

                {activeTab === 'addresses' && <AddressBook />}

                {activeTab === 'security' && (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Security Settings</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {securityOptions.map((option, index) => (
                        <Link
                          key={index}
                          href={option.link}
                          className="flex items-center justify-between p-5 border border-gray-200 rounded-2xl hover:border-brand-accent hover:shadow-md transition-all group bg-white"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-brand-light group-hover:text-brand-primary transition-colors flex-shrink-0">
                              <i className={`${option.icon} text-xl`}></i>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-gray-900 truncate">{option.title}</h3>
                              <p className="text-sm text-gray-500 truncate">{option.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {option.status === 'verified' && (
                              <span className="text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 bg-brand-light text-brand-primary rounded-full flex items-center gap-1">
                                <i className="ri-verified-badge-fill"></i> <span className="hidden sm:inline">Verified</span>
                              </span>
                            )}
                            {option.status === 'unverified' && (
                              <span className="text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                                <i className="ri-error-warning-fill"></i> <span className="hidden sm:inline">Verify</span>
                              </span>
                            )}
                            <i className="ri-arrow-right-line text-gray-300 group-hover:text-blue-500 transition-colors"></i>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <i className="ri-loader-4-line animate-spin text-4xl text-brand-primary"></i>
      </div>
    }>
      <AccountContent />
    </Suspense>
  );
}
