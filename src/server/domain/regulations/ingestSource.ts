import "server-only";

import type { Client } from "@libsql/client";
import { z } from "zod";

import type { Actor } from "../../auth/actor";
import { AuthorizationPolicy } from "../../auth/policy";
import { getGuestTokenService, type GuestTokenService } from "../../auth/guest-token";
import { RegulationsRepository } from "../../db/repositories/regulations";
import { withWriteTransaction } from "../../db/transaction";
import { AuditService } from "../audit/service";
import { DomainError } from "../shared/errors";
import { canonicalJson, sha256 } from "../shared/hash";
import type { RegulatorySourceBundleDto } from "./types";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const sourceIngestionSchema = z
  .object({
    officialIdentifier: z.string().trim().min(3).max(200),
    title: z.string().trim().min(3).max(500),
    authority: z.string().trim().min(2).max(240),
    jurisdiction: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()),
    sourceType: z.string().trim().min(2).max(80),
    canonicalUrl: z.url().refine((value) => new URL(value).protocol === "https:", {
      message: "Regulatory source URLs must use HTTPS",
    }),
    versionLabel: z.string().trim().min(1).max(160),
    publicationDate: dateSchema,
    effectiveFrom: dateSchema,
    effectiveTo: dateSchema.nullable().default(null),
    retrievedAt: z.iso.datetime(),
    synthetic: z.boolean().default(false),
    sections: z
      .array(
        z.object({
          heading: z.string().trim().min(1).max(500),
          locator: z.string().trim().min(1).max(240),
          bodyText: z.string().trim().min(1).max(100000),
          taxTopics: z
            .array(z.string().trim().min(1).max(80))
            .min(1)
            .max(24)
            .transform((topics) => [...new Set(topics.map((topic) => topic.toLowerCase()))]),
        }),
      )
      .min(1)
      .max(5000),
  })
  .refine(
    (value) => !value.effectiveTo || value.effectiveFrom <= value.effectiveTo,
    { message: "Effective date range is invalid" },
  );

function assertPermittedSource(input: z.infer<typeof sourceIngestionSchema>): void {
  const url = new URL(input.canonicalUrl);
  if (input.synthetic) {
    if (
      process.env.NODE_ENV === "production" ||
      url.hostname !== "example.invalid" ||
      !input.officialIdentifier.startsWith("SYNTHETIC-DEV-") ||
      input.sourceType !== "synthetic_development"
    ) {
      throw new DomainError("VALIDATION_ERROR", "Synthetic source labeling is invalid");
    }
    return;
  }

  if (!(url.hostname === "go.id" || url.hostname.endsWith(".go.id"))) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Only official Indonesian government or regulatory domains are permitted",
    );
  }
}

export class RegulatoryIngestionService {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService = getGuestTokenService(),
  ) {}

  async ingestSource(actor: Actor, input: unknown): Promise<RegulatorySourceBundleDto> {
    const data = sourceIngestionSchema.parse(input);
    assertPermittedSource(data);

    const normalizedSections = data.sections.map((section, ordinal) => ({
      ...section,
      ordinal,
      bodySha256: sha256(section.bodyText),
    }));
    const contentSha256 = sha256(
      canonicalJson({
        officialIdentifier: data.officialIdentifier,
        versionLabel: data.versionLabel,
        sections: normalizedSections.map(({ heading, locator, bodyText, taxTopics }) => ({
          heading,
          locator,
          bodyText,
          taxTopics,
        })),
      }),
    );

    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const user = await policy.requireActiveUser(actor);
      if (user.globalRole !== "admin") {
        throw new DomainError("FORBIDDEN", "Only an administrator may ingest sources");
      }

      const regulations = new RegulationsRepository(transaction);
      const audit = new AuditService(transaction);
      const existingSource = await regulations.findSource(
        data.authority,
        data.officialIdentifier,
      );
      const source =
        existingSource ??
        (await regulations.createSource({
          officialIdentifier: data.officialIdentifier,
          title: data.title,
          authority: data.authority,
          jurisdiction: data.jurisdiction,
          sourceType: data.sourceType,
          canonicalUrl: data.canonicalUrl,
        }));

      if (
        source.jurisdiction !== data.jurisdiction ||
        source.canonicalUrl !== data.canonicalUrl ||
        source.sourceType !== data.sourceType
      ) {
        throw new DomainError(
          "CONFLICT",
          "Existing regulatory source metadata does not match the ingestion request",
        );
      }

      const existingVersion = await regulations.findVersion(source.id, data.versionLabel);
      if (existingVersion) {
        if (existingVersion.contentSha256 !== contentSha256) {
          throw new DomainError(
            "CONFLICT",
            "This source version label already exists with different content",
          );
        }
        return {
          source,
          version: existingVersion,
          sections: await regulations.listSections(existingVersion.id),
        };
      }

      const version = await regulations.createVersion({
        sourceId: source.id,
        versionLabel: data.versionLabel,
        publicationDate: data.publicationDate,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        retrievedAt: data.retrievedAt,
        contentSha256,
      });
      const sections = await regulations.addSections(
        normalizedSections.map((section) => ({
          sourceVersionId: version.id,
          heading: section.heading,
          locator: section.locator,
          ordinal: section.ordinal,
          bodyText: section.bodyText,
          bodySha256: section.bodySha256,
          taxTopics: section.taxTopics,
        })),
      );

      await audit.write(actor, {
        eventType: "regulation.version_ingested",
        targetType: "regulatory_source_version",
        targetId: version.id,
        changedFields: ["content_sha256", "review_status"],
        metadata: {
          sourceId: source.id,
          sectionCount: sections.length,
          synthetic: data.synthetic,
        },
      });
      return { source, version, sections };
    });
  }

  async approveSourceVersion(
    actor: Actor,
    sourceVersionId: string,
  ): Promise<RegulatorySourceBundleDto> {
    const parsedVersionId = z.uuid().parse(sourceVersionId);
    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const user = await policy.requireActiveUser(actor);
      if (user.globalRole !== "admin") {
        throw new DomainError("FORBIDDEN", "Only an administrator may approve sources");
      }

      const regulations = new RegulationsRepository(transaction);
      const audit = new AuditService(transaction);
      const version = await regulations.findVersionById(parsedVersionId);
      if (!version) throw new DomainError("NOT_FOUND", "Source version was not found");
      const sections = await regulations.listSections(version.id);
      if (sections.length === 0) {
        throw new DomainError("INVALID_STATE", "A source version needs sections before approval");
      }
      if (version.reviewStatus === "pending") {
        const approved = await regulations.approveVersion(version.id, user.id);
        if (!approved) {
          throw new DomainError("CONFLICT", "Source approval state changed concurrently");
        }
        await audit.write(actor, {
          eventType: "regulation.version_approved",
          targetType: "regulatory_source_version",
          targetId: version.id,
          changedFields: ["review_status", "reviewed_by_user_id", "reviewed_at"],
        });
      } else if (version.reviewStatus !== "approved") {
        throw new DomainError("INVALID_STATE", "Only pending source versions can be approved");
      }

      const source = await regulations.findSourceById(version.regulatorySourceId);
      return {
        source: source!,
        version: (await regulations.findVersionById(version.id))!,
        sections,
      };
    });
  }
}
