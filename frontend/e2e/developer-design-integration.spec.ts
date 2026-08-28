import { expect, test } from "@playwright/test";

test("global design identity, target manifest and session key are route independent", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const design = await import("/src/lib/developer-design-integration.ts");
    const first = design.resolveDeveloperPageDna(
      "/zb/client-source/product-market",
      "?tab=service&siteId=first",
      "global",
    );
    const second = design.resolveDeveloperPageDna(
      "/zb/hq/dashboard",
      "?siteId=second",
      "global",
    );
    const pageTarget = design.resolveDeveloperPageDna(
      "/zb/client-source/social",
      "?tab=dashboard&siteId=page",
      "page",
    );

    return {
      globalIdentity: first.identityKey,
      globalSourceScope: first.sourceScope,
      globalRoute: first.normalizedRoute,
      manifestId: first.targetManifest.manifestId,
      targetCount: first.targetManifest.targets.length,
      sameReference: first === second,
      sameManifest: JSON.stringify(first.targetManifest) === JSON.stringify(second.targetManifest),
      sameFingerprint: await design.computeDeveloperPageDnaFingerprint(first)
        === await design.computeDeveloperPageDnaFingerprint(second),
      scopeChangesFingerprint: await design.computeDeveloperPageDnaFingerprint(first)
        !== await design.computeDeveloperPageDnaFingerprint(pageTarget),
      sameGlobalStorageKey: design.buildDeveloperDesignSessionStorageKey(first.identityKey, "global")
        === design.buildDeveloperDesignSessionStorageKey("client_source:/unrelated", "global"),
    };
  });

  expect(result.globalIdentity).toBe("global:registered-page-targets");
  expect(result.globalSourceScope).toBe("global");
  expect(result.globalRoute).toBe("*");
  expect(result.manifestId).toBe(result.globalIdentity);
  expect(result.targetCount).toBeGreaterThan(1);
  expect(result.sameReference).toBe(true);
  expect(result.sameManifest).toBe(true);
  expect(result.sameFingerprint).toBe(true);
  expect(result.scopeChangesFingerprint).toBe(true);
  expect(result.sameGlobalStorageKey).toBe(true);
});

