<script setup lang="ts">
import type { AmpliconAlignmentResult } from '../results';
import AlignmentsChart from '../charts/AlignmentsChart.vue';

defineProps<{
  sampleData: AmpliconAlignmentResult;
}>();
</script>

<template>
  <AlignmentsChart :align-report="sampleData.alignReport" />
</template>
