# International Phrase validation

The compiler checks explicit `EE_`, `RC_`, and `T_` keys in enabled study cells against the loaded International Phrases catalog. Missing explicit keys block compilation. Empty or absent translations are allowed. Membership in the source-usage audit is not required.

`_languagePhrasesSpreadsheet` and `_phrasesSpreadsheet` define study-specific symbols. These symbols and their literal replacement values are excluded from the explicit-reference check and retain their existing missing-symbol and missing-column validation. `_phrasesColumnName` selects a column in the second spreadsheet.

The compiler also evaluates a build-specific source index through the [study phrase analysis API](study-phrase-analysis.md), even when a study contains no explicit International Phrase tokens. Web analysis is optional. Unavailable or mismatched analysis and uncertain missing source candidates produce no compiler warnings. Candidate issues remain in the downloadable report. Local examples require a valid source index.

The read-only `phrases-audit-compiler` endpoint remains available for audit consumers but is not required by study compilation.
