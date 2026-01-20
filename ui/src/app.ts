import { platforma } from '@platforma-open/milaboratories.mixcr-amplicon-alignment.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import QcReportTablePage from './pages/QcReportTablePage.vue';
import { watch } from 'vue';

export const sdkPlugin = defineApp(platforma, () => {
  return {
    routes: {
      '/': () => MainPage,
      '/qc-report-table': () => QcReportTablePage,
    },
  };
});

export const useApp = sdkPlugin.useApp;

// Make sure labels are initialized
const unwatch = watch(sdkPlugin, ({ loaded }) => {
  if (!loaded) return;
  const app = useApp();
  app.model.args.customBlockLabel ??= '';
  app.model.args.defaultBlockLabel ??= 'Select Clonotype Definition';
  unwatch();
});
