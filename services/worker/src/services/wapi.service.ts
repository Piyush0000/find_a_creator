/**
 * WapiService — Wrapper around the WAPI WhatsApp HTTP API.
 * Follows the pattern established in Orbit Software.
 * Docs: https://app.wapi.in.net/
 */

export class WapiService {
  private baseUrl: string;
  private token: string;
  private vendorUid: string;

  constructor() {
    this.baseUrl = (process.env.WAPI_BASE_URL || 'https://app.wapi.in.net/api').replace(/\/+$/, '');
    this.token = (process.env.WAPI_TOKEN || '').trim();
    this.vendorUid = (process.env.WAPI_VENDOR_UID || '').trim();

    if (!this.token || !this.vendorUid) {
      console.warn('⚠️ [WAPI] WAPI_TOKEN or WAPI_VENDOR_UID is not set in .env — WhatsApp API calls will fail.');
    }
  }

  get vendorBaseUrl(): string {
    return `${this.baseUrl}/${this.vendorUid}`;
  }

  formatPhone(phone: string): string {
    if (!phone) return '';
    const clean = String(phone).replace(/\D/g, '');
    if (clean.length === 10) {
      return `91${clean}`;
    }
    return clean;
  }

  /**
   * Send a pre-approved WhatsApp template message.
   *
   * @param phoneNumber      - Recipient phone number (e.g. 9876543210 or 919876543210)
   * @param templateName     - Approved template name, e.g. "creator_brief_received"
   * @param templateLanguage - Language code, e.g. "en"
   * @param fields           - Dynamic template fields ({ field_1: "...", field_2: "..." })
   */
  async sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    templateLanguage: string = 'en',
    fields: Record<string, string> = {}
  ): Promise<{ success: boolean; log_uid?: string; data?: any; error?: string }> {
    const formattedPhone = this.formatPhone(phoneNumber);
    if (!formattedPhone || formattedPhone.length < 10) {
      console.warn(`⚠️ [WAPI] Skipped: Invalid phone number '${phoneNumber}'`);
      return { success: false, error: 'Invalid phone number' };
    }

    const url = `${this.vendorBaseUrl}/contact/send-template-message`;
    const payload = {
      phone_number: formattedPhone,
      template_name: templateName,
      template_language: templateLanguage,
      ...fields
    };

    try {
      console.log(`📱 [WAPI] Sending template '${templateName}' to ${formattedPhone}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify(payload)
      });

      const data: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || `HTTP ${response.status}`;
        console.error(`❌ [WAPI] API error for ${formattedPhone}:`, errorMsg);
        return { success: false, error: errorMsg, data };
      }

      console.log(`✅ [WAPI] Template '${templateName}' sent to ${formattedPhone} (log_uid: ${data?.log_uid || data?.messageId || 'ok'})`);
      return { success: true, log_uid: data?.log_uid || data?.messageId, data };
    } catch (err: any) {
      console.error(`❌ [WAPI] Network failure while sending template:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a plain text message
   */
  async sendTextMessage(
    phoneNumber: string,
    messageBody: string
  ): Promise<{ success: boolean; log_uid?: string; error?: string }> {
    const formattedPhone = this.formatPhone(phoneNumber);
    const url = `${this.vendorBaseUrl}/contact/send-message`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify({
          phone_number: formattedPhone,
          message_body: messageBody
        })
      });

      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { success: false, error: data?.message || `HTTP ${response.status}` };
      }
      return { success: true, log_uid: data?.log_uid };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
