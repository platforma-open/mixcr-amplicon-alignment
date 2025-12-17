import { platforma } from '@platforma-open/milaboratories.mixcr-amplicon-alignment.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import QcReportTablePage from './pages/QcReportTablePage.vue';

export const sdkPlugin = defineApp(platforma, () => {
  return {
    routes: {
      '/': () => MainPage,
      '/qc-report-table': () => QcReportTablePage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
