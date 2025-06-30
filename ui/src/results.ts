// This file is intentionally left empty.
// The results logic was removed as the table was removed from the UI.

import { isLiveLog, type AnyLogHandle } from '@platforma-sdk/model';
import { computed } from 'vue';
import { useApp } from './app';
import { ReactiveFileContent } from '@platforma-sdk/ui-vue';
import type { AlignReport as ModelAlignReport } from '@platforma-open/milaboratories.mixcr-amplicon-alignment.model';

export type AlignReport = ModelAlignReport;
export type AssembleReport = Record<string, unknown>;
export type QcItem = {
	status: 'OK' | 'WARN' | 'ALERT';
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
export const resultMap = computed(() => {
  const app = useApp();

  const sampleLabels = app.model.outputs.sampleLabels;
  if (sampleLabels === undefined) return undefined;

  const resultMap = new Map<string, AmpliconAlignmentResult>();

  for (const sampleId in sampleLabels) {
    const label = sampleLabels[sampleId];
    const result: AmpliconAlignmentResult = {
      sampleId: sampleId,
      label: label,
      progress: 'Not started',
    };
    resultMap.set(sampleId, result);
  }

  const qc = app.model.outputs.qc;
  if (qc) {
    for (const qcData of qc.data) {
      const sampleId = qcData.key[0] as string;
      const r = resultMap.get(sampleId);
      if (r && qcData.value) {
        r.qc = ReactiveFileContent.getContentJson(
          qcData.value.handle,
        )?.value as Qc | undefined;
      }
    }
  }

  // logs & reports
  const logs = app.model.outputs.logs;
  const reports = app.model.outputs.reports;
  const progress = app.model.outputs.progress;

  let done = false;
  if (logs) {
    for (const logData of logs.data) {
      const sampleId = logData.key[0] as string;
      const r = resultMap.get(sampleId);
      if (!r) continue;

      done = !isLiveLog(logData.value);
      r.logHandle = logData.value;
    }
  }

  if (reports) {
    for (const report of reports.data) {
      const sampleId = report.key[0] as string;
      const reportId = report.key[1] as string;
      if (report.key[2] !== 'json' || report.value === undefined) continue;
      const r = resultMap.get(sampleId);
      if (r) {
        switch (reportId) {
          case 'align':
            r.alignReport = ReactiveFileContent.getContentJson(
              report.value.handle,
            )?.value as AlignReport | undefined;
            break;
          case 'assemble':
            r.assembleReport = ReactiveFileContent.getContentJson(
              report.value.handle,
            )?.value as AssembleReport | undefined;
            break;
        }
      }
    }
  }

  if (progress) {
    for (const progressData of progress.data) {
      const sampleId = progressData.key[0] as string;
      const r = resultMap.get(sampleId);
      if (!r) continue;

      const p = done ? 'Done' : progressData.value?.replace('[==PROGRESS==]', '') ?? 'Not started';
      r.progress = p;
    }
  }

  return resultMap;
});
