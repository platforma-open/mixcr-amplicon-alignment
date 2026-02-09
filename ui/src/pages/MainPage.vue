<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3';

import { plRefsEqual } from '@platforma-sdk/model';
import type { PlAgHeaderComponentParams } from '@platforma-sdk/ui-vue';
import {
  AgGridTheme,
  PlAgChartStackedBarCell,
  PlAgOverlayLoading,
  PlAgOverlayNoRows,
  PlAgTextAndButtonCell,
  PlBlockPage,
  PlBtnGhost,
  PlMaskIcon24,
  PlSlideModal,
  autoSizeRowNumberColumn,
  createAgGridColDef,
  makeRowNumberColDef,
} from '@platforma-sdk/ui-vue';
import { whenever } from '@vueuse/core';
import type {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
} from 'ag-grid-enterprise';
import { ClientSideRowModelModule, ModuleRegistry } from 'ag-grid-enterprise';
import { computed, reactive, shallowRef, watch, watchEffect } from 'vue';
import { useApp } from '../app';
import { getAlignmentChartSettings } from '../charts/alignmentChartSettings';
import { parseProgressString } from '../parseProgress';
import type { AmpliconAlignmentResult } from '../results';
import { resultMap } from '../results';
import LogsPanel from './LogsPanel.vue';
import SampleReportPanel from './SampleReportPanel.vue';
import SettingsPanel from './SettingsPanel.vue';
import { ExportRawBtn } from '../ExportRawBtn';

const app = useApp();

// updating defaultBlockLabel
watchEffect(() => {
  const parts: string[] = [];
  // Add dataset name if available
  if (app.model.args.datasetRef) {
    const inputOption = app.model.outputs.inputOptions?.find(
      (p) => app.model.args.datasetRef && plRefsEqual(p.ref, app.model.args.datasetRef),
    );
    if (inputOption?.label) {
      parts.push(inputOption.label);
    }
  }
  // Add chains if available
  if (app.model.args.chains) {
    parts.push(app.model.args.chains);
  }
  // Add assembling feature if available
  if (app.model.args.assemblingFeature) {
    parts.push(app.model.args.assemblingFeature);
  }
  app.model.args.defaultBlockLabel = parts.filter(Boolean).join(' - ');
});

const result = computed(() =>
  resultMap.value ? [...resultMap.value.values()] : undefined,
);

const loadingOverlayParams = computed(() => {
  if (app.model.outputs.started) {
    return { variant: 'running' as const, runningText: 'Loading Sample List' };
  }
  return { variant: 'not-ready' as const };
});

const data = reactive<{
  settingsOpen: boolean;
  sampleReportOpen: boolean;
  logsOpen: boolean;
  selectedSample: string | undefined;
}>({
  settingsOpen: app.model.outputs.started === false,
  sampleReportOpen: false,
  logsOpen: false,
  selectedSample: undefined,
});

ModuleRegistry.registerModules([ClientSideRowModelModule]);

watch(
  () => app.model.outputs.started,
  (newVal, oldVal) => {
    if (oldVal === false && newVal === true) {
      data.settingsOpen = false;
      gridApi.value?.showLoadingOverlay();
    }
    if (oldVal === true && newVal === false) data.settingsOpen = true;
  },
);

whenever(
  () => data.settingsOpen,
  () => (data.sampleReportOpen = false),
);
whenever(
  () => data.sampleReportOpen,
  () => (data.settingsOpen = false),
);

const gridApi = shallowRef<GridApi>();
const onGridReady = (params: GridReadyEvent) => {
  gridApi.value = params.api;
  autoSizeRowNumberColumn(params.api);
};

const defaultColumnDef: ColDef = {
  suppressHeaderMenuButton: true,
  lockPinned: true,
  sortable: false,
};

const columnDefs: ColDef<AmpliconAlignmentResult>[] = [
  makeRowNumberColDef(),
  createAgGridColDef<AmpliconAlignmentResult, string>({
    colId: 'label',
    field: 'label',
    headerName: 'Sample',
    headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
    pinned: 'left',
    lockPinned: true,
    sortable: true,
    cellRenderer: PlAgTextAndButtonCell,
    cellRendererParams: {
      invokeRowsOnDoubleClick: true,
    },
  }),
  createAgGridColDef<AmpliconAlignmentResult, string>({
    colId: 'progress',
    field: 'progress',
    headerName: 'Progress',
    headerComponentParams: {
      type: 'Progress',
    } satisfies PlAgHeaderComponentParams,
    progress(cellData) {
      const parsed = parseProgressString(cellData);

      if (parsed.stage === 'Queued') {
        return {
          status: 'not_started',
          text: parsed.stage,
        };
      }

      return {
        status: parsed.stage === 'Done' ? 'done' : 'running',
        percent: parsed.percentage,
        text: parsed.stage,
        suffix: parsed.etaLabel ?? '',
      };
    },
  }),
  createAgGridColDef<AmpliconAlignmentResult, string>({
    colId: 'alignmentStats',
    headerName: 'Alignments',
    headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
    flex: 1,
    cellStyle: {
      '--ag-cell-horizontal-padding': '12px',
    },
    cellRendererSelector: (cellData) => {
      const value = getAlignmentChartSettings(cellData.data?.alignReport);
      return {
        component: PlAgChartStackedBarCell,
        params: { value },
      };
    },
  }),
];

const gridOptions: GridOptions<AmpliconAlignmentResult> = {
  getRowId: (row) => row.data.sampleId,
  onRowDoubleClicked: (e) => {
    data.selectedSample = e.data?.sampleId;
    data.sampleReportOpen = data.selectedSample !== undefined;
  },
  components: {
    PlAgTextAndButtonCell,
  },
};

const showLogs = () => {
  data.logsOpen = true;
};
</script>

<template>
  <PlBlockPage
    title="MiXCR Amplicon Alignment"
  >
    <template #append>
      <ExportRawBtn />
      <PlBtnGhost @click.stop="showLogs">
        Reference Alignment Logs
        <template #append>
          <PlMaskIcon24 name="file-logs" />
        </template>
      </PlBtnGhost>
      <PlBtnGhost @click.stop="() => (data.settingsOpen = true)">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>

    <div :style="{ flex: 1 }">
      <AgGridVue
        :theme="AgGridTheme"
        :style="{ height: '100%' }"
        :rowData="result"
        :defaultColDef="defaultColumnDef"
        :columnDefs="columnDefs"
        :grid-options="gridOptions"
        :loadingOverlayComponentParams="loadingOverlayParams"
        :loadingOverlayComponent="PlAgOverlayLoading"
        :noRowsOverlayComponent="PlAgOverlayNoRows"
        @grid-ready="onGridReady"
      />
    </div>
  </PlBlockPage>

  <PlSlideModal
    v-model="data.logsOpen"
    :close-on-outside-click="false"
    width="100%"
  >
    <template #title>Reference Library Generation Logs</template>
    <LogsPanel />
  </PlSlideModal>

  <PlSlideModal
    v-model="data.settingsOpen"
    :shadow="true"
    :close-on-outside-click="app.model.outputs.started === true"
    width="40%"
  >
    <template #title>Settings</template>
    <SettingsPanel />
  </PlSlideModal>

  <PlSlideModal
    v-model="data.sampleReportOpen"
    :close-on-outside-click="app.model.outputs.started"
    width="80%"
  >
    <template #title>
      Results for
      {{
        (data.selectedSample
          ? app.model.outputs.sampleLabels?.[data.selectedSample]
          : undefined) ?? "..."
      }}
    </template>
    <SampleReportPanel v-model="data.selectedSample" />
  </PlSlideModal>
</template>
