<script setup lang="ts">
import { PlChartStackedBar } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useAlignmentChartSettings } from "./alignmentChartSettings";
import type { AlignReport } from "../results";

const props = defineProps<{
  alignReport?: AlignReport;
}>();

const alignReport = computed(() => props.alignReport);

const settings = useAlignmentChartSettings(alignReport);
</script>

<template>
  <PlChartStackedBar :settings="settings" />
</template>
