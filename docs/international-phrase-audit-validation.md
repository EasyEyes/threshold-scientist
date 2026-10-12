# International Phrase validation

The compiler checks explicit `EE_`, `RC_`, and `T_` keys in enabled study cells against the latest completed International Phrases audit. Validation runs before custom symbols are substituted. It does not predict which runtime paths a participant will visit.

`_languagePhrasesSpreadsheet` and `_phrasesSpreadsheet` define study-specific symbols. These symbols and their literal replacement values are excluded from this audit check and retain their existing missing-symbol and missing-column validation. `_phrasesColumnName` selects a column in the second spreadsheet.

The read-only `phrases-audit-compiler` endpoint adapts stored audit reports without modifying the audit or study format. Queued and failed runs do not replace the last completed report. An unavailable or malformed report blocks compilation when the study contains explicit International Phrase references. Studies containing only custom phrases do not require this endpoint.

Blocking errors identify the key, study parameter and column, audit run, and report date. Existing source references and verified removal evidence are included when available. A key absent from the audit's used set is described as unaudited, rather than claiming that its translation is undefined.
