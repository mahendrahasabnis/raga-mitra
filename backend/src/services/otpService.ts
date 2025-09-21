import { SmsClient } from '@azure/communication-sms';

class OTPService {
  private smsClient: SmsClient | null = null;
  private otpStore: Map<string, { otp: string; expiresAt: Date }> = new Map();

  constructor() {
    const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    if (connectionString) {
      this.smsClient = new SmsClient(connectionString);
    }
  }

  generateOTP(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async sendOTP(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    try {
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP
      this.otpStore.set(phoneNumber, { otp, expiresAt });

      // Send SMS
      if (this.smsClient) {
        const sendRequest = {
          from: process.env.AZURE_COMMUNICATION_PHONE_NUMBER!,
          to: [phoneNumber],
          message: `Your Raga-Mitra verification code is: ${otp}. Valid for 10 minutes.`
        };

        await this.smsClient.send(sendRequest);
      } else {
        // For development, log OTP to console
        console.log(`[DEV] OTP for ${phoneNumber}: ${otp}`);
      }

      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { success: false, message: 'Failed to send OTP' };
    }
  }

  verifyOTP(phoneNumber: string, otp: string): boolean {
    const stored = this.otpStore.get(phoneNumber);
    
    if (!stored) {
      return false;
    }

    if (new Date() > stored.expiresAt) {
      this.otpStore.delete(phoneNumber);
      return false;
    }

    if (stored.otp === otp) {
      this.otpStore.delete(phoneNumber);
      return true;
    }

    return false;
  }
}

export default new OTPService();
