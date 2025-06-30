<script setup lang="ts">
import { computed } from 'vue';
import type { AmpliconAlignmentResult } from '../results';
import QcSection from '../components/QcSection.vue';

const props = defineProps<{
  sampleData: AmpliconAlignmentResult;
}>();

const qc = computed(() => props.sampleData.qc);
</script>

<template>
  <div>
    <QcSection v-for="(it, i) in qc" :key="i" :value="it" />
  </div>
</template> 