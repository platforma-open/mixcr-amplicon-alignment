---
"@platforma-open/milaboratories.mixcr-amplicon-alignment": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.model": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": patch
---

Read reference FASTA files picked from a remote storage

A FASTA picked from a data library the desktop has not mounted (an S3 bucket, for
instance) failed with "Storage <id> is not mounted locally". The prerun now
imports and re-exports an `index://` handle, and the UI parses those bytes.
Applies to both the FASTA File reference input and the Build Library upload.
