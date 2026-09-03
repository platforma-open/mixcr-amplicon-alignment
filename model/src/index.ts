import { kind } from "@platforma-open/milaboratories.mixcr-amplicon-alignment.kind";
import type { InferHrefType, InferOutputsType } from "@platforma-sdk/model";
import type { ImportFileHandle } from "@platforma-sdk/model";
import {
  BlockModelV3,
  createPlDataTableStateV2,
  createPlDataTableV2,
  DataModelBuilder,
  isImportFileHandleIndex,
  isPColumnSpec,
  parseResourceMap,
} from "@platforma-sdk/model";
import { ProgressPrefix } from "./progress";
import type { BlockArgs, BlockData, LegacyBlockArgs, LegacyBlockUiState } from "./types";

export * from "./types";

const blockDataModel = new DataModelBuilder({ kind })
  .from<BlockData>("V20260903")
  .upgradeLegacy<LegacyBlockArgs, LegacyBlockUiState>(({ args, uiState }) => ({
    customBlockLabel: args?.customBlockLabel ?? "",
    defaultBlockLabel: args?.defaultBlockLabel ?? "",
    datasetRef: args?.datasetRef,
    title: args?.title,
    chains: args?.chains ?? "IGHeavy",
    tagPattern: args?.tagPattern ?? "",
    // Pre-V3 this lived in both args and uiState, kept in step by a watcher.
    // The UI copy is the one the user edited, so it wins where they disagree.
    referenceInputMode: uiState?.referenceInputMode ?? args?.referenceInputMode ?? "fastaSequence",
    librarySequence: uiState?.librarySequence,
    referenceFileHandle: args?.referenceFileHandle,
    selectedRecordHeaders: uiState?.selectedRecordHeaders,
    vGenes: args?.vGenes,
    jGenes: args?.jGenes,
    libraryFile: args?.libraryFile,
    isLibraryFileGzipped: args?.isLibraryFileGzipped,
    libraryEntries: args?.libraryEntries,
    buildLibraryFastaFile: uiState?.buildLibraryFastaFile,
    buildLibraryVGenes: args?.buildLibraryVGenes,
    buildLibraryJGenes: args?.buildLibraryJGenes,
    cloneClusteringMode: args?.cloneClusteringMode ?? "off",
    assemblingFeature: args?.assemblingFeature ?? "VDJRegion",
    badQualityThreshold: args?.badQualityThreshold,
    disableLowQualityMapping: args?.disableLowQualityMapping,
    imputeGermline: args?.imputeGermline ?? false,
    stopCodonTypes: args?.stopCodonTypes,
    stopCodonReplacements: args?.stopCodonReplacements,
    limitInput: args?.limitInput,
    perProcessMemGB: args?.perProcessMemGB,
    perProcessCPUs: args?.perProcessCPUs,
    tableState: uiState?.tableState ?? createPlDataTableStateV2(),
  }))
  // A block created from a template starts on the params its kind accepted; one
  // created by hand gets the same defaults `withArgs`/`withUiState` used to set.
  // The fields the contract leaves out are all either derived by the UI from
  // what is here (`title`, `defaultBlockLabel`, `selectedRecordHeaders`) or
  // machine-local (`perProcessMemGB`, `perProcessCPUs`, `tableState`).
  .init(({ params }) => ({
    customBlockLabel: params?.customBlockLabel ?? "",
    defaultBlockLabel: "",
    datasetRef: params?.datasetRef,
    title: undefined,
    chains: params?.chains ?? "IGHeavy",
    tagPattern: params?.tagPattern ?? "",
    referenceInputMode: params?.referenceInputMode ?? "fastaSequence",
    librarySequence: params?.librarySequence,
    referenceFileHandle: undefined,
    selectedRecordHeaders: undefined,
    vGenes: params?.vGenes,
    jGenes: params?.jGenes,
    libraryFile: params?.libraryFile,
    isLibraryFileGzipped: params?.isLibraryFileGzipped,
    libraryEntries: params?.libraryEntries,
    buildLibraryFastaFile: undefined,
    buildLibraryVGenes: params?.buildLibraryVGenes,
    buildLibraryJGenes: params?.buildLibraryJGenes,
    cloneClusteringMode: params?.cloneClusteringMode ?? "off",
    assemblingFeature: params?.assemblingFeature ?? "VDJRegion",
    badQualityThreshold: params?.badQualityThreshold,
    disableLowQualityMapping: params?.disableLowQualityMapping,
    imputeGermline: params?.imputeGermline ?? false,
    stopCodonTypes: params?.stopCodonTypes,
    stopCodonReplacements: params?.stopCodonReplacements,
    limitInput: params?.limitInput,
    perProcessMemGB: undefined,
    perProcessCPUs: undefined,
    tableState: createPlDataTableStateV2(),
  }));

