---
"@platforma-open/milaboratories.mixcr-amplicon-alignment": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.model": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.kind": patch
---

Read reference FASTA files picked from a remote storage

A FASTA picked from a data library the desktop has not mounted (an S3 bucket, for
instance) failed with "Storage <id> is not mounted locally". The prerun now
imports and re-exports an `index://` handle, and the UI parses those bytes.
Applies to both the FASTA File reference input and the Build Library upload.

When the platform cannot read the picked file (missing from the storage, storage
unknown to the server), the picker now shows the failure instead of waiting
indefinitely. Picking the same unparseable file twice no longer leaves the
picker on "Reading file from storage…".
