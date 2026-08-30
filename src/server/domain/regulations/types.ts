import type { JsonValue } from "../shared/types";

export type RegulatoryReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "superseded";

export interface RegulatorySourceRecord {
  id: string;
  officialIdentifier: string;
  title: string;
  authority: string;
  jurisdiction: string;
  sourceType: string;
  canonicalUrl: string;
  status: "active" | "retired";
  createdAt: string;
  updatedAt: string;
}

export interface RegulatorySourceVersionRecord {
  id: string;
  regulatorySourceId: string;
  versionLabel: string;
  publicationDate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  retrievedAt: string;
  contentSha256: string;
  reviewStatus: RegulatoryReviewStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface RegulatorySectionRecord {
  id: string;
  sourceVersionId: string;
  heading: string;
  locator: string;
  ordinal: number;
  bodyText: string;
  bodySha256: string;
  taxTopics: string[];
  createdAt: string;
}

export interface RetrievedRegulatorySection extends RegulatorySectionRecord {
  source: RegulatorySourceRecord;
  version: RegulatorySourceVersionRecord;
  retrievalMethod: "fts5_bm25" | "metadata";
  retrievalScore: number | null;
}

export interface RegulatorySourceBundleDto {
  source: RegulatorySourceRecord;
  version: RegulatorySourceVersionRecord;
  sections: RegulatorySectionRecord[];
}

export interface SourceIngestionDocument extends Record<string, JsonValue> {
  officialIdentifier: string;
  title: string;
  authority: string;
  jurisdiction: string;
  sourceType: string;
  canonicalUrl: string;
  versionLabel: string;
  publicationDate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  retrievedAt: string;
  synthetic: boolean;
  sections: Array<{
    heading: string;
    locator: string;
    bodyText: string;
    taxTopics: string[];
  }>;
}
