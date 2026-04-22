# PakSpeed

**Pakistan's first community-owned, open-source internet measurement and accountability platform.**

[![Status: Live](https://img.shields.io/badge/status-live-brightgreen)](https://pakspeed.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Data License: CC-BY-4.0](https://img.shields.io/badge/data-CC--BY--4.0-orange)](https://creativecommons.org/licenses/by/4.0/)
[![Built by WALI](https://img.shields.io/badge/built%20by-WALI-01411C)](https://walipak.com)

---

## 📊 Latest Report

**Pakistan's Internet at 30,000 Tests — First Milestone Accountability Report (April 2026)**

→ Read the report: **[pakspeed.com/milestone-report.html](https://pakspeed.com/milestone-report.html)**

A first nationwide, citizen-measured accountability report on broadband performance in a country of 240 million people — covering 241 cities, 317 internet service providers, and every province of Pakistan. Data collected transparently, published openly, built to name names.

---

## What is PakSpeed?

PakSpeed is an independent, community-owned internet measurement platform built to give Pakistani internet users — and the researchers, journalists, and policymakers who serve them — the evidence base that has been missing for a decade.

**What makes PakSpeed structurally different:**

- **Urdu-first** — the default interface language is Urdu, with English as a toggle
- **Open data** — every test result is released under Creative Commons Attribution 4.0
- **ISPs named** — no anonymisation, no corporate protection
- **Privacy-preserving** — raw IP addresses are never stored; only ISP name (from ASN lookup) and city (from IP geolocation)
- **Community-owned** — not an ISP, not a government, not a VC-backed startup. A civic technology lab project.
- **AI-powered accountability** — Cloudflare Workers AI runs throttling detection, citizen-feedback NLP, and weekly bilingual report generation

---

## Architecture

PakSpeed is built on a deliberately simple, auditable stack:

| Layer | Technology | Role |
|---|---|---|
| Frontend | Static HTML / CSS / JS on Cloudflare Pages | User interface at pakspeed.com; bilingual Urdu/English |
| Measurement | [LibreSpeed](https://github.com/librespeed/speedtest) on Oracle Cloud VPS | Performs the actual TCP throughput test |
| Storage | Cloudflare D1 (SQLite) | Stores anonymised telemetry |
| API | Cloudflare Workers | Receives test submissions, serves dashboard data |
| AI | Cloudflare Workers AI | Throttling detection, review NLP, bilingual weekly reports |
| Domain | Cloudflare | DNS, CDN, security |

**Critically: Cloudflare is the storage and analysis pipeline. The actual speed measurement happens via LibreSpeed on dedicated Oracle infrastructure.** These are two separable systems and can be audited independently.

---

## Source release

The full source code is being prepared for public release. We are currently completing pre-release security review and documentation before publishing the codebase in full. The first release is scheduled for the second quarter of 2026, alongside PakSpeed's next quarterly research report.

For early research access, audit inquiries, or academic collaboration before public release, please contact the PakSpeed team directly.

**📧 Contact:** [talk@walipak.com](mailto:talk@walipak.com)

---

## Data

All aggregated speed-test data in PakSpeed's public reports and future open data portal is released under **Creative Commons Attribution 4.0 International (CC-BY-4.0)**. Researchers, journalists, and civil society organisations may use, redistribute, and build upon this data with attribution.

**Aggregate dataset exports** are available to researchers, journalists, and regulators on request. Email [talk@walipak.com](mailto:talk@walipak.com) with a brief description of your research or reporting interest.

---

## Citing PakSpeed

If you use PakSpeed data in academic, journalistic, or policy work, please cite:

> PakSpeed (2026). *Pakistan's Internet at 30,000 Tests — First Milestone Accountability Report.* WALI — Wang Lab of Innovation, in partnership with Urdu AI. Published 21 April 2026. https://pakspeed.com/milestone-report.html

---

## About WALI

PakSpeed is a project of **WALI — Wang Lab of Innovation** — a civic technology and applied research lab based in Pakistan, built in partnership with **Urdu AI**, Pakistan's largest Urdu-language AI literacy community.

WALI builds open-source, community-owned digital infrastructure for public accountability, with a focus on Pakistan's internet, education, and public-service ecosystems.

🌐 **WALI:** [walipak.com](https://walipak.com)
🌐 **Urdu AI:** [urduai.org](https://urduai.org)
🌐 **PakSpeed:** [pakspeed.com](https://pakspeed.com)

---

## Partners we're looking for

- Funders investing in digital equity and internet-governance infrastructure
- Universities and research institutions interested in longitudinal connectivity analysis
- Journalists and policy organisations using open data to hold providers accountable
- Civil society technologists in neighbouring economies interested in replicating the model

Contact: [talk@walipak.com](mailto:talk@walipak.com)

---

## License

- **Code** (forthcoming): MIT License — see [LICENSE](LICENSE)
- **Data**: [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Reports and documentation**: [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/)

---

© 2026 PakSpeed · WALI × Urdu AI · Made in Pakistan
