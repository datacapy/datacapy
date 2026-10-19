---
"@datacapy/om": patch
---

`SchemaEncryptionServiceRsa` wraps and unwraps the AES key with WebCrypto RSA-OAEP instead of the synchronous `publicEncrypt`/`privateDecrypt`, so RSA runs on the libuv thread pool and no longer blocks the event loop. Envelopes are unchanged.

<!-- cspell:ignore libuv OAEP -->
