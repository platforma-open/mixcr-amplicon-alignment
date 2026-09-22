import type { BlobHandleAndSize, ImportFileHandle } from "@platforma-sdk/model";
import { ReactiveFileContent } from "@platforma-sdk/ui-vue";
import { computed, ref, watch, type Ref } from "vue";

/**
 * What the prerun exports for one picked file: the bytes, and the handle they
 * were imported from.
 */
export type ExportedFile = { blob: BlobHandleAndSize; source: string };

export type RemoteFileBytesOptions = {
  /** The prerun's export for this picker. Undefined until the bytes land. */
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
  /** True between the pick and the arrival of the bytes. */
  awaiting: Ref<boolean>;
  /** Call after picking a file the desktop cannot read off disk. */
  start: () => void;
  /** Call after picking a local file, and after clearing the picker. */
  stop: () => void;
};

/**
 * Reads the bytes of an `index://` file that the prerun imported and re-exported.
 *
 * The desktop reads an `upload://` handle straight off disk. An `index://` handle
 * points into a pl-side storage, which the desktop can read only when that storage
 * is mounted locally — an S3 data library never is. The prerun is the only route
 * those bytes have to the UI. Callers keep the direct disk read for local files.
 *
 * `awaiting` has no failure state, and cannot be given an honest one here. Nothing
 * surfaces a prerun error to the UI, and the wait covers scheduling the prerun on
 * the server as well as the storage read, so a slow read and a failed one are
 * indistinguishable from this side. A timer would detect elapsed time, not failure.
 * Closing this needs an error channel on the prerun output.
 */
export function useRemoteFileBytes(options: RemoteFileBytesOptions): RemoteFileBytes {
  const reactiveFileContent = ReactiveFileContent.useGlobal();
  const awaiting = ref(false);

  // The source gate drops bytes belonging to a pick the user has already replaced.
  // The prerun output keeps naming the previous file until staging re-renders, so
  // a slow fetch can land after the next pick. If that next pick is a local file,
  // nothing arrives later to correct it.
  const content = computed(() => {
    if (options.enabled !== undefined && !options.enabled()) return undefined;
    const exported = options.exported();
    if (exported === undefined || exported.source !== options.pick()) return undefined;
    return reactiveFileContent.getContentString(exported.blob.handle)?.value;
  });

  // An `outputs -> data` write. The watcher fires when the bytes or the derived
  // state change, and derives only when nothing is derived from them yet.
  //
  // `isDerived` guards two cases. `ReactiveFileContent` keys its refs to the
  // calling component's effect scope, so every mount replays `undefined -> content`.
  // A second derive would overwrite state the user has edited since. `isDerived`
  // also lets the user pick the same file twice. The bytes and the `source` stamp
  // do not change on a re-pick, so a watcher on the content alone never fires again.
  //
  // The watcher settles. A derive writes block data that is in `prerunArgs`, so
  // staging re-renders and the same file returns under a new blob handle. The next
  // pass reads `isDerived` as true and stops.
  watch(
    () => ({ content: content.value, derived: options.isDerived() }),
    ({ content, derived }) => {
      if (content === undefined || options.pick() === undefined) return;
      awaiting.value = false;
      options.onContent?.(content);
      if (derived) return;
      options.onDerive(content);
    },
    { immediate: true },
  );

  return {
    awaiting,
    start: () => {
      awaiting.value = true;
    },
    stop: () => {
      awaiting.value = false;
    },
  };
}
