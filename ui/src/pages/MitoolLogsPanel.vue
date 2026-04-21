<script setup lang="ts">
import type { AnyLogHandle } from '@platforma-sdk/model';
import { PlLogView } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';
import { MitoolProgressPrefix } from '@platforma-open/milaboratories.mixcr-amplicon-alignment.model';

const app = useApp();

const mitoolLogs = computed(() => app.model.outputs.mitoolLogs);
const sampleGroups = computed(() => app.model.outputs.sampleGroups);

const groupLabelMap = computed(() => {
  const map = new Map<string, string>();
  const groups = sampleGroups.value;
  if (groups && typeof groups === 'object') {
    for (const [groupId, groupSamples] of Object.entries(groups)) {
      const firstLabel = Object.values(groupSamples as Record<string, string>)[0];
      map.set(groupId, typeof firstLabel === 'string' ? firstLabel : groupId);
    }
  }
  return map;
});

const groupLogs = computed(() => {
  const logs = mitoolLogs.value;
  if (!logs) return [];
  return logs.data
    .filter((entry) => entry.value !== undefined)
    .map((entry) => ({
      groupId: String(entry.key[0]),
      groupLabel: groupLabelMap.value.get(String(entry.key[0])) ?? String(entry.key[0]),
      logHandle: entry.value as AnyLogHandle,
    }));
});
</script>

<template>
  <div v-if="groupLogs.length > 0" class="mitool-logs-container">
    <div
      v-for="groupLog in groupLogs"
      :key="groupLog.groupId"
      class="mitool-log-group"
    >
      <PlLogView
        :log-handle="groupLog.logHandle"
        :progress-prefix="MitoolProgressPrefix"
        :label="`Demultiplexing Logs - ${groupLog.groupLabel}`"
      />
    </div>
  </div>
  <div v-else>
    <p>No demultiplexing logs yet. Logs will appear once mitool starts processing.</p>
  </div>
</template>

<style lang="css" scoped>
.mitool-logs-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.mitool-log-group {
  width: 100%;
}
</style>
