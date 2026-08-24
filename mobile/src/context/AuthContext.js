import React, { createContext, useState, useEffect } from 'react';
import { apiCall, setAuthToken } from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Mock demo user profile matching the full web user model
  const demoUser = {
    id: 'usr-demo-001',
    email: 'l1_alice@finovo.com',
    username: 'alicesmith',
    first_name: 'Alice',
    last_name: 'Smith',
    referral_code: 'ALICE123',
    active_level: 2,
    kyc_status: 'APPROVED', // 'APPROVED', 'IN_REVIEW', 'UNVERIFIED', 'REJECTED'
    kyc_document_type: 'PASSPORT',
    kyc_document_number: 'P9842104A',
    kyc_country: 'United Kingdom',
    is_email_verified: true,
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      if (isDemoMode) {
        setUser({ ...demoUser, email });
        setTokenState('demo-token-123');
        setLoading(false);
        return { success: true };
      }

      const res = await apiCall('/auth/login/', 'POST', { email, password });
      if (res && res.access) {
        setAuthToken(res.access);
        setTokenState(res.access);
        await fetchProfile();
        return { success: true };
      }
    } catch (err) {
      console.warn('Login API failed, falling back to Demo Mode:', err.message);
      // Fallback to offline demo mode
      enableDemoMode(email);
      return { success: true, fallback: true };
    } finally {
      setLoading(false);
    }
  };

  const register = async (data) => {
    setLoading(true);
    try {
      if (isDemoMode) {
        setLoading(false);
        return { success: true };
      }
      const res = await apiCall('/auth/register/', 'POST', data);
      return res || { success: true };
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (emailOrUsername) => {
    setLoading(true);
    try {
      if (isDemoMode) {
        setLoading(false);
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

  const resetPassword = async (emailOrUsername, otp, newPassword) => {
    setLoading(true);
    try {
      if (isDemoMode) {
        setLoading(false);
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
  };

  const enableDemoMode = (email = 'l1_alice@finovo.com') => {
    setIsDemoMode(true);
    setUser({ ...demoUser, email });
    setTokenState('demo-token-123');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isDemoMode,
        login,
        register,
        forgotPassword,
        resetPassword,
        logout,
        enableDemoMode,
        fetchProfile,
        updateKYCState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
