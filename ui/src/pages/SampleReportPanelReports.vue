<script setup lang="ts">
import {
  PlBtnGroup,
  PlContainer,
  PlTextArea,
  ReactiveFileContent,
} from '@platforma-sdk/ui-vue';
import type { SimpleOption } from '@platforma-sdk/ui-vue';
import { computed, reactive } from 'vue';
import { useApp } from '../app';

const props = defineProps<{
  sampleId: string;
}>();

type ReportId = 'align' | 'assemble';
const data = reactive<{
  currentReport: ReportId;
}>({
  currentReport: 'align',
});

const app = useApp();

const reportHandle = computed(() => {
  const sampleId = props.sampleId;
  return app.model.outputs.reports?.data?.find(
    (d) =>
      d.key[0] === sampleId
      && d.key[1] === data.currentReport
      && d.key[2] === 'txt',
  )?.value?.handle;
});

const reportContent = computed(
  () => ReactiveFileContent.getContentString(reportHandle.value)?.value,
);

const tabOptions: SimpleOption<ReportId>[] = [
  { value: 'align', text: 'Align' },
  { value: 'assemble', text: 'Assemble' },
];
</script>

<template>
  <PlContainer>
    <PlBtnGroup v-model="data.currentReport" :options="tabOptions" />
    <PlTextArea :model-value="reportContent" :rows="30" readonly />
  </PlContainer>
</template>
