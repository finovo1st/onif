# FINOVO Mobile Application (React Native / Expo)

A cross-platform mobile application built with React Native and Expo for the FINOVO Crypto Investment & 5-Level Referral Platform.

## 📱 Features

- **Authentication**: JWT token Sign In & Registration with referral code linkage.
- **Dashboard**: Real-time Wallet Balance, Active Investments, Weekly ROI Total, Direct Referral Income, and Recent Wallet Ledger.
- **Investments Screen**: Interactive Investment Plans (Starter 2.5%, Pro 3.5%, Elite 5.0%), 300% ROI Return calculator, and purchase flow.
- **Wallet & Transactions**: Crypto Deposit proof submission (BEP20/TRC20 TxHash), Withdrawal requests with net fee deduction ($1 profit / $10 capital fee), and ledger history.
- **Referral Network**: Sponsor link generator, downline member list, Level 1-5 Unlock progress, and Direct & ROI Commissions log.
- **Support Center**: Ticket creation & history status.
- **Dual Mode**: Connects directly to backend API (`http://10.0.2.2:8000/api/v1` for Android / `http://127.0.0.1:8000/api/v1` for iOS & Web) with built-in offline demo mode fallback.

## 🚀 How to Run

1. Navigate to the `mobile` directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npm start
   ```

4. Run on your platform of choice:
   - Press `a` to open Android Emulator
   - Press `i` to open iOS Simulator
   - Press `w` to open in Web Browser
