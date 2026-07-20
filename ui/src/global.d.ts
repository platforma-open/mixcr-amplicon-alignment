// The base `@milaboratories/ts-configs/block/ui` config sets `types: []`, which
// disables automatic inclusion of ambient @types packages. The File System Access
// API globals (window.showSaveFilePicker) come from @types/wicg-file-system-access,
// so we pull them in explicitly here — an explicit reference resolves even when
// automatic @types inclusion is off, and survives structurer tsconfig regeneration.
/// <reference types="wicg-file-system-access" />
