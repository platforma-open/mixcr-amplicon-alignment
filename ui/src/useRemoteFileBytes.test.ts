import type { ImportFileHandle } from "@platforma-sdk/model";
import { nextTick, ref, type Ref } from "vue";
import { describe, expect, test, vi } from "vitest";
import { importFailureMessage, useRemoteFileBytes, type ExportedFile } from "./useRemoteFileBytes";

const contents = new Map<string, Ref<string | undefined>>();

vi.mock("@platforma-sdk/ui-vue", () => ({
  ReactiveFileContent: {
    useGlobal: () => ({
      getContentString: (handle: string) => contents.get(handle),
    }),
  },
}));

const PICK = "index://index/a" as ImportFileHandle;
const OTHER = "index://index/b" as ImportFileHandle;

function blobExport(source: string, handle: string): ExportedFile {
  return { source, blob: { handle, size: 1 } as never };
}

// A component-free harness: the callbacks under test act on plain refs.
function setup(exported: Ref<ExportedFile | undefined>, pick: Ref<ImportFileHandle | undefined>) {
  const derived = ref<string | undefined>();
  const parseError = ref<string | undefined>();
  const derive = vi.fn((content: string) => {
    if (content.startsWith(">")) derived.value = content;
    else parseError.value = "not a FASTA";
  });
  const route = useRemoteFileBytes({
    exported: () => exported.value,
    pick: () => pick.value,
    isDerived: () => derived.value !== undefined,
    onDerive: derive,
  });
  const pickRemote = (handle: ImportFileHandle) => {
    pick.value = handle;
    parseError.value = undefined;
    derived.value = undefined;
    route.stop();
    route.start();
  };
  return { ...route, derived, parseError, derive, pickRemote };
}

describe("useRemoteFileBytes", () => {
  test("derives once the export matches the pick, then stops", async () => {
    contents.set("blob-1", ref(">v\nACGT"));
    const exported = ref<ExportedFile | undefined>();
    const pick = ref<ImportFileHandle | undefined>();
    const h = setup(exported, pick);

    h.pickRemote(PICK);
    await nextTick();
    expect(h.awaiting.value).toBe(true);

    exported.value = blobExport(PICK, "blob-1");
    await nextTick();
    expect(h.awaiting.value).toBe(false);
    expect(h.derived.value).toBe(">v\nACGT");
    expect(h.derive).toHaveBeenCalledTimes(1);

    // The re-render after the derive returns the same bytes under a new handle.
    contents.set("blob-2", ref(">v\nACGT"));
    exported.value = blobExport(PICK, "blob-2");
    await nextTick();
    expect(h.derive).toHaveBeenCalledTimes(1);
  });

  test("re-picking a file that did not parse ends the wait and re-raises the error", async () => {
    contents.set("blob-bad", ref("plain text"));
    const exported = ref<ExportedFile | undefined>(blobExport(PICK, "blob-bad"));
    const pick = ref<ImportFileHandle | undefined>();
    const h = setup(exported, pick);

    h.pickRemote(PICK);
    await nextTick();
    expect(h.awaiting.value).toBe(false);
    expect(h.parseError.value).toBe("not a FASTA");

    // Same handle, same bytes, same derived state: only the pick sequence moves.
    h.pickRemote(PICK);
    expect(h.parseError.value).toBeUndefined();
    await nextTick();
    expect(h.awaiting.value).toBe(false);
    expect(h.parseError.value).toBe("not a FASTA");
    expect(h.derive).toHaveBeenCalledTimes(2);
  });

  test("a failed import ends the wait and names the cause", async () => {
    const exported = ref<ExportedFile | undefined>();
    const pick = ref<ImportFileHandle | undefined>();
    const h = setup(exported, pick);

    h.pickRemote(PICK);
    exported.value = {
      source: PICK,
      error:
        'PlErrorReport: [I] "NG:0x1/blob": has input errors:\ncannot index object "x": item not found\noperation error S3: HeadObject',
    };
    await nextTick();
    expect(h.awaiting.value).toBe(false);
    expect(h.failure.value).toBe('cannot index object "x": item not found');
    expect(h.derive).not.toHaveBeenCalled();
  });

  test("a failure stamped with a replaced pick is not shown", async () => {
    const exported = ref<ExportedFile | undefined>({ source: PICK, error: "boom" });
    const pick = ref<ImportFileHandle | undefined>();
    const h = setup(exported, pick);

    h.pickRemote(OTHER);
    await nextTick();
    expect(h.failure.value).toBeUndefined();
    expect(h.awaiting.value).toBe(true);
  });
});

describe("importFailureMessage", () => {
  test("skips the field chain and the error-class prefixes", () => {
    const raw =
      'PlQuickJSError: PlErrorReport: [I] "NG:0x24B97C2/blob": has input errors:\n[O] "NG:0x24B97C1/handle": has input errors:\nfailed to use object ETag as checksum: cannot index object "a/b.fasta": item not found\noperation error S3: HeadObject, https response error StatusCode: 404';
    expect(importFailureMessage(raw)).toBe(
      'failed to use object ETag as checksum: cannot index object "a/b.fasta": item not found',
    );
  });

  test("falls back when nothing but the chain is left", () => {
    expect(importFailureMessage('[I] "NG:0x1/blob": has input errors:\n')).toBe(
      "The storage read failed.",
    );
  });
});
