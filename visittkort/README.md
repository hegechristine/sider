# Digitalt visittkort

`sider.hegechristine.no/visittkort/`

Digital business card med vCard-nedlasting og automatisert kontaktretur.
Skannbart via QR for fysisk visittkort, eller del lenken direkte.

## Hva siden gjør

1. **Vis profil** — navn, rolle, bio, bilde
2. **Lagre i kontakter** — genererer vCard 3.0 (`.vcf`) klient-side og laster ned. iOS, Android, Outlook, Gmail støtter formatet.
3. **Quick actions** — E-post, Ring, Web, Podcast, "Del info" (jump til skjema)
4. **Sosiale lenker** — IG · LinkedIn · Facebook · YouTube
5. **Kontaktretur-skjema** — besøkende deler sine opplysninger; data går til
   både innboks (e-post) og Asana (CRM-task)

## Automasjon-flyt

```
Besøkende fyller skjema
        ↓
        ├─ POST  → FormSubmit (AJAX) → E-post til hegechristine@hegechristine.no
        │
        └─ POST  → Make.com webhook   → Asana "Create a Task"
                                       → Prosjekt: "Visittkort-kontakter"
                                       (MARKETING-team)
```

Begge POSTes parallelt fra `index.html` ved `submit`. FormSubmit driver
UI-feedback (flip-animasjon til takk-skjerm). Make er fire-and-forget —
en feil der blokkerer ikke bruker-flowen.

### Tjenester involvert

| Tjeneste | Rolle | Tier |
|---|---|---|
| GitHub Pages | Hosting (statisk) | Gratis |
| FormSubmit.co | Skjema → e-post + spam-filter | Gratis (1-gang aktivering per e-post) |
| Make.com | Webhook → Asana-routing | Gratis (1000 ops/mnd) |
| Asana | CRM-destinasjon | Eksisterende konto |

### Aktiveringer som må stå på

- **FormSubmit** er én-gangs aktivert per mottaker-e-post — bekreftelseslenke
  er klikket. Hvis mottakeren byttes, må ny aktivering kjøres.
- **Make-scenarioet** må være toggled **ON** (ikke "Inactive") for at
  webhooken skal akseptere requester. Inaktivt scenario svarer `410 There
  is no scenario listening for this webhook`.

## Filer

```
visittkort/
├── index.html       — selve siden (HTML + CSS + JS, ingen build)
├── profile.png      — profilbilde (96x96 portrett)
└── README.md        — denne fila
```

## Oppdateringer du kan trygt gjøre

| Endring | Hvor |
|---|---|
| Profilbilde | Bytt `profile.png` (samme størrelse 96×96 helst) |
| Bio-tekst | Søk etter `.vk-bio` i `index.html` |
| Rolle / kicker | `.vk-role` i samme fil |
| Telefonnummer | Søk etter `tel:+47` og `TEL;TYPE=CELL` |
| Sosiale URLer | `.socials` blokken nederst på profilkortet |
| Skjema-felter | `<form id="vk-form">` |
| vCard-innhold | `const vcard = [...]` nederst i `<script>` |

## Designsystem

Bruker tokens fra Hege Christines designsystem v1.0:
cream `#EFE6D4`, ink `#2E3230`, rust `#C5522C`, olive `#5E5F4C`,
sage `#AFBEA0`, sand `#F0D9A8`. Typografi: Archivo Black + Newsreader
italic + JetBrains Mono.

## Hvis noe slutter å fungere

**Skjema svarer ikke / 410 fra Make:** Sjekk at Make-scenarioet er ON.

**Skjema svarer "Skjemaet aktiveres":** FormSubmit-mottakerens e-post er
ikke bekreftet — sjekk innboks etter "Activate Form"-mail.

**E-post kommer, men ingen Asana-task:** Make-modulen klarer ikke koble seg
mot Asana. Åpne scenarioet, sjekk Asana-modulens connection — kan måtte
re-autorisere.

**Asana-task kommer, men ingen e-post:** FormSubmit-aktiveringen er
utløpt eller mottaker-aliaset er fjernet. Re-aktiver via første
test-submit.

## QR-kode (planlagt)

For trykk på fysisk visittkort: generer QR mot `https://sider.hegechristine.no/visittkort/`
med en QR-tjeneste eller `qrencode`-CLI. Ikke generert ennå.
