export type DeliveryChannel = "EMAIL" | "SMS" | "PUSH";
export type NotificationPurpose =
  | "SMS_OTP"
  | "EMAIL_VERIFICATION"
  | "PASSWORD_RESET"
  | "SECURITY_ALERT"
  | "ACCOUNT_NOTIFICATION"
  | "SEASON_REGISTRATION_CONFIRMATION"
  | "DISTRIBUTION_NOTIFICATION"
  | "ADMIN_TEST";

export type DeliveryRequest = {
  to: string;
  title: string;
  message: string;
  purpose?: NotificationPurpose;
  metadata?: Record<string, unknown>;
};

export type DeliveryResult = {
  channel: DeliveryChannel;
  configured: boolean;
  delivered: boolean;
  provider: string;
  status: "SENT" | "SKIPPED" | "FAILED";
  message: string;
  providerMessageId?: string | null;
  attempts: number;
};

function clean(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstProviderMessageId(data: unknown) {
  const record = jsonRecord(data);
  const messages = Array.isArray(record.messages) ? record.messages : [];
  const first = jsonRecord(messages[0]);
  return typeof first.messageId === "string" ? first.messageId : null;
}

function logDelivery(event: string, payload: Record<string, unknown>) {
  console.info("NOTIFICATION_DELIVERY", {
    event,
    provider: payload.provider,
    channel: payload.channel,
    purpose: payload.purpose,
    status: payload.status,
    statusCode: payload.statusCode,
    attempts: payload.attempts,
    providerMessageId: payload.providerMessageId,
  });
}

async function postJson(url: string, headers: Record<string, string>, body: Record<string, unknown>, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function withRetry<T>(operation: (attempt: number) => Promise<T>, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Delivery provider unavailable.");
}

class InfobipProvider {
  private readonly apiKey = clean(process.env.INFOBIP_API_KEY) || undefined;
  private readonly baseUrl = clean(process.env.INFOBIP_BASE_URL).replace(/\/+$/, "") || undefined;
  private readonly fromSms = clean(process.env.INFOBIP_SMS_FROM, "FPF");
  private readonly fromEmail = clean(process.env.INFOBIP_EMAIL_FROM) || clean(process.env.EMAIL_FROM, "Football Performance Fund <noreply@footballperformancefund.com>");
  private readonly timeoutMs = Number(process.env.INFOBIP_TIMEOUT_MS ?? 10000);

  status(channel: DeliveryChannel) {
    const missingVariables = [
      !this.apiKey ? "INFOBIP_API_KEY" : null,
      !this.baseUrl ? "INFOBIP_BASE_URL" : null,
      channel === "SMS" && !this.fromSms ? "INFOBIP_SMS_FROM" : null,
      channel === "EMAIL" && !this.fromEmail ? "INFOBIP_EMAIL_FROM" : null,
    ].filter((item): item is string => Boolean(item));
    return { channel, provider: "INFOBIP", configured: missingVariables.length === 0, missingVariables };
  }

  async sendSms(input: DeliveryRequest): Promise<DeliveryResult> {
    const status = this.status("SMS");
    if (!status.configured) return skipped("SMS", "INFOBIP", status.missingVariables);

    try {
      const result = await withRetry(async (attempt) => {
        const response = await postJson(`${this.baseUrl}/sms/2/text/advanced`, { Authorization: `App ${this.apiKey}` }, {
          messages: [{ from: this.fromSms, destinations: [{ to: input.to }], text: input.message }],
        }, this.timeoutMs);
        if (!response.ok && response.status >= 500) throw new Error(`Infobip SMS HTTP ${response.status}`);
        const providerMessageId = firstProviderMessageId(response.data);
        logDelivery("attempt", { provider: "INFOBIP", channel: "SMS", purpose: input.purpose, status: response.ok ? "SENT" : "FAILED", statusCode: response.status, attempts: attempt, providerMessageId });
        return { response, providerMessageId, attempt };
      });
      return { channel: "SMS", configured: true, delivered: result.response.ok, provider: "INFOBIP", status: result.response.ok ? "SENT" : "FAILED", message: `HTTP ${result.response.status}`, providerMessageId: result.providerMessageId, attempts: result.attempt };
    } catch {
      logDelivery("failed", { provider: "INFOBIP", channel: "SMS", purpose: input.purpose, status: "FAILED", attempts: 3 });
      return { channel: "SMS", configured: true, delivered: false, provider: "INFOBIP", status: "FAILED", message: "Infobip SMS provider unavailable.", providerMessageId: null, attempts: 3 };
    }
  }

  async sendEmail(input: DeliveryRequest): Promise<DeliveryResult> {
    const status = this.status("EMAIL");
    if (!status.configured) return skipped("EMAIL", "INFOBIP", status.missingVariables);

    try {
      const result = await withRetry(async (attempt) => {
        const response = await postJson(`${this.baseUrl}/email/4/send`, { Authorization: `App ${this.apiKey}` }, {
          messages: [{
            from: this.fromEmail,
            to: [{ email: input.to }],
            subject: input.title,
            text: input.message,
          }],
        }, this.timeoutMs);
        if (!response.ok && response.status >= 500) throw new Error(`Infobip Email HTTP ${response.status}`);
        const providerMessageId = firstProviderMessageId(response.data);
        logDelivery("attempt", { provider: "INFOBIP", channel: "EMAIL", purpose: input.purpose, status: response.ok ? "SENT" : "FAILED", statusCode: response.status, attempts: attempt, providerMessageId });
        return { response, providerMessageId, attempt };
      });
      return { channel: "EMAIL", configured: true, delivered: result.response.ok, provider: "INFOBIP", status: result.response.ok ? "SENT" : "FAILED", message: `HTTP ${result.response.status}`, providerMessageId: result.providerMessageId, attempts: result.attempt };
    } catch {
      logDelivery("failed", { provider: "INFOBIP", channel: "EMAIL", purpose: input.purpose, status: "FAILED", attempts: 3 });
      return { channel: "EMAIL", configured: true, delivered: false, provider: "INFOBIP", status: "FAILED", message: "Infobip Email provider unavailable.", providerMessageId: null, attempts: 3 };
    }
  }
}

function skipped(channel: DeliveryChannel, provider: string, missingVariables: string[]): DeliveryResult {
  return {
    channel,
    configured: false,
    delivered: false,
    provider,
    status: "SKIPPED",
    message: `Missing ${missingVariables.join(", ")}`,
    providerMessageId: null,
    attempts: 0,
  };
}

export class EmailProvider {
  private readonly provider = clean(process.env.EMAIL_PROVIDER, process.env.INFOBIP_API_KEY ? "INFOBIP" : "RESEND").toUpperCase();
  private readonly apiKey = clean(process.env.EMAIL_API_KEY) || clean(process.env.RESEND_API_KEY) || undefined;
  private readonly from = clean(process.env.EMAIL_FROM, "Football Performance Fund <noreply@footballperformancefund.com>");
  private readonly endpoint = clean(process.env.EMAIL_API_URL, "https://api.resend.com/emails");
  private readonly timeoutMs = Number(process.env.EMAIL_TIMEOUT_MS ?? 10000);
  private readonly infobip = new InfobipProvider();

  status() {
    if (this.provider === "INFOBIP") return this.infobip.status("EMAIL");
    const missingVariables = [!this.apiKey ? "EMAIL_API_KEY" : null, !this.from ? "EMAIL_FROM" : null].filter((item): item is string => Boolean(item));
    return { channel: "EMAIL" as const, provider: this.provider, configured: missingVariables.length === 0, missingVariables };
  }

  async send(input: DeliveryRequest): Promise<DeliveryResult> {
    const status = this.status();
    if (this.provider === "INFOBIP") return this.infobip.sendEmail(input);
    if (!status.configured) return skipped("EMAIL", this.provider, status.missingVariables);
    try {
      const result = await postJson(this.endpoint, { Authorization: `Bearer ${this.apiKey}` }, {
        from: this.from,
        to: [input.to],
        subject: input.title,
        text: input.message,
        metadata: input.metadata,
      }, this.timeoutMs);
      return { channel: "EMAIL", configured: true, delivered: result.ok, provider: this.provider, status: result.ok ? "SENT" : "FAILED", message: `HTTP ${result.status}`, providerMessageId: firstProviderMessageId(result.data), attempts: 1 };
    } catch {
      return { channel: "EMAIL", configured: true, delivered: false, provider: this.provider, status: "FAILED", message: "Email provider unavailable.", providerMessageId: null, attempts: 1 };
    }
  }
}

export class SmsProvider {
  private readonly provider = clean(process.env.SMS_PROVIDER, process.env.INFOBIP_API_KEY ? "INFOBIP" : "TWILIO").toUpperCase();
  private readonly accountSid = clean(process.env.TWILIO_ACCOUNT_SID) || undefined;
  private readonly authToken = clean(process.env.TWILIO_AUTH_TOKEN) || undefined;
  private readonly from = clean(process.env.SMS_FROM) || clean(process.env.TWILIO_FROM_NUMBER) || undefined;
  private readonly timeoutMs = Number(process.env.SMS_TIMEOUT_MS ?? 10000);
  private readonly infobip = new InfobipProvider();

  status() {
    if (this.provider === "INFOBIP") return this.infobip.status("SMS");
    const missingVariables = [
      !this.accountSid ? "TWILIO_ACCOUNT_SID" : null,
      !this.authToken ? "TWILIO_AUTH_TOKEN" : null,
      !this.from ? "SMS_FROM" : null,
    ].filter((item): item is string => Boolean(item));
    return { channel: "SMS" as const, provider: this.provider, configured: missingVariables.length === 0, missingVariables };
  }

  async send(input: DeliveryRequest): Promise<DeliveryResult> {
    const status = this.status();
    if (this.provider === "INFOBIP") return this.infobip.sendSms(input);
    if (!status.configured) return skipped("SMS", this.provider, status.missingVariables);
    try {
      const body = new URLSearchParams({ From: this.from ?? "", To: input.to, Body: `${input.title}: ${input.message}` });
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid ?? "")}/Messages.json`;
      const response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      const data = await response.json().catch(() => ({}));
      return { channel: "SMS", configured: true, delivered: response.ok, provider: this.provider, status: response.ok ? "SENT" : "FAILED", message: `HTTP ${response.status}`, providerMessageId: typeof data.sid === "string" ? data.sid : null, attempts: 1 };
    } catch {
      return { channel: "SMS", configured: true, delivered: false, provider: this.provider, status: "FAILED", message: "SMS provider unavailable.", providerMessageId: null, attempts: 1 };
    }
  }
}

export class PushProvider {
  private readonly provider = clean(process.env.PUSH_PROVIDER, "WEB_PUSH");
  private readonly endpoint = clean(process.env.PUSH_API_URL) || undefined;
  private readonly apiKey = clean(process.env.PUSH_API_KEY) || undefined;
  private readonly timeoutMs = Number(process.env.PUSH_TIMEOUT_MS ?? 10000);

  status() {
    const missingVariables = [!this.endpoint ? "PUSH_API_URL" : null, !this.apiKey ? "PUSH_API_KEY" : null].filter((item): item is string => Boolean(item));
    return { channel: "PUSH" as const, provider: this.provider, configured: missingVariables.length === 0, missingVariables };
  }

  async send(input: DeliveryRequest): Promise<DeliveryResult> {
    const status = this.status();
    if (!status.configured) return skipped("PUSH", this.provider, status.missingVariables);
    try {
      const result = await postJson(this.endpoint ?? "", { Authorization: `Bearer ${this.apiKey}` }, input as Record<string, unknown>, this.timeoutMs);
      return { channel: "PUSH", configured: true, delivered: result.ok, provider: this.provider, status: result.ok ? "SENT" : "FAILED", message: `HTTP ${result.status}`, providerMessageId: firstProviderMessageId(result.data), attempts: 1 };
    } catch {
      return { channel: "PUSH", configured: true, delivered: false, provider: this.provider, status: "FAILED", message: "Push provider unavailable.", providerMessageId: null, attempts: 1 };
    }
  }
}

export class NotificationDeliveryService {
  constructor(
    private readonly emailProvider = new EmailProvider(),
    private readonly smsProvider = new SmsProvider(),
    private readonly pushProvider = new PushProvider(),
  ) {}

  status() {
    return {
      email: this.emailProvider.status(),
      sms: this.smsProvider.status(),
      push: this.pushProvider.status(),
    };
  }

  async send(channel: DeliveryChannel, input: DeliveryRequest) {
    if (channel === "EMAIL") return this.emailProvider.send(input);
    if (channel === "SMS") return this.smsProvider.send(input);
    return this.pushProvider.send(input);
  }

  sendSmsOtp(to: string, otp: string, metadata?: Record<string, unknown>) {
    return this.send("SMS", {
      to,
      title: "FPF verification code",
      message: `Your Football Performance Fund verification code is ${otp}.`,
      purpose: "SMS_OTP",
      metadata,
    });
  }

  sendEmailVerification(to: string, verificationUrl: string, metadata?: Record<string, unknown>) {
    return this.send("EMAIL", {
      to,
      title: "Verify your Football Performance Fund account",
      message: `Verify your account: ${verificationUrl}`,
      purpose: "EMAIL_VERIFICATION",
      metadata,
    });
  }

  sendPasswordReset(to: string, resetUrl: string, metadata?: Record<string, unknown>) {
    return this.send("EMAIL", {
      to,
      title: "Reset your Football Performance Fund password",
      message: `Use this secure link to reset your password: ${resetUrl}`,
      purpose: "PASSWORD_RESET",
      metadata,
    });
  }

  sendSecurityAlert(to: string, message: string, metadata?: Record<string, unknown>) {
    return this.send("EMAIL", {
      to,
      title: "Football Performance Fund security alert",
      message,
      purpose: "SECURITY_ALERT",
      metadata,
    });
  }

  sendSeasonRegistrationConfirmation(to: string, message: string, metadata?: Record<string, unknown>) {
    return this.send("EMAIL", {
      to,
      title: "FPF season registration confirmation",
      message,
      purpose: "SEASON_REGISTRATION_CONFIRMATION",
      metadata,
    });
  }

  sendDistributionNotification(to: string, message: string, metadata?: Record<string, unknown>) {
    return this.send("EMAIL", {
      to,
      title: "FPF distribution notification",
      message,
      purpose: "DISTRIBUTION_NOTIFICATION",
      metadata,
    });
  }
}
