import React, { createContext, useState, useEffect } from 'react';
import { apiCall, setAuthToken } from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [adminMode, setAdminMode] = useState(false); // When true, renders the Admin Console

  // Mock demo user profile matching the full web user model
  const demoUser = {
    id: 'usr-demo-001',
    email: 'l1_alice@finovo.com',
    username: 'alicesmith',
    first_name: 'Alice',
    last_name: 'Smith',
    referral_code: 'ALICE123',
    active_level: 2,
    active_roi_level: 2,
    kyc_status: 'APPROVED', // 'APPROVED', 'IN_REVIEW', 'UNVERIFIED', 'REJECTED'
    kyc_document_type: 'PASSPORT',
    kyc_document_number: 'P9842104A',
    kyc_country: 'United Kingdom',
    is_email_verified: true,
    is_staff: true, // Demo user has admin rights to test all admin pages
    is_superuser: true,
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      if (isDemoMode) {
        setUser({ ...demoUser, email });
        setTokenState('demo-token-123');
        return { success: true };
      }

      const res = await apiCall('/auth/login/', 'POST', { email, password });
      if (res && res.access) {
        setAuthToken(res.access);
        setTokenState(res.access);
        const profile = await apiCall('/auth/profile/');
        if (profile) {
          setUser(profile);
        }
        return { success: true, user: profile };
      }
    } catch (err) {
      console.error('Login API failed:', err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data) => {
    setLoading(true);
    try {
      if (isDemoMode) {
        return { success: true };
      }
      // 1. Register
      const res = await apiCall('/auth/register/', 'POST', data);

      // 2. Silently login to obtain token for verify-email step
      try {
        const loginData = await apiCall('/auth/login/', 'POST', {
          email: data.email,
          password: data.password,
        });
        if (loginData && loginData.access) {
          setAuthToken(loginData.access);
          setTokenState(loginData.access);
        }
      } catch (e) {
        console.warn('Silent login during reg error:', e.message);
      }

      return res || { success: true };
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (otp) => {
    setLoading(true);
    try {
      if (isDemoMode) {
        return { success: true };
      }
      const res = await apiCall('/auth/verify-email/', 'POST', { otp });
      await fetchProfile();
      return res || { success: true };
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async (email) => {
    try {
      if (isDemoMode) return { success: true };
      return await apiCall('/auth/resend-otp/', 'POST', { email });
    } catch (err) {
      throw err;
    }
  };

  const forgotPassword = async (emailOrUsername) => {
    setLoading(true);
    try {
      if (isDemoMode) {
        return { success: true };
      }
      const res = await apiCall('/auth/forgot-password/', 'POST', { email: emailOrUsername });
      return res || { success: true };
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resendForgotOTP = async (emailOrUsername) => {
    try {
      if (isDemoMode) return { success: true };
      return await apiCall('/auth/forgot-password/', 'POST', { email: emailOrUsername });
    } catch (err) {
      throw err;
    }
  };

  const resetPassword = async (emailOrUsername, otp, newPassword) => {
    setLoading(true);
    try {
      if (isDemoMode) {
        return { success: true };
      }
      const res = await apiCall('/auth/reset-password/', 'POST', {
        email: emailOrUsername,
        otp,
        new_password: newPassword,
        new_password2: newPassword,
      });
      return res || { success: true };
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const profile = await apiCall('/auth/profile/');
      if (profile) {
        setUser(profile);
      }
    } catch (err) {
      console.error('Fetch profile error:', err.message);
    }
  };

  const updateKYCState = (kycData) => {
    setUser((prev) => ({
      ...prev,
      ...kycData,
      kyc_status: kycData.kyc_status || 'IN_REVIEW',
    }));
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
    setIsDemoMode(false);
    setAdminMode(false);
  };

  const enableDemoMode = (email = 'l1_alice@finovo.com', asAdmin = true) => {
    setIsDemoMode(true);
    setUser({ ...demoUser, email, is_staff: asAdmin, is_superuser: asAdmin });
    setTokenState('demo-token-123');
  };

  const isAdmin = Boolean(user?.is_staff || user?.is_superuser || user?.role === 'admin');

  const toggleAdminMode = () => {
    setAdminMode((prev) => !prev);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isDemoMode,
        adminMode,
        isAdmin,
        login,
        register,
        verifyEmail,
        resendOTP,
        forgotPassword,
        resendForgotOTP,
        resetPassword,
        logout,
        enableDemoMode,
        fetchProfile,
        updateKYCState,
        toggleAdminMode,
        setAdminMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

