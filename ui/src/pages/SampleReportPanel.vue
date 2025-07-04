<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { SimpleOption } from '@platforma-sdk/ui-vue';
import { PlBtnGroup } from '@platforma-sdk/ui-vue';
import { resultMap } from '../results';
import SampleReportPanelLog from './SampleReportPanelLog.vue';
import SampleReportPanelReports from './SampleReportPanelReports.vue';
import SampleReportPanelVisualReport from './SampleReportPanelVisualReport.vue';

const sampleId = defineModel<string | undefined>();

const sampleData = computed(() => {
  if (sampleId.value === undefined || resultMap.value === undefined)
    return undefined;
  return resultMap.value.get(sampleId.value);
});

type TabId = 'visualReport' | 'reports' | 'logs';

const data = reactive<{
  currentTab: TabId;
}>({
  currentTab: 'visualReport',
});

const tabOptions: SimpleOption<TabId>[] = [
  { value: 'visualReport', text: 'Visual Report' },
  { value: 'reports', text: 'Reports' },
  { value: 'logs', text: 'Log' },
];
</script>

<template>
  <PlBtnGroup v-model="data.currentTab" :options="tabOptions" />
  <div
    v-if="sampleId !== undefined && sampleData !== undefined"
    class="pl-scrollable"
  >
    <SampleReportPanelVisualReport
      v-if="data.currentTab === 'visualReport'"
      :sample-data="sampleData"
    />
    <SampleReportPanelReports
      v-else-if="data.currentTab === 'reports'"
      :sample-id="sampleId"
    />
    <SampleReportPanelLog
      v-else-if="data.currentTab === 'logs'"
      :sample-data="sampleData"
    />
  </div>
  <div v-else>No sample selected</div>
</template>

<style lang="css" scoped>
.pl-scrollable {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
  max-height: 100%;
  max-width: 100%;
  padding: 0 6px;
  margin: 0 -6px;
}
</style>