test("Figma metadata survives normalization and three independent viewport samples aggregate", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const design = await import("/src/lib/developer-design-integration.ts");
    const pageDna = design.resolveDeveloperPageDna(
      "/zb/client-source/social",
      "?tab=dashboard&siteId=evidence",
      "page",
    );
    const pageDnaFingerprint = await design.computeDeveloperPageDnaFingerprint(pageDna);
    const targetManifestFingerprint = design.fingerprintDeveloperDesignTargetManifest(pageDna.targetManifest);
    const capturedAt = "2026-08-27T07:30:00.000Z";
    const snapshot = design.parseFigmaSnapshotJson(JSON.stringify({
      components: design.DEVELOPER_DESIGN_INTEGRATION_CONTRACT.componentMappings.map((item) => item.figmaName),
      variables: ["Color/Surface/Workspace"],
      frames: ["Mobile/390", "Tablet/768", "Desktop/1440"],
      capturedAt,
      fileKey: "design-file-key",
      nodeId: "1:2",
      revision: "revision-42",
      pageDnaFingerprint,
      sharedContractVersion: design.DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
    }));
    const session = {
      ...design.createDeveloperDesignSession(pageDna),
      figma: {
        fileUrl: "https://www.figma.com/design/design-file-key/runtime-evidence?node-id=1-2",
        fileKey: "design-file-key",
        nodeId: "1:2",
        revision: "revision-42",
        capturedAt,
      },
      snapshot,
    };
    design.saveDeveloperDesignSession(session);
    const normalizedSnapshot = design.readDeveloperDesignSession(pageDna).snapshot;
    const sample = (viewportWidth: number, viewportHeight: number, index: number) => ({
      sampleSchemaVersion: 3 as const,
      targetIdentityKey: pageDna.identityKey,
      sourceScope: pageDna.sourceScope,
      normalizedRoute: pageDna.normalizedRoute,
      targetManifestFingerprint,
      checkedAt: `2026-08-27T07:3${index}:00.000Z`,
      viewportWidth,
      viewportHeight,
      documentOverflow: false,
      visibleRegionCount: 4,
      requiredRegionCount: 4,
      missingRegions: [],
      imageCount: 1,
      lazyImageCount: 1,
      asyncImageCount: 1,
      videoCount: 1,
      posterVideoCount: 1,
      metadataVideoCount: 1,
      resourceCount: 4,
      longTaskCount: 0,
    });
    const samples = design.DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS.map(
      (viewport, index) => sample(viewport.width, viewport.height, index),
    );
    const sampleIndex = design.buildDeveloperVisualEvidenceSampleIndex(pageDna, samples);
    const cachedSampleIndex = design.buildDeveloperVisualEvidenceSampleIndex(pageDna, samples);
    const invalidSampleIndex = design.buildDeveloperVisualEvidenceSampleIndex(pageDna, [
      ...samples,
      { ...sample(390, 844, 3), targetManifestFingerprint: "stale-manifest" },
    ]);
    const wrongHeightSampleIndex = design.buildDeveloperVisualEvidenceSampleIndex(
      pageDna,
      [sample(390, 600, 3)],
    );
    const single = await design.buildDeveloperVisualEvidenceRecord(pageDna, session, samples[0]);
    const aggregate = await design.buildDeveloperVisualEvidenceRecord(pageDna, session, samples);
    const stale = await design.buildDeveloperVisualEvidenceRecord(pageDna, {
      ...session,
      snapshot: { ...snapshot, pageDnaFingerprint: "0".repeat(64) },
    }, samples);

    return {
      normalizedMetadata: normalizedSnapshot && {
        capturedAt: normalizedSnapshot.capturedAt,
        fileKey: normalizedSnapshot.fileKey,
        nodeId: normalizedSnapshot.nodeId,
        revision: normalizedSnapshot.revision,
        pageDnaFingerprint: normalizedSnapshot.pageDnaFingerprint,
        sharedContractVersion: normalizedSnapshot.sharedContractVersion,
      },
      singleStatus: single.status,
      singleViewportStatuses: single.viewportResults.map((viewport) => viewport.status),
      aggregateStatus: aggregate.status,
      aggregateSampleCounts: aggregate.viewportResults.map((viewport) => viewport.sampleCount),
      aggregateViewportDimensions: aggregate.viewportResults.map((viewport) => [viewport.width, viewport.height]),
      aggregateCapturedAt: aggregate.capturedAt,
      sampleIndexCacheHit: sampleIndex === cachedSampleIndex,
      indexedCoverage: sampleIndex.targetCoverage,
      indexedLatest: sampleIndex.latestByTargetIdentity.get(pageDna.identityKey)?.checkedAt,
      invalidSampleCount: invalidSampleIndex.invalidSampleCount,
      wrongHeightCapturedSampleCount: wrongHeightSampleIndex.targetCoverage.capturedSampleCount,
      staleStatus: stale.status,
      staleFreshnessStatus: stale.checkResults.find((check) => check.id === "design-snapshot-freshness")?.status,
    };
  });

  expect(result.normalizedMetadata).toEqual({
    capturedAt: "2026-08-27T07:30:00.000Z",
    fileKey: "design-file-key",
    nodeId: "1:2",
    revision: "revision-42",
    pageDnaFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    sharedContractVersion: expect.any(String),
  });
  expect(result.singleStatus).toBe("pending");
  expect(result.singleViewportStatuses).toEqual(["passed", "pending", "pending"]);
  expect(result.aggregateStatus).toBe("passed");
  expect(result.aggregateSampleCounts).toEqual([1, 1, 1]);
  expect(result.aggregateViewportDimensions).toEqual([[390, 844], [768, 1024], [1440, 900]]);
  expect(result.aggregateCapturedAt).toBe("2026-08-27T07:32:00.000Z");
  expect(result.sampleIndexCacheHit).toBe(true);
  expect(result.indexedCoverage).toMatchObject({ targetCount: 1, coveredTargetCount: 1, completeTargetCount: 1, capturedSampleCount: 3, requiredSampleCount: 3 });
  expect(result.indexedLatest).toBe("2026-08-27T07:32:00.000Z");
  expect(result.invalidSampleCount).toBe(1);
  expect(result.wrongHeightCapturedSampleCount).toBe(0);
  expect(result.staleStatus).toBe("stale");
  expect(result.staleFreshnessStatus).toBe("failed");
});

