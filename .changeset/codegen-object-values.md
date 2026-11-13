---
'@datacapy/codegen': minor
'@datacapy/schema': minor
---

`Default` and `Init` accept an object of literals, such as `Init<{ period: 'month'; day: 1; reminderSentAt: null }>`, and generate `.init({ period: 'month', day: 1, reminderSentAt: null })`. Nested objects work too.
