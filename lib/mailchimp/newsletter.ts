import "server-only";
import { getMailchimpEnvironment } from "@/lib/env";
import { getMailchimpClient } from "@/lib/mailchimp/client";
import { runMailchimpRequest } from "@/lib/mailchimp/limiter";
import { buildNewsletterHtml, extractNewsletterContent } from "@/lib/mailchimp/template";

type UnknownRecord = Record<string, unknown>;

type CampaignSdk = {
  list: (options: UnknownRecord) => Promise<unknown>;
  get: (campaignId: string) => Promise<unknown>;
  getContent: (campaignId: string) => Promise<unknown>;
  create: (input: UnknownRecord) => Promise<unknown>;
  update: (campaignId: string, input: UnknownRecord) => Promise<unknown>;
  setContent: (campaignId: string, input: UnknownRecord) => Promise<unknown>;
  sendTestEmail: (campaignId: string, input: UnknownRecord) => Promise<unknown>;
  send: (campaignId: string) => Promise<unknown>;
  schedule: (campaignId: string, input: UnknownRecord) => Promise<unknown>;
  remove: (campaignId: string) => Promise<unknown>;
};

type ReportSdk = {
  getCampaignReport: (campaignId: string) => Promise<unknown>;
};

type ListSdk = {
  getList: (listId: string) => Promise<unknown>;
};

export type NewsletterStatus = "save" | "schedule" | "sending" | "sent" | "paused" | "unknown";

export type NewsletterSummary = {
  id: string;
  subject: string;
  previewText: string;
  title: string;
  fromName: string;
  replyTo: string;
  status: NewsletterStatus;
  createdAt: string | null;
  sendTime: string | null;
  recipientCount: number;
};

export type NewsletterDetail = NewsletterSummary & {
  contentHtml: string;
};

export type NewsletterDraftInput = {
  subject: string;
  previewText: string;
  title: string;
  fromName: string;
  replyTo: string;
  contentHtml: string;
};

