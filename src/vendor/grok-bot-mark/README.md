# Vendored Grok Bot mark runtime

These two files are copied without modification from `Grok Bot 0.75.5`:

- `index.eager-common-F4Y1-gMW.js`
- `chunk-rolldown-runtime-C0FnF6B9.js`

Source container:

```text
resources/app.asar from the local Grok Bot 0.75.5 distribution
```

Source paths:

```text
dist/renderer/assets/index.eager-common-F4Y1-gMW.js
dist/renderer/assets/chunk-rolldown-runtime-C0FnF6B9.js
```

ASAR SHA-256:

```text
8af53b7be015bb6c452f4a0fde9f0f980cc8a14e8e3df1bb2aacaead91e02c38
```

The common runtime exports the original `GrokBotMark` engine as `w`, the body
name mapper as `T`, the appearance adapter as `E`, and the fill factor as `j`.
The adapter in `src/avatar/exactEngine.ts` is the only handwritten integration
layer.

This vendored code is included solely to reproduce the authorized target's
observable animation and geometry one-to-one. It is not MIT-licensed project
source and must not be redistributed without confirming the target's applicable
license and authorization.

