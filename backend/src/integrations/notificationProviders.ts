export type DeliveryChannel = "EMAIL" | "SMS" | "PUSH";

export type DeliveryRequest = {
  to: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type DeliveryResult = {
  channel: DeliveryChannel;
  configured: boolean;
  delivered: boolean;
  provider: string;
  status: "SENT" | "SKIPPED" | "FAILED";
  message: string;
};

function clean(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
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
    return { ok: response.ok, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

export class EmailProvider {
  private readonly provider = clean(process.env.EMAIL_PROVIDER, "RESEND");
  private readonly apiKey = clean(process.env.EMAIL_API_KEY) || clean(process.env.RESEND_API_KEY) || undefined;
  private readonly from = clean(process.env.EMAIL_FROM, "Football Performance Fund <noreply@footballperformancefund.com>");
  private readonly endpoint = clean(process.env.EMAIL_API_URL, "https://api.resend.com/emails");
  private readonly timeoutMs = Number(process.env.EMAIL_TIMEOUT_MS ?? 10000);

  status() {
    const missingVariables = [!this.apiKey ? "EMAIL_API_KEY" : null, !this.from ? "EMAIL_FROM" : null].filter((item): item is string => Boolean(item));
    return { channel: "EMAIL" as const, provider: this.provider, configured: missingVariables.length === 0, missingVariables };
  }

  async send(input: DeliveryRequest): Promise<DeliveryResult> {
    const status = this.status();
    if (!status.configured) return { channel: "EMAIL", configured: false, delivered: false, provider: this.provider, status: "SKIPPED", message: `Missing ${status.missingVariables.join(", ")}` };
    try {
      const result = await postJson(this.endpoint, { Authorization: `Bearer ${this.apiKey}` }, {
        from: this.from,
        to: [input.to],
        subject: input.title,
        text: input.message,
        metadata: input.metadata,
      }, this.timeoutMs);
      return { channel: "EMAIL", configured: true, delivered: result.ok, provider: this.provider, status: result.ok ? "SENT" : "FAILED", message: `HTTP ${result.status}` };
    } catch {
      return { channel: "EMAIL", configured: true, delivered: false, provider: this.provider, status: "FAILED", message: "Email provider unavailable." };
    }
  }
}

export class SmsProvider {
  private readonly provider = clean(process.env.SMS_PROVIDER, "TWILIO");
  private readonly accountSid = clean(process.env.TWILIO_ACCOUNT_SID) || undefined;
  private readonly authToken = clean(process.env.TWILIO_AUTH_TOKEN) || undefined;
  private readonly from = clean(process.env.SMS_FROM) || clean(process.env.TWILIO_FROM_NUMBER) || undefined;
  private readonly timeoutMs = Number(process.env.SMS_TIMEOUT_MS ?? 10000);

  status() {
    const missingVariables = [
      !this.accountSid ? "TWILIO_ACCOUNT_SID" : null,
      !this.authToken ? "TWILIO_AUTH_TOKEN" : null,
      !this.from ? "SMS_FROM" : null,
    ].filter((item): item is string => Boolean(item));
    return { channel: "SMS" as const, provider: this.provider, configured: missingVariables.length === 0, missingVariables };
  }

  async send(input: DeliveryRequest): Promise<DeliveryResult> {
    const status = this.status();
    if (!status.configured) return { channel: "SMS", configured: false, delivered: false, provider: this.provider, status: "SKIPPED", message: `Missing ${status.missingVariables.join(", ")}` };
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
      return { channel: "SMS", configured: true, delivered: response.ok, provider: this.provider, status: response.ok ? "SENT" : "FAILED", message: `HTTP ${response.status}` };
    } catch {
      return { channel: "SMS", configured: true, delivered: false, provider: this.provider, status: "FAILED", message: "SMS provider unavailable." };
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
    if (!status.configured) return { channel: "PUSH", configured: false, delivered: false, provider: this.provider, status: "SKIPPED", message: `Missing ${status.missingVariables.join(", ")}` };
    try {
      const result = await postJson(this.endpoint ?? "", { Authorization: `Bearer ${this.apiKey}` }, input as Record<string, unknown>, this.timeoutMs);
      return { channel: "PUSH", configured: true, delivered: result.ok, provider: this.provider, status: result.ok ? "SENT" : "FAILED", message: `HTTP ${result.status}` };
    } catch {
      return { channel: "PUSH", configured: true, delivered: false, provider: this.provider, status: "FAILED", message: "Push provider unavailable." };
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
}
