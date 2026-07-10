import type { MediaProviderStatus } from "@fpf/shared";

export class PlaceholderMediaProvider {
  constructor(private readonly name: string) {}

  status(): MediaProviderStatus {
    return { name: this.name, configured: false, mode: "PLACEHOLDER" };
  }
}

export function aiContentProviders() {
  return [
    "AI Caption Generator",
    "AI Headline Generator",
    "AI Article Generator",
    "AI Video Script Generator",
    "AI Image Prompt Generator",
    "AI Thumbnail Prompt Generator",
    "AI Hashtag Generator",
    "AI SEO Generator",
  ].map((name) => new PlaceholderMediaProvider(name));
}

export function socialPublishingProviders() {
  return [
    "Facebook",
    "Instagram",
    "TikTok",
    "X",
    "LinkedIn",
    "Telegram",
    "WhatsApp Channels",
    "YouTube Community",
    "Discord",
  ].map((name) => new PlaceholderMediaProvider(name));
}