export const platforma = BlockModelV3.create({ dataModel: blockDataModel, kind })

  .args<BlockArgs>((data) => {
    // Was `.argsValid` before V3: the same conditions, now stated as the reason
    // the block cannot run rather than a bare false.
    if (data.datasetRef === undefined) throw new Error("Input dataset is required");
    // A "Custom (advanced)" assembling feature left empty would reach
    // parseAssemblingFeature and panic.
    if (data.assemblingFeature !== undefined && data.assemblingFeature.trim() === "")
      throw new Error("Assembling feature is required");
    if (data.referenceInputMode === "libraryFile" && data.libraryFile === undefined)
      throw new Error("Library file is required");
    if (data.referenceInputMode === "buildLibrary" && (data.libraryEntries?.length ?? 0) === 0)
      throw new Error("At least one library entry is required");
    if (
      data.referenceInputMode !== "libraryFile" &&
      data.referenceInputMode !== "buildLibrary" &&
      data.librarySequence === undefined &&
      data.vGenes === undefined
    )
      throw new Error("A V/J reference is required");

    return toArgs(data);
  })

  // Prerun renders the library preview in `buildLibrary` mode, and must keep
  // doing so while the main args are still incomplete — so it takes the same
  // projection without the checks above.
  .prerunArgs((data) => toArgs(data))

  // Inverse of the kind's init-params contract.
  .templateParams((data) => {
    // An `upload://` handle is signed by the desktop that opened the file
    // dialog and resolves nowhere else, so only an `index://` one travels —
    // and `isLibraryFileGzipped`, read off that file's name, travels with it.
    const libraryFile = shareableFileHandle(data.libraryFile);
    return {
      customBlockLabel: data.customBlockLabel,
      datasetRef: data.datasetRef,
      chains: data.chains,
      tagPattern: data.tagPattern,
      referenceInputMode: data.referenceInputMode,
      librarySequence: data.librarySequence,
      vGenes: data.vGenes,
      jGenes: data.jGenes,
      libraryFile,
      isLibraryFileGzipped: libraryFile === undefined ? undefined : data.isLibraryFileGzipped,
      libraryEntries: data.libraryEntries,
      buildLibraryVGenes: data.buildLibraryVGenes,
      buildLibraryJGenes: data.buildLibraryJGenes,
      cloneClusteringMode: data.cloneClusteringMode,
      assemblingFeature: data.assemblingFeature,
      badQualityThreshold: data.badQualityThreshold,
      disableLowQualityMapping: data.disableLowQualityMapping,
      imputeGermline: data.imputeGermline,
      stopCodonTypes: data.stopCodonTypes,
      stopCodonReplacements: data.stopCodonReplacements,
      limitInput: data.limitInput,
    };
  })

  .output("qc", (ctx) => {
    const acc = ctx.outputs?.resolve("qc");
    if (!acc || !acc.getInputsLocked()) return undefined;
    return parseResourceMap(acc, (acc) => acc.getFileHandle(), true);
  })

  .output("reports", (ctx) =>
    parseResourceMap(ctx.outputs?.resolve("reports"), (acc) => acc.getFileHandle(), false),
  )

  .output("logs", (ctx) => {
    return ctx.outputs !== undefined
      ? parseResourceMap(ctx.outputs?.resolve("logs"), (acc) => acc.getLogHandle(), false)
      : undefined;
  })

  .output("progress", (ctx) => {
    return ctx.outputs !== undefined
      ? parseResourceMap(
          ctx.outputs?.resolve("logs"),
          (acc) => acc.getProgressLog(ProgressPrefix),
          false,
        )
      : undefined;
  })

  .output("referenceLibrary", (ctx) => {
    return ctx.outputs !== undefined
      ? ctx.outputs
          ?.resolve({
            field: "referenceLibrary",
            assertFieldType: "Input",
            allowPermanentAbsence: true,
          })
          ?.getRemoteFileHandle()
      : undefined;
  })

  .output("debugOutput", (ctx) => {
    return ctx.outputs !== undefined
      ? ctx.outputs
          ?.resolve({ field: "debugOutput", assertFieldType: "Input", allowPermanentAbsence: true })
          ?.getLogHandle()
      : undefined;
  })

  .output("started", (ctx) => ctx.outputs !== undefined)

  .output("done", (ctx) => {
    return ctx.outputs !== undefined
      ? parseResourceMap(ctx.outputs?.resolve("clns"), (_acc) => true, false).data.map(
          (e) => e.key[0] as string,
        )
      : undefined;
  })

  .output("prerunLibrary", (ctx) =>
    ctx.prerun
      ?.resolve({
        field: "referenceLibrary",
        assertFieldType: "Input",
        allowPermanentAbsence: true,
      })
      ?.getFileHandle(),
  )

  .retentiveOutput("inputOptions", (ctx) => {
    return ctx.resultPool.getOptions((v) => {
      if (!isPColumnSpec(v)) return false;
      const domain = v.domain;
      return (
        v.name === "pl7.app/sequencing/data" &&
        (v.valueType as string) === "File" &&
        domain !== undefined &&
        (domain["pl7.app/fileExtension"] === "fasta" ||
          domain["pl7.app/fileExtension"] === "fasta.gz" ||
          domain["pl7.app/fileExtension"] === "fastq" ||
          domain["pl7.app/fileExtension"] === "fastq.gz") &&
        v.axesSpec.some((a) => a.name === "pl7.app/sampleId")
      );
    });
  })

  .retentiveOutput("hasMultiplexedFastq", (ctx) => {
    return (
      ctx.resultPool.getOptions((v) => {
        if (!isPColumnSpec(v)) return false;
        const domain = v.domain;
        return (
          v.name === "pl7.app/sequencing/data" &&
          (v.valueType as string) === "File" &&
          domain !== undefined &&
          (domain["pl7.app/fileExtension"] === "fasta" ||
            domain["pl7.app/fileExtension"] === "fasta.gz" ||
            domain["pl7.app/fileExtension"] === "fastq" ||
            domain["pl7.app/fileExtension"] === "fastq.gz") &&
          v.axesSpec.some((a) => a.name === "pl7.app/sampleGroupId")
        );
      }).length > 0
    );
  })

  .output("sampleLabels", (ctx): Record<string, string> | undefined => {
    const inputRef = ctx.data.datasetRef;
    if (inputRef === undefined) return undefined;

    const spec = ctx.resultPool.getPColumnSpecByRef(inputRef);
    if (spec === undefined) return undefined;

    return ctx.resultPool.findLabelsForColumnAxis(spec, 0);
  })

  .output("rawTsvs", (ctx) => {
    if (ctx.outputs === undefined) return undefined;
    const pCols = ctx.outputs?.resolve("clonotypeTables")?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    return pCols
      .map((pCol) => {
        return {
          ...pCol,
          id: (JSON.parse(pCol.id) as { name: string }).name,
          data: parseResourceMap(pCol.data, (acc) => acc.getRemoteFileHandle(), false),
        };
      })
      .filter((pCol) => pCol.data.isComplete)
      .map((pCol) => {
        return {
          ...pCol,
          data: pCol.data.data,
        };
      });
  })

  .outputWithStatus("pt", (ctx) => {
    const pCols = ctx.outputs
      ?.resolve({ field: "qcReportTable", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    return createPlDataTableV2(ctx, pCols, ctx.data.tableState);
  })

  .sections((_ctx) => {
    return [
      { type: "link", href: "/", label: "Main" },
      { type: "link", href: "/qc-report-table", label: "QC Report Table" },
    ];
  })

  .output("isRunning", (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .output(
    "libraryUploadProgress",
    (ctx) =>
      ctx.outputs
        ?.resolve({ field: "libraryImportHandle", allowPermanentAbsence: true })
        ?.getImportProgress(),
    { isActive: true },
  )

  .title(() => "MiXCR Amplicon Alignment")

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel || "")

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from "./progress";
export * from "./qc";
export * from "./reports";

// Internals

/**
 * Everything the workflow reads, projected without validation so `prerunArgs`
 * can share it.
 */
function toArgs(data: BlockData): BlockArgs {
  return {
    defaultBlockLabel: data.defaultBlockLabel,
    customBlockLabel: data.customBlockLabel,
    datasetRef: data.datasetRef,
    chains: data.chains,
    title: data.title,
    tagPattern: data.tagPattern,
    vGenes: data.vGenes,
    jGenes: data.jGenes,
    limitInput: data.limitInput,
    perProcessMemGB: data.perProcessMemGB,
    perProcessCPUs: data.perProcessCPUs,
    cloneClusteringMode: data.cloneClusteringMode,
    assemblingFeature: data.assemblingFeature,
    badQualityThreshold: data.badQualityThreshold,
    disableLowQualityMapping: data.disableLowQualityMapping,
    stopCodonTypes: data.stopCodonTypes,
    stopCodonReplacements: data.stopCodonReplacements,
    referenceFileHandle: data.referenceFileHandle,
    libraryFile: data.libraryFile,
    isLibraryFileGzipped: data.isLibraryFileGzipped,
    imputeGermline: data.imputeGermline,
    libraryEntries: data.libraryEntries,
    buildLibraryVGenes: data.buildLibraryVGenes,
    buildLibraryJGenes: data.buildLibraryJGenes,
    referenceInputMode: data.referenceInputMode,
  };
}

/** The handle when it can resolve on another machine, else undefined. */
function shareableFileHandle(handle: ImportFileHandle | undefined): ImportFileHandle | undefined {
  return handle !== undefined && isImportFileHandleIndex(handle) ? handle : undefined;
}
