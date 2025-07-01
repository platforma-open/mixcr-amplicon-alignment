// This file is intentionally left empty.
// The results logic was removed as the table was removed from the UI.

import type { AlignReport as ModelAlignReport } from "@platforma-open/milaboratories.mixcr-amplicon-alignment.model";
import type { AnyLogHandle } from "@platforma-sdk/model";
import { ReactiveFileContent } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "./app";

export type AlignReport = ModelAlignReport;
export type AssembleReport = Record<string, unknown>;
export type QcItem = {
  status: "OK" | "WARN" | "ALERT";
  title: string;
  message: string;
};
export type Qc = QcItem[];

export type AmpliconAlignmentResult = {
  label: string;
  sampleId: string;
  progress: string;
  logHandle?: AnyLogHandle;
  alignReport?: AlignReport;
  assembleReport?: AssembleReport;
  qc?: Qc;
};

/** Relatively rarely changing part of the results */
export const AmpliconAlignmentResultsMap = computed(() => {
  const app = useApp();

  const sampleLabels = app.model.outputs.sampleLabels;
  if (sampleLabels === undefined) return undefined;

  const resultMap = new Map<string, AmpliconAlignmentResult>();

  // Create results for all samples from sample labels
  for (const sampleId in sampleLabels) {
    const result: AmpliconAlignmentResult = {
      sampleId: sampleId,
      progress: 'Queued',
      label: sampleLabels[sampleId] ?? `<no label / ${sampleId}>`,
    };
    resultMap.set(sampleId, result);
  }

  // Add QC data if available
  const qc = app.model.outputs.qc;
  if (qc) {
    for (const qcData of qc.data) {
      const sampleId = qcData.key[0] as string;
      const existingResult = resultMap.get(sampleId);
      if (existingResult && qcData.value !== undefined) {
        // globally cached
        existingResult.qc = ReactiveFileContent.getContentJson(
          qcData.value.handle
        )?.value as Qc | undefined;
      }
    }
  }

  const logs = app.model.outputs.logs;
  if (logs)
    for (const logData of logs.data) {
      const sampleId = logData.key[0] as string;
      if (resultMap.get(sampleId))
        resultMap.get(sampleId)!.logHandle = logData.value;
    }

  const reports = app.model.outputs.reports;
  if (reports)
    for (const report of reports.data) {
      const sampleId = report.key[0] as string;
      const reportId = report.key[1] as string;
      if (report.key[2] !== 'json' || report.value === undefined) continue;
      if (resultMap.get(sampleId))
        switch (reportId) {
          case 'align':
            // globally cached
            resultMap.get(sampleId)!.alignReport =
              ReactiveFileContent.getContentJson(report.value.handle)?.value as
              | AlignReport
              | undefined;
            break;
          case 'assemble':
            // globally cached
            resultMap.get(sampleId)!.assembleReport =
              ReactiveFileContent.getContentJson(report.value.handle)?.value as
              | AssembleReport
              | undefined;
            break;
        }
    }

  return resultMap;
});

/** Results augmented with execution progress */
export const resultMap = computed<
  Map<string, AmpliconAlignmentResult> | undefined
>(() => {
  const app = useApp();

  const rawMap = AmpliconAlignmentResultsMap.value;
  if (rawMap === undefined) return undefined;

  // shallow cloning the map and its values
  const resultMap = new Map([...rawMap].map((v) => [v[0], { ...v[1] }]));

  const progress = app.model.outputs.progress;
  const doneRaw = app.model.outputs.done;
  const done = doneRaw ? new Set(doneRaw) : new Set<string>();

  // adding progress information if available
  if (progress) {
    for (const p of progress.data) {
      const sampleId = p.key[0] as string;
      if (resultMap.get(sampleId))
        if (p?.value)
          resultMap.get(sampleId)!.progress = done.has(sampleId)
            ? 'Done'
            : p.value?.replace('[==PROGRESS==]', '') ?? 'Not started';
    }
  }

  return resultMap;
});
