import type { ExportedFile } from "@platforma-open/milaboratories.mixcr-amplicon-alignment.model";
import type { ImportFileHandle } from "@platforma-sdk/model";
import { ReactiveFileContent } from "@platforma-sdk/ui-vue";
import { computed, ref, watch, type ComputedRef } from "vue";

export type { ExportedFile };

export type RemoteFileBytesOptions = {
  /** The prerun's export for this picker. Undefined until the import settles. */
  exported: () => ExportedFile | undefined;
  /** The handle the user has picked now. */
  pick: () => ImportFileHandle | undefined;
  /** False suppresses the route. Use it when another input mode owns the state. */
  enabled?: () => boolean;
  /** True once the caller has derived everything it needs from these bytes. */
  isDerived: () => boolean;
  /** Runs on every pass the bytes are available. Use it for component state. */
  onContent?: (content: string) => void;
  /** Runs only while `isDerived` is false. Use it for writes to block data. */
  onDerive: (content: string) => void;
};

export type RemoteFileBytes = {
  /** True between the pick and the arrival of the bytes or of a failure. */
  awaiting: ComputedRef<boolean>;
  /** Why the platform could not read the current pick. Undefined until it fails. */
  failure: ComputedRef<string | undefined>;
  /** Call after picking a file the desktop cannot read off disk. */
  start: () => void;
  /** Call after picking a local file, and after clearing the picker. */
  stop: () => void;
};

/**
 * The backend reports an import failure as a chain of `"<resource>/<field>": has
 * input errors:` lines that ends in the cause. Keeps the cause's first line.
 */
export function importFailureMessage(raw: string): string {
  const cause = raw
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.endsWith("has input errors:"));
  const message = cause?.replace(/^(Pl\w*Error: |PlErrorReport: )+/, "") ?? "";
  return message.length > 0 ? message : "The storage read failed.";
}

/**
 * Reads the bytes of an `index://` file that the prerun imported and re-exported.
 *
 * The desktop reads an `upload://` handle straight off disk. An `index://` handle
 * points into a pl-side storage, which the desktop can read only when that storage
 * is mounted locally — an S3 data library never is. The prerun is the only route
 * those bytes have to the UI. Callers keep the direct disk read for local files.
 *
 * A failed import arrives on the same export as `error` instead of `blob`, under
 * the same `source` stamp. `awaiting` covers scheduling the prerun on the server
 * as well as the storage read, so a slow read shows as waiting until the platform
 * reports either the bytes or the failure.
 */
export function useRemoteFileBytes(options: RemoteFileBytesOptions): RemoteFileBytes {
  const reactiveFileContent = ReactiveFileContent.useGlobal();
  const waiting = ref(false);
  // Bumped on every `start()`. See the watcher.
  const pickSeq = ref(0);

  // The source gate drops an export belonging to a pick the user has already
  // replaced. The prerun output keeps naming the previous file until staging
  // re-renders, so a slow fetch can land after the next pick. If that next pick is
  // a local file, nothing arrives later to correct it.
  const current = computed(() => {
    if (options.enabled !== undefined && !options.enabled()) return undefined;
    const exported = options.exported();
    if (exported === undefined || exported.source !== options.pick()) return undefined;
    return exported;
  });

  const content = computed(() => {
    const blob = current.value?.blob;
    return blob === undefined
      ? undefined
      : reactiveFileContent.getContentString(blob.handle)?.value;
  });

  const failure = computed(() => {
    const error = current.value?.error;
    return error === undefined ? undefined : importFailureMessage(error);
  });

  const awaiting = computed(() => waiting.value && failure.value === undefined);

  // An `outputs -> data` write. The watcher fires when the bytes, the derived
  // state or the pick sequence change, and derives only when nothing is derived
  // from the bytes yet.
  //
  // `isDerived` guards two cases. `ReactiveFileContent` keys its refs to the
  // calling component's effect scope, so every mount replays `undefined -> content`.
  // A second derive would overwrite state the user has edited since. `isDerived`
  // also lets the user pick the same valid file twice: the pick clears the derived
  // state, and that flip is what re-fires the watcher.
  //
  // `pickSeq` covers the same file picked twice when it did not parse. Nothing else
  // changes then — the bytes, the stamp and the derived state are all as they were
  // — so without it the wait started by the pick never ends and the parse error the
  // pick cleared never comes back.
  //
  // The watcher settles. A derive writes block data that is in `prerunArgs`, so
  // staging re-renders and the same file returns under a new blob handle. The next
  // pass reads `isDerived` as true and stops.
  watch(
    () => ({ content: content.value, derived: options.isDerived(), seq: pickSeq.value }),
    ({ content, derived }) => {
      if (content === undefined || options.pick() === undefined) return;
      waiting.value = false;
      options.onContent?.(content);
      if (derived) return;
      options.onDerive(content);
    },
    { immediate: true },
  );

  return {
    awaiting,
    failure,
    start: () => {
      waiting.value = true;
      pickSeq.value++;
    },
    stop: () => {
      waiting.value = false;
    },
  };
}