export type NewsletterReport = {
  emailsSent: number;
  uniqueOpens: number;
  subscriberClicks: number;
  unsubscribed: number;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableTime(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function status(value: unknown): NewsletterStatus {
  return value === "save" ||
    value === "schedule" ||
    value === "sending" ||
    value === "sent" ||
    value === "paused"
    ? value
    : "unknown";
}

function campaignSdk(): CampaignSdk {
  return getMailchimpClient().campaigns as unknown as CampaignSdk;
}

function reportSdk(): ReportSdk {
  const client = getMailchimpClient() as unknown as { reports: ReportSdk };
  return client.reports;
}

function listSdk(): ListSdk {
  return getMailchimpClient().lists as unknown as ListSdk;
}

function mapCampaign(value: unknown): NewsletterSummary {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Mailchimp returned an invalid campaign");
  }
  const settings = isRecord(value.settings) ? value.settings : {};
  const recipients = isRecord(value.recipients) ? value.recipients : {};
  return {
    id: value.id,
    subject: text(settings.subject_line, "Zonder onderwerp"),
    previewText: text(settings.preview_text),
    title: text(settings.title),
    fromName: text(settings.from_name),
    replyTo: text(settings.reply_to),
    status: status(value.status),
    createdAt: nullableTime(value.create_time),
    sendTime: nullableTime(value.send_time),
    recipientCount: number(recipients.recipient_count),
  };
}

function campaignArray(response: unknown): unknown[] {
  return isRecord(response) && Array.isArray(response.campaigns) ? response.campaigns : [];
}

function settings(input: NewsletterDraftInput): UnknownRecord {
  return {
    subject_line: input.subject,
    preview_text: input.previewText,
    title: input.title,
    from_name: input.fromName,
    reply_to: input.replyTo,
  };
}

export async function listNewsletterCampaigns(): Promise<{
  drafts: NewsletterSummary[];
  sent: NewsletterSummary[];
}> {
  const campaigns = campaignSdk();
  const [draftResponse, sentResponse] = await Promise.all([
    runMailchimpRequest(() =>
      campaigns.list({ status: "save", count: 1000, sortField: "create_time", sortDir: "DESC" })
    ),
    runMailchimpRequest(() =>
      campaigns.list({ status: "sent", count: 1000, sortField: "send_time", sortDir: "DESC" })
    ),
  ]);
  return {
    drafts: campaignArray(draftResponse).map(mapCampaign),
    sent: campaignArray(sentResponse).map(mapCampaign),
  };
}

export async function getNewsletterCampaign(campaignId: string): Promise<NewsletterDetail> {
  const campaigns = campaignSdk();
  const [campaign, content] = await Promise.all([
    runMailchimpRequest(() => campaigns.get(campaignId)),
    runMailchimpRequest(() => campaigns.getContent(campaignId)),
  ]);
  const summary = mapCampaign(campaign);
  const contentRecord = isRecord(content) ? content : {};
  return { ...summary, contentHtml: extractNewsletterContent(text(contentRecord.html)) };
}

export async function createNewsletterCampaign(
  input: NewsletterDraftInput
): Promise<NewsletterDetail> {
  const environment = getMailchimpEnvironment();
  const campaigns = campaignSdk();
  const created = await runMailchimpRequest(() =>
    campaigns.create({
      type: "regular",
      recipients: { list_id: environment.MAILCHIMP_AUDIENCE_ID },
      settings: settings(input),
    })
  );
  const summary = mapCampaign(created);
  const html = buildNewsletterHtml(input);
  await runMailchimpRequest(() => campaigns.setContent(summary.id, { html }));
  return { ...summary, contentHtml: html };
}

export async function updateNewsletterCampaign(
  campaignId: string,
  input: NewsletterDraftInput
): Promise<NewsletterDetail> {
  const campaigns = campaignSdk();
  const updated = await runMailchimpRequest(() => campaigns.update(campaignId, { settings: settings(input) }));
  const html = buildNewsletterHtml(input);
  await runMailchimpRequest(() => campaigns.setContent(campaignId, { html }));
  return { ...mapCampaign(updated), contentHtml: html };
}

export async function deleteNewsletterCampaign(campaignId: string): Promise<void> {
  await runMailchimpRequest(() => campaignSdk().remove(campaignId));
}

export async function sendNewsletterTest(campaignId: string, email: string): Promise<void> {
  await runMailchimpRequest(() =>
    campaignSdk().sendTestEmail(campaignId, { test_emails: [email], send_type: "html" })
  );
}

export async function sendNewsletter(campaignId: string): Promise<void> {
  await runMailchimpRequest(() => campaignSdk().send(campaignId));
}

export async function scheduleNewsletter(campaignId: string, scheduleTime: string): Promise<void> {
  await runMailchimpRequest(() =>
    campaignSdk().schedule(campaignId, { schedule_time: scheduleTime })
  );
}

export async function getNewsletterReport(campaignId: string): Promise<NewsletterReport> {
  const response = await runMailchimpRequest(() => reportSdk().getCampaignReport(campaignId));
  const report = isRecord(response) ? response : {};
  const opens = isRecord(report.opens) ? report.opens : {};
  const clicks = isRecord(report.clicks) ? report.clicks : {};
  return {
    emailsSent: number(report.emails_sent),
    uniqueOpens: number(opens.unique_opens),
    subscriberClicks: number(clicks.unique_subscriber_clicks),
    unsubscribed: number(report.unsubscribed),
  };
}

export async function getAudienceRecipientCount(): Promise<number> {
  const response = await runMailchimpRequest(() =>
    listSdk().getList(getMailchimpEnvironment().MAILCHIMP_AUDIENCE_ID)
  );
  const list = isRecord(response) ? response : {};
  const stats = isRecord(list.stats) ? list.stats : {};
  return number(stats.member_count);
}
