<script setup lang="ts">
import { AgGridVue } from "ag-grid-vue3";

import type { PlAgHeaderComponentParams } from "@platforma-sdk/ui-vue";
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
} from "@platforma-sdk/ui-vue";
import type {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
} from "ag-grid-enterprise";
import { ClientSideRowModelModule, ModuleRegistry } from "ag-grid-enterprise";
import { computed, reactive, shallowRef, watch } from "vue";
import { whenever } from "@vueuse/core";
import { getAlignmentChartSettings } from "../charts/alignmentChartSettings";
import { useApp } from "../app";
import { parseProgressString } from "../parseProgress";
import type { AmpliconAlignmentResult } from "../results";
import { resultMap } from "../results";
import SampleReportPanel from "./SampleReportPanel.vue";
import SettingsPanel from "./SettingsPanel.vue";
import LogsPanel from "./LogsPanel.vue";

const app = useApp();

const result = computed(() =>
  resultMap.value ? [...resultMap.value.values()] : []
);

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

watch(
  () => app.model.outputs.started,
  (newVal, oldVal) => {
    if (oldVal === false && newVal === true) data.settingsOpen = false;
    if (oldVal === true && newVal === false) data.settingsOpen = true;
  }
);

whenever(
  () => data.settingsOpen,
  () => (data.sampleReportOpen = false)
);
whenever(
  () => data.sampleReportOpen,
  () => (data.settingsOpen = false)
);

ModuleRegistry.registerModules([ClientSideRowModelModule]);

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
    colId: "label",
    field: "label",
    headerName: "Sample",
    headerComponentParams: { type: "Text" } satisfies PlAgHeaderComponentParams,
    pinned: "left",
    lockPinned: true,
    sortable: true,
    cellRenderer: PlAgTextAndButtonCell,
    cellRendererParams: {
      invokeRowsOnDoubleClick: true,
    },
  }),
  createAgGridColDef<AmpliconAlignmentResult, string>({
    colId: "progress",
    field: "progress",
    headerName: "Progress",
    headerComponentParams: {
      type: "Progress",
    } satisfies PlAgHeaderComponentParams,
    progress(cellData) {
      const parsed = parseProgressString(cellData);

      if (parsed.stage === "Queued") {
        return {
          status: "not_started",
          text: parsed.stage,
        };
      }

      return {
        status: parsed.stage === "Done" ? "done" : "running",
        percent: parsed.percentage,
        text: parsed.stage,
        suffix: parsed.etaLabel ?? "",
      };
    },
  }),
  createAgGridColDef<AmpliconAlignmentResult, string>({
    colId: "alignmentStats",
    headerName: "Alignments",
    headerComponentParams: { type: "Text" } satisfies PlAgHeaderComponentParams,
    flex: 1,
    cellStyle: {
      "--ag-cell-horizontal-padding": "12px",
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
  <PlBlockPage>
    <template #title>MiXCR Amplicon Alignment</template>
    <template #append>
      <PlBtnGhost @click.stop="showLogs">
        Reference Library Generation Logs
        <template #append>
          <PlMaskIcon24 name="error" />
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
        :loadingOverlayComponentParams="{ notReady: true }"
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

<style scoped>
/* No specific styles needed here as AG Grid handles the table styling */
</style>
