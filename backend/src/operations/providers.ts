export type PlaceholderProviderStatus = {
  name: string;
  configured: boolean;
  mode: "PLACEHOLDER";
};

export interface EmailProvider {
  status(): PlaceholderProviderStatus;
}

export interface SmsProvider {
  status(): PlaceholderProviderStatus;
}

export interface WhatsAppProvider {
  status(): PlaceholderProviderStatus;
}

export interface PushNotificationProvider {
  status(): PlaceholderProviderStatus;
}

export interface ErrorMonitoringProvider {
  status(): PlaceholderProviderStatus;
}

export interface UptimeMonitoringProvider {
  status(): PlaceholderProviderStatus;
}

export interface PdfExportProvider {
  status(): PlaceholderProviderStatus;
}

export interface CsvExportProvider {
  status(): PlaceholderProviderStatus;
}

export interface SpreadsheetExportProvider {
  status(): PlaceholderProviderStatus;
}

export class PlaceholderOperationsProvider {
  constructor(private readonly name: string) {}

  status(): PlaceholderProviderStatus {
    return {
      name: this.name,
      configured: false,
      mode: "PLACEHOLDER",
    };
  }
}

export function operationsProviderCatalog() {
  return [
    new PlaceholderOperationsProvider("Email provider"),
    new PlaceholderOperationsProvider("SMS provider"),
    new PlaceholderOperationsProvider("WhatsApp provider"),
    new PlaceholderOperationsProvider("Push notification provider"),
    new PlaceholderOperationsProvider("Error monitoring provider"),
    new PlaceholderOperationsProvider("Uptime monitoring provider"),
    new PlaceholderOperationsProvider("PDF export provider"),
    new PlaceholderOperationsProvider("CSV export provider"),
    new PlaceholderOperationsProvider("Spreadsheet export provider"),
  ];
}
