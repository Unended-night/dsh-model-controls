# Security and privacy

Do not include API keys, authorization headers, complete request bodies, private conversations or local profile files in an issue. Report the plugin and Harness versions, selected modes, sanitized error text and reproducible steps.

The plugin uses the current request's native authentication and does not keep a credential cache. It does not send telemetry. Local recovery logs include session identifiers, retry counts, delays and error categories; treat these as private diagnostic data. The plugin does not log custom User-Agent values, continuation message text or model request bodies.

No public reporting channel is configured for this unpublished candidate. Establish a private reporting channel before public release; do not publish exploit details or credentials in public issue threads.