test("global contract and visual evidence require target-by-viewport coverage", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const design = await import("/src/lib/developer-design-integration.ts");
    const health = await import("/src/lib/shared-contract-health.ts");
    const pageDna = design.resolveDeveloperPageDna("/zb/client-source/product-market", "?tab=operations", "global");
    const pageDnaFingerprint = await design.computeDeveloperPageDnaFingerprint(pageDna);
    const targetManifestFingerprint = design.fingerprintDeveloperDesignTargetManifest(pageDna.targetManifest);
    const capturedAt = "2026-08-27T09:00:00.000Z";
    const snapshot = design.parseFigmaSnapshotJson(JSON.stringify({
      components: design.DEVELOPER_DESIGN_INTEGRATION_CONTRACT.componentMappings.map((item) => item.figmaName),
      variables: ["Color/Surface/Workspace"],
      frames: ["Mobile/390", "Tablet/768", "Desktop/1440"],
      capturedAt,
      fileKey: "global-design-file",
      nodeId: "1:2",
      revision: "global-revision-1",
      pageDnaFingerprint,
      sharedContractVersion: design.DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
    }));
    const session = {
      ...design.createDeveloperDesignSession(pageDna),
      figma: {
        fileUrl: "https://www.figma.com/design/global-design-file/runtime-evidence?node-id=1-2",
        fileKey: "global-design-file",
        nodeId: "1:2",
        revision: "global-revision-1",
        capturedAt,
      },
      snapshot,
    };
    const makeSample = (
      target: (typeof pageDna.targetManifest.targets)[number],
      viewport: (typeof design.DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS)[number],
    ) => ({
      sampleSchemaVersion: 3 as const,
      targetIdentityKey: target.identityKey,
      sourceScope: target.sourceScope,
      normalizedRoute: target.normalizedRoute,
      targetManifestFingerprint,
      checkedAt: capturedAt,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      documentOverflow: false,
      visibleRegionCount: 1,
      requiredRegionCount: 1,
      missingRegions: [] as string[],
      imageCount: 0,
      lazyImageCount: 0,
      asyncImageCount: 0,
      videoCount: 0,
      posterVideoCount: 0,
      metadataVideoCount: 0,
      resourceCount: 1,
      longTaskCount: 0,
    });
    const firstTarget = pageDna.targetManifest.targets[0];
    const representative = await design.buildDeveloperVisualEvidenceRecord(
      pageDna,
      session,
      design.DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS.map((viewport) => makeSample(firstTarget, viewport)),
    );
    const complete = await design.buildDeveloperVisualEvidenceRecord(
      pageDna,
      session,
      pageDna.targetManifest.targets.flatMap((target) => design.DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS.map(
        (viewport) => makeSample(target, viewport),
      )),
    );
    const globalHealth = health.inspectGlobalSharedContractHealth(pageDna);
    const duplicateManifestHealth = health.inspectGlobalSharedContractHealth({
      ...pageDna,
      impactTargetCount: 2,
      targetManifest: {
        ...pageDna.targetManifest,
        targets: [firstTarget, firstTarget],
      },
    });

    return {
      targetCount: pageDna.targetManifest.targets.length,
      contractCoverage: globalHealth.targetCoverage,
      representativeStatus: representative.status,
      representativeCoverage: representative.targetCoverage,
      representativeImpact: representative.checkResults.find((check) => check.id === "impact-boundary")?.status,
      completeStatus: complete.status,
      completeCoverage: complete.targetCoverage,
      legacyAccepted: design.isDeveloperRuntimeVisualEvidenceSample({ checkedAt: capturedAt, viewportWidth: 390 }),
      schema2Accepted: design.isDeveloperRuntimeVisualEvidenceSample({
        ...makeSample(firstTarget, design.DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS[0]),
        sampleSchemaVersion: 2,
      }),
      duplicateManifestPassed: duplicateManifestHealth.passed,
      duplicateIdentityStatus: duplicateManifestHealth.checks.find((check) => check.id === "global-target-identity")?.status,
    };
  });

  expect(result.targetCount).toBeGreaterThan(1);
  expect(result.contractCoverage?.complete).toBe(true);
  expect(result.contractCoverage?.registeredTargets).toBe(result.targetCount);
  expect(result.contractCoverage?.resolvableTargets).toBe(result.targetCount);
  expect(result.contractCoverage?.sourceEntryTargets).toBe(result.targetCount);
  expect(result.representativeStatus).toBe("pending");
  expect(result.representativeCoverage.completeTargetCount).toBe(1);
  expect(result.representativeCoverage.targetCount).toBe(result.targetCount);
  expect(result.representativeImpact).toBe("pending");
  expect(result.completeStatus).toBe("passed");
  expect(result.completeCoverage.completeTargetCount).toBe(result.targetCount);
  expect(result.legacyAccepted).toBe(false);
  expect(result.schema2Accepted).toBe(false);
  expect(result.duplicateManifestPassed).toBe(false);
  expect(result.duplicateIdentityStatus).toBe("issue");
});
