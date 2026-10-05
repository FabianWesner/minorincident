# 10 · Music Sources

> Research into background music, diegetic songs and stingers for *Minor Incident*. The audio files will be committed to a public MIT-licensed git repository. That means every file must allow **free redistribution of the raw file**, including commercial use. Researched on 2026-10-05. Every license below was checked on the source's own page, not on aggregators. **No audio was downloaded.**

Related: [09 · Sound Design](09-sound-design.md) (§11 licensing), [E16 · Audio](epic-16-audio.md) (E16-AC20 license check).

---

## 1. Licensing rules for this repo

**Allowed**

| License | Use | Obligations |
| --- | --- | --- |
| **CC0 / public domain** (preferred) | Anything | None. We still record the author and source as good practice and for provenance. |
| **CC-BY 3.0 / 4.0** | Anything, including edits, loops and stems | Credit the title, author, source URL and license, with a link to the license. Say if the file was modified (trimmed, looped, re-encoded, stem-split). Show the credit in the in-game credits **and** in `THIRD_PARTY_NOTICES.md`. Do not add DRM or extra restrictions. |

**Not allowed**

CC-BY-NC, CC-BY-ND, any "royalty-free" commercial pack, the Pixabay Content License, the Mixkit license, Zapsplat, Purple Planet, YouTube Audio Library, Artlist, Epidemic and similar services. Also excluded: any license that adds "no redistribution", "no standalone", "games only" or "sync only" terms, any source with unclear terms, and AI-generated tracks unless the tool's terms allow redistribution.

**Only with a separate decision (the "maybe" list)**

- **CC-BY-SA.** It can legally sit in an MIT repo, because the music stays under its own license and the code stays MIT. The problem is that every edit (loops, stems, re-mixes) must also be released as CC-BY-SA. The repo would then hold two copyleft regimes, which confuses downstream forks. Avoid unless nothing else fits.
- **"CC-BY plus extra terms"** (Scott Buckley, Clement Panchout). The authors add conditions on top of CC-BY. Section 2 explains each case.

**How to record a file**

1. `public/assets/audio/LICENSES.md` gets one row per file:
   `path | title | author | source URL (the page the file was downloaded from) | license + license URL | modifications | SHA-256 of the committed file | date retrieved`.
2. `THIRD_PARTY_NOTICES.md` gets one block per CC-BY work, using the author's requested credit line, for example:
   `"Life of Riley" Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/ — trimmed and looped.`
   CC0 works go in a short "with thanks" list (optional, but good practice).
3. The in-game credits screen shows the same CC-BY credit lines. Soundimage, if ever used, requires the credit to appear inside the game.
4. Save a copy (PDF or HTML) of each source's license page in the date it was retrieved, in a folder outside the shipped build, e.g. `docs/licenses/`. This covers us if a page changes or disappears, which already happened to FreePD.
5. Always download from the **original** page, never from an aggregator such as Chosic, FMA mirrors or YouTube rips.

---

## 2. Verdict on the sources checked

| Source | License (as stated on the source) | OK for the MIT repo? | Notes |
| --- | --- | --- | --- |
| **Kounine – "Bruno Simon – Free Music Pack"** ([itch](https://kounine.itch.io/bruno-simon)) | CC0 ("you can do whatever you want with them") | **Yes** | 3 tracks (*Baguira*, *Boy*, *Sudo*). These are the same files already in `folio-2025/static/sounds/musics/`. The `license.md` there is the plain CC0 legal text and does not name the composer, so credit Kounine ourselves. Each track is about 2:35–2:43, 48 kHz, WAV + 320 kbps MP3. |
| Kounine – other packs (*Dungeons*, *Path of Adventure*, paid packs) | "Standard commercial use license (non-exclusive)", per the author's itch comments | **No** | Only the Bruno Simon pack is CC0. Do not assume his other free packs are CC0. |
| **Kevin MacLeod / incompetech** ([licenses](https://incompetech.com/music/royalty-free/licenses/), [FAQ](https://incompetech.com/music/royalty-free/faq.html)) | CC-BY 4.0 ([legalcode](https://creativecommons.org/licenses/by/4.0/legalcode.en)) | **Yes** | About 1,440 tracks. The full catalog is available as JSON with genre, feel, length and instruments, at `incompetech.com/music/royalty-free/pieces.json`. Direct MP3s are at `incompetech.com/music/royalty-free/mp3-royaltyfree/<Title>.mp3`. **Risk:** he pre-registers his music with YouTube Content ID ([page](https://incompetech.com/music/royalty-free/youtube-contentid.html)), so let's-play videos can get claims that need disputing. No stems. |
| **OpenGameArt** ([opengameart.org](https://opengameart.org)) | Per item: CC0, CC-BY 3.0/4.0, CC-BY-SA, GPL, OGA-BY | **Yes, CC0 / CC-BY items only** | The license is set per item, so check each page. "Collections" such as *CC0 – Cinematic Music* are curated lists: open every linked item to confirm it is really CC0. Remixes on OGA often inherit SA (e.g. *The hope & Element* is CC-BY-SA 3.0). |
| **Juhani Junkala / SubspaceAudio** (OGA JRPG packs 1–5) | CC0 on OGA ([e.g.](https://opengameart.org/content/jrpg-pack-5-action)) | **Yes (OGA copies)** | The itch *400 Indie Game Music Loops* bundle is **CC-BY 4.0 and costs $79.90** ([itch](https://subspaceaudio.itch.io/indie-game-music-loops)). Use the CC0 OGA uploads. Style is JRPG / retro synth. |
| **Tallbeard Studios / Abstraction – Music Loop Bundle** ([itch](https://tallbeard.itch.io/music-loop-bundle)) | CC0 ("has waived all copyright") | **Yes** | 200+ seamless loops, grouped by quarter, with a song-browser tool. There is a non-binding request not to use them for NFTs, AI training or "direct resale of unmodified assets"; a git repo is not resale. **Caveat:** [abstractionmusic.com](https://www.abstractionmusic.com/) says "most music is OK, some albums are not", so take files **only** from the itch bundle. |
| **Kenney – Music Jingles** ([kenney.nl](https://kenney.nl/assets/music-jingles), [OGA mirror](https://lpc.opengameart.org/node/22000)) | CC0 | **Yes** | 85 OGG jingles on 5 instruments (8-bit/NES, pizzicato, sax, steel drums, orchestral hits). Good for stingers. |
| **Komiku / Loyalty Freak Music** ([site](https://loyaltyfreakmusic.com/), [OGA example](https://opengameart.org/content/something-to-save)) | CC0 | **Yes** | Many albums (RPG, disco, chill, guitar). Also on FMA. |
| **HoliznaCC0** ([Bandcamp](https://holiznacc0.bandcamp.com/), [OGA](https://opengameart.org/content/funk-collection)) | CC0 | **Yes** | Collections of funk, lo-fi, chill beats, title screens, chiptune and *We Drove All Night*. The author warns that quality varies (some tracks were recorded as a teenager). |
| **Of Far Different Nature** ([loops](https://fardifferent.itch.io/loops), [ESCAPE](https://fardifferent.itch.io/escape)) | CC-BY 4.0 | **Yes** | 50+ loops as OGG/WAV (the author says MP3 does not loop cleanly), some with `[v2]` / `[short]` variants. The *ESCAPE* album is electro, house and DnB. Credit: `Music: "<track>" by Of Far Different Nature (https://fardifferent.bandcamp.com/)`. |
| **Tri-Tachyon** (OGA) | CC-BY 4.0 ([e.g.](https://opengameart.org/content/heavy-metal-riffs-monolith)) | **Yes** | Metal riffs, ambient guitar and soundscapes. Credit: "Music by Tri-Tachyon - https://soundcloud.com/tri-tachyon/albums". |
| **Alexander Nakarada** ([Bandcamp](https://alexandernakarada.bandcamp.com/)) | CC-BY 4.0 ("Commercial use allowed, use it as you wish!") | **Yes** | Collections: Ambient/Horror, Piano, Electronic, Epic & Orchestral, Metal & Rock, Acoustic & Ballad. The old serpentsoundstudios.com URL now hosts unrelated content, so link to Bandcamp. |
| **Scott Buckley** ([library](https://www.scottbuckley.com.au/library/), [using this music](https://scottbuckley.com.au/library/using-this-music)) | CC-BY 4.0 **plus extra terms** | **Caveat → avoid unless he agrees in writing** | He writes: *"My music cannot be resold in isolation, or redistributed/reuploaded to music streaming platforms, and **must be synchronised with other media**."* Raw MP3s in a public repo are arguably standalone redistribution. The orchestral and piano music is excellent (e.g. *Amberlight*, *In This Moment*). Email him for permission before using. |
| **Clement Panchout – Yet Another Free Music Pack** ([itch](https://clement-panchout.itch.io/yet-another-free-music-pack)) | CC-BY 4.0 **plus** "reselling prohibited, AI training prohibited" | **Caveat** | The extra terms conflict with plain CC-BY. A public repo can't stop scrapers from using the files for AI training. 46 WAV tracks, mostly looping, including **"80s Zombies Movie"**, "Sweet 70s" and "Space Horror Exploration & Tense (ambient layers)". Use only after written confirmation that a public repo is fine. |
| **Eric Matyas – soundimage.org** ([attribution](https://soundimage.org/attribution-info/), [license](https://soundimage.org/sample-page/)) | Custom "Soundimage International Public License", modelled on CC-BY 4.0 | **Caveat** | **Finding:** the license text *does* allow "reproduce and Share the Licensed Material", so it does **not** forbid redistribution. But it is non-standard: it bans use in "obscene or pornographic" media, and the credit must appear *inside* the game ("Music by Eric Matyas www.soundimage.org"). Usable, but prefer CC0/CC-BY sources so the license audit stays simple. |
| **Freesound** ([FAQ](https://freesound.org/help/faq/)) | Per sound: CC0, CC-BY 4.0, CC-BY-NC 4.0, legacy Sampling+ | **CC0 / CC-BY only** | Better for SFX, radio static and field recordings than for finished music. Filter by license. |
| **Free Music Archive** ([FAQ](https://freemusicarchive.org/faq/)) | Per track | **Only CC0 / CC-BY tracks** | Most of the catalog is NC or ND. Check each track page. |
| **ccMixter / dig.ccMixter** | Per track: CC-BY 3.0 or CC-BY-NC (plus some SA) | **Caveat** | Only "Free for commercial use" (CC-BY) tracks qualify. Many are remixes whose samples carry their own licenses, and many have vocals. High verification effort. No picks from here. |
| **Ketsa** ([FMA](https://freemusicarchive.org/music/Ketsa/)) | Most of 300+ tracks are **CC BY-NC-ND 4.0**. One album, *[CC BY: Free To Use For Anything](https://freemusicarchive.org/music/Ketsa/cc-by-free-to-use-for-anything)* (70 tracks), is CC-BY 4.0 | **Mostly no; that one album only** | He also sells licenses through Tribe of Noise, so Content ID claims are possible. Use only that CC-BY album, and check each track's license badge. |
| **FreePD** ([freepd.com](https://freepd.com/)) | Was CC0 / public domain | **No longer available** | **The site shut down in 2025** ("After 17 years … we have officially taken the service offline"). Copies on archive.org or mirrors can't be traced back to a live license page, so treat them as provenance risk. |
| **Chosic** | Aggregator that re-hosts tracks under mixed licenses (CC-BY, CC-BY-SA, CC0, Pixabay-style) | **No as a source** | Use it only to discover tracks, then verify and download at the original page. (The site returned HTTP 403 to automated checks.) |
| **Pixabay Music** ([terms](https://pixabay.com/service/terms/)) | Pixabay Content License | **No** | **Confirmed:** "You cannot sell or distribute the Content … on a Standalone basis", where Standalone means "no creative effort has been applied … remains in substantially the same form". An unmodified MP3 in a public repo is exactly that, and creators have pushed back on GitHub redistribution. |
| **Mixkit** ([license](https://mixkit.co/license/)) | Mixkit Stock Music Free License | **No** | The music license **excludes video games** (and CDs/DVDs/broadcast) and forbids standalone redistribution. |
| **Zapsplat** | Zapsplat standard/free license | **No** | Files can't be redistributed standalone on any plan, and attribution to Zapsplat is required. |
| **Purple Planet** | Their own attribution license | **No** | "You cannot make their music available for download"; no remixing. |
| **YouTube Audio Library** | YouTube terms | **No** | Licensed only for use on YouTube. |
| **Itch "free" packs in general** | Varies | **Check each page** | Many "free" packs (Cody Munn, Void1, Ansimuz, HONEYDOG) give "free to use" wording with no license, or commercial-only terms. Use only packs that name CC0 or CC-BY explicitly. |

---

## 3. Recommendations per slot

Legend: **Loop** = the author says it loops, or there is a loop mix · **Stems** = separate layers are provided · ⚠ = needs a check before committing. Kevin MacLeod pages use `https://incompetech.com/music/royalty-free/index.html?isrc=<ISRC>`; all his tracks are MP3, 320 kbps, CC-BY 4.0.

### L1 · Late morning, normal suburb (warm Americana: acoustic guitar, glockenspiel, light drums)

| Title | Artist | URL | License | Length | Format | Loop / stems | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Etirwer | Kistol | [OGA](https://opengameart.org/content/etirwer) | CC0 | ? | OGG | Loop (seamless) | Fingerpicked nylon guitar, calm. Works as an ambient base layer; too calm alone. |
| Town 3 – Sunshine Coast (JRPG Pack #2 Towns) | Juhani Junkala | [OGA](https://opengameart.org/content/jrpg-pack-2-towns) | CC0 | ? | ZIP (OGG/WAV) | Loop | Bright and idyllic, slightly game-y. ⚠ listen for genre fit |
| Music Loop Bundle (browse "upbeat") | Abstraction / Tallbeard | [itch](https://tallbeard.itch.io/music-loop-bundle) | CC0 | varies | OGG/WAV | Loop | The biggest CC0 pool; use the song browser to find acoustic tracks. |
| **Life of Riley** | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400054) | CC-BY 4.0 | 3:55 | MP3 | – | Glockenspiel, ukulele, guitar, percussion. Almost exactly the brief. |
| Carefree | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037) | CC-BY 4.0 | 3:25 | MP3 | – | Ukulele, guitar, marimba, glockenspiel. Playful. |
| Fireflies and Stardust | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600061) | CC-BY 4.0 | 4:15 | MP3 | – | "Rural americana": banjo, mandolin, guitars, light drums. |
| Fretless | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500074) | CC-BY 4.0 | 5:36 | MP3 | – | Guitar, ukulele, glockenspiel, music box. Uplifting. |

### L2 · Midday panic (same warmth plus tension strings and pulses)

| Title | Artist | URL | License | Length | Format | Loop / stems | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 80s Mysterywave music | DesertDev | [OGA](https://opengameart.org/content/80s-mysterywave-music) | CC0 | ? | WAV stems + MP3 | **Stems** (guitar melody, wobbling lead, drum machine, bass, piano) | One of the few CC0 stem sets. Bring layers in as panic grows. Also fits L4. |
| Action 2 – Army Approaching (JRPG Pack #5) | Juhani Junkala | [OGA](https://opengameart.org/content/jrpg-pack-5-action) | CC0 | ? | ZIP | Loop | Building tension. |
| **I Can Feel it Coming** | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1700085) | CC-BY 4.0 | 3:35 | MP3 | – | Guitar, percussion and synth, "tension filler". Keeps the guitar warmth. |
| Prelude and Action | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100887) | CC-BY 4.0 | 1:39 | MP3 | – | Strings and percussion building into action. |
| Constancy Part One | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100775) | CC-BY 4.0 | 1:05 | MP3 | – | Fast string ostinato with glockenspiel accents. Good as a pulse layer. |

### L3 · Afternoon car chases (driving synth bass, energetic)

| Title | Artist | URL | License | Length | Format | Loop / stems | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Action Man | Indieteur | [OGA](https://opengameart.org/node/90765) | CC0 | ? | MP3 + WAV | ? | Tagged "chase, car, guns". |
| Synthwave House Loop | Fupi | [OGA](https://opengameart.org/content/synthwave-house-loop) | CC0 | short | OGG + WAV | Loop | 114 BPM. |
| Sunny City (lap + climax versions) | MintoDog | [OGA](https://opengameart.org/content/sunny-city) | CC0 | ? | MP3 + OGG | Loop; **two tempos** (120 and 135 BPM) | Sax and piano racing music. The climax version supports horizontal switching. Also bright enough for the end of L1. |
| **Go Cart – Loop Mix** | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300008) | CC-BY 4.0 | 1:24 | MP3 | **Seamless loop mix** | "Clean piece with a nasty edge", synths. |
| Eighties Action | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100243) | CC-BY 4.0 | 2:51 | MP3 | – | "Super 1980's-style synth action". |
| Voltaic / Ouroboros | Kevin MacLeod | [Voltaic](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600056) · [Ouroboros](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400007) | CC-BY 4.0 | 3:16 / 2:42 | MP3 | Ouroboros "loopable" | 80s gallop bass. |
| Free Music Loop Bundle (electro / DnB boxes) | Of Far Different Nature | [itch](https://fardifferent.itch.io/loops) | CC-BY 4.0 | varies | OGG/WAV | Loop, some `[v2]`/`[short]` variants | Use OGG for gapless loops. |

### L4 · Golden hour, the town breaking down (melancholic, heavy synth, distorted guitar)

| Title | Artist | URL | License | Length | Format | Loop / stems | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 80s Mysterywave music | DesertDev | [OGA](https://opengameart.org/content/80s-mysterywave-music) | CC0 | ? | WAV stems | **Stems** | A darker mix (bass + piano + wobble lead) suits golden hour. Reuse with L2 to tie the levels together. |
| Unreleased Zombie Soundtrack | Emma M. Andersson (Emma_MA) | [OGA](https://opengameart.org/content/unreleased-zombie-soundtrack) | CC-BY 3.0 | various | WAV | **Intro + loop pairs** (11 tracks) | Synth-metal written **for a zombie game**. The best thematic match for L4 and L5. `gfz_hell` is MP3 only and does not loop. |
| Heavy Metal Riffs – Monolith | Tri-Tachyon | [OGA](https://opengameart.org/content/heavy-metal-riffs-monolith) | CC-BY 4.0 | ? | MP3 | ? | Distorted guitar, bass, drums. |
| Soundscape – Dust (ambient guitar) | Tri-Tachyon | [OGA](https://opengameart.org/content/soundscape-dust-ambient-guitar) | CC-BY 4.0 | ? | MP3 | – | Melancholic ambient guitar for the calm moments. |
| **Lightless Dawn** | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100655) | CC-BY 4.0 | 6:20 | MP3 | – | Dark synths, strings and bells, somber. |
| Take the Lead | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100695) | CC-BY 4.0 | 3:45 | MP3 | – | Guitars plus synths, "stressful, strained scene". |

### L5 · Dusk, big defense waves (big, percussive action)

| Title | Artist | URL | License | Length | Format | Loop / stems | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| JRPG Pack #5 Action (Encounter With The Witches / Army Approaching / Preparing For Battle) | Juhani Junkala | [OGA](https://opengameart.org/content/jrpg-pack-5-action) | CC0 | ? | ZIP | Loop | Orchestral-synth battle loops. |
| CC0 – Cinematic Music (e.g. "Determined Pursuit" epic loop, "Battle Theme A") | collection by josepharaoh99 | [OGA](https://opengameart.org/content/cc0-cinematic-music) | CC0 ⚠ | varies | varies | some loops | ⚠ This is a collection; open each item and confirm its license and author. |
| Unreleased Zombie Soundtrack (heavier tracks) | Emma_MA | [OGA](https://opengameart.org/content/unreleased-zombie-soundtrack) | CC-BY 3.0 | various | WAV | Intro + loop | Use the same composer for L4 and L5 to keep them coherent. |
| **Undaunted** | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400025) | CC-BY 4.0 | 3:33 | MP3 | – | "Big big drums", piano, synths. |
| The Escalation | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400041) | CC-BY 4.0 | 5:27 | MP3 | – | A long "Bolero-style" build. Can be mapped to wave progress. |
| Zombie Chase | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100005) | CC-BY 4.0 | 2:23 | MP3 | – | Percussion, piano, synth. Its theme is shared with *Zombie Hoodoo* (L6), which helps cohesion. |
| Big Drumming | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN2100000) | CC-BY 4.0 | 3:42 | MP3 | Works as a layer | Percussion only, "more of an ingredient". **A ready-made intensity layer** for vertical layering. |

### L6 · Night, burning town → dawn escape (dark and fragmented, then hopeful solo piano)

| Title | Artist | URL | License | Length | Format | Loop / stems | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Eerie Space Music (2 songs) | Potriel / Foozle | [itch](https://foozlecc.itch.io/eerie-space-music) | CC0 | ? | ZIP (449 MB) | **Stems** | Eerie and fragmented. One faster track fits action. "Space" flavour, so ⚠ check genre fit. |
| Title Screens (Beginnings Collection) | HoliznaCC0 | [OGA](https://opengameart.org/content/title-screens-beginnings-collection) | CC0 | varies | ZIP | – | Calm piano for **dawn**. |
| Something to Save | Komiku | [OGA](https://opengameart.org/content/something-to-save) | CC0 | ? | MP3 | – | Calm and tender. Dawn or credits. |
| **Oppressive Gloom** | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100885) | CC-BY 4.0 | 3:19 | MP3 | "Loops pretty well, trim the end" | Dark march for the burning town. |
| Bent and Broken | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200087) | CC-BY 4.0 | 4:28 | MP3 | – | Modified piano, "more soundscape than music… zombie, horror". |
| Zombie Hoodoo | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100004) | CC-BY 4.0 | 1:27 | MP3 | – | Sparse piano over dark atmosphere. Shares a theme with *Zombie Chase*. |
| **Promises to Keep** (dawn) | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200004) | CC-BY 4.0 | 5:04 | MP3 | – | Solo piano, "a little hopeful, a little sorrowful". The dawn reprise. |
| Danse Morialta (dawn alt) | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200026) | CC-BY 4.0 | 3:56 | MP3 | – | Solo piano, somber and uplifting. |
| Last Hope | onemansymphony | [OGA](https://opengameart.org/content/last-hope) | CC-BY 4.0 | ? | MP3 | – | Bittersweet hopeful piano. |

### Menu / title (warm, slightly ominous)

| Title | Artist | URL | License | Length | Format | Loop / stems | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baguira / Boy / Sudo | Kounine | [itch](https://kounine.itch.io/bruno-simon) (also local in `folio-2025/static/sounds/musics/`) | CC0 | 2:35 / 2:43 / 2:34 | WAV + MP3 320k | – | Already on disk and already cleared. ⚠ Not yet auditioned for mood. |
| Title Screens (Beginnings Collection) | HoliznaCC0 | [OGA](https://opengameart.org/content/title-screens-beginnings-collection) | CC0 | varies | ZIP | – | Warm piano. Add an ominous low drone ourselves. |
| **Leaving Home** | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1900002) | CC-BY 4.0 | 8:10 | MP3 | – | Guitar, flute, zither and piano, tagged "Dark, Grooving, Somber". Warm instruments with a dark undertone, which is exactly the brief. ⚠ audition |
| Comfortable Mystery | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100287) | CC-BY 4.0 | 3:56 | MP3 | – | Solo vintage electric piano, "surreal". |

### Diegetic: diner jukebox (50s/60s)

CC0 options for authentic 50s rock'n'roll are almost non-existent. Kevin MacLeod is the practical choice.

| Title | Artist | URL | License | Length | Format | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Sock Hop** | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100495) | CC-BY 4.0 | 2:47 | MP3 | "1950's era simple rock with tremolo lead guitar and vibraphone". |
| Cheery Monday | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1700065) | CC-BY 4.0 | 1:20 | MP3 | "Clappy 50's inspired simple fun track". |
| Surf Shimmy / Happy Bee – Surf | Kevin MacLeod | [Surf Shimmy](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1700018) · [Happy Bee – Surf](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300015) | CC-BY 4.0 | 2:03 / 5:09 | MP3 | Early-60s surf rock. |
| Spy Glass | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500058) | CC-BY 4.0 | 3:47 | MP3 | "Could be in the 1950s", cool jazz. Background for the diner interior. |
| Spaghetti Western | Spring Spring | [OGA](https://opengameart.org/content/spaghetti-western) | CC0 | short | OGG | Not 50s, but a CC0 retro-Americana option for a second jukebox slot. |

Tip: run the jukebox output through a band-limited "old speaker" filter in the Web Audio graph, so the songs sound diegetic.

### Diegetic: ice-cream truck jingle

| Title | Artist | URL | License | Length | Format | Loop / stems | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Ice Cream Truck Theme** | Cleyton Kauffman | [OGA](https://opengameart.org/content/ice-cream-truck-theme) | CC0 | short | MP3/OGG/WAV | **Loop + stems** | Written for exactly this request. 8-bit sound, "inspired by Pokémon". ⚠ Listen to make sure it does not quote a Pokémon melody. |
| Melodie Victoria | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100819) | CC-BY 4.0 | 4:01 | MP3 | – | Ragtime music box. Very ice-cream-truck in timbre. |
| Music Box Theme | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100417) | CC-BY 4.0 | 1:04 | MP3 | – | Simple high glockenspiel/celesta theme. |
| **DIY: "The Entertainer" (Joplin, 1902)** | us | – | Our own rendering (CC0/MIT) | ~0:20 loop | OGG | Loop | The composition is public domain. Render it with a music-box synth in a few lines of Tone.js or offline. This is the cleanest licensing option. |

Avoid **"Turkey in the Straw"**: its racist minstrel-era lyric version is why Good Humor commissioned a replacement jingle in 2020. Also avoid **"Music Box Dancer"** (Frank Mills, 1974, under copyright) and the **Mister Softee** jingle (copyright and trademark). Field recordings of real trucks on Freesound usually contain one of these.

### Diegetic: car-radio songs (several genres)

| Genre | Title | Artist | URL | License | Length | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Funk | Funk (Collection) | HoliznaCC0 | [OGA](https://opengameart.org/content/funk-collection) | CC0 | ZIP 86 MB | Several tracks. |
| Lo-fi / chill | We Drove All Night (5 tracks) | HoliznaCC0 | [OGA](https://opengameart.org/content/we-drove-all-night-game-soundtrack) | CC0 | WAV | The title fits a car radio. |
| Disco / dance | Helice Awesome Dance Adventure !! (album) | Komiku | [FMA](https://freemusicarchive.org/music/Komiku/) / loyaltyfreakmusic.com | CC0 | album | ⚠ confirm the CC0 badge on the album page. |
| Electro / house | ESCAPE (11 tracks) | Of Far Different Nature | [itch](https://fardifferent.itch.io/escape) | CC-BY 4.0 | album | Modern "late-night FM" station. |
| 80s synth-pop | Newer Wave | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN2000024) | CC-BY 4.0 | 2:55 | 80s gallop synth-pop. |
| Country | Guts and Bourbon / Bama Country | Kevin MacLeod | [Guts and Bourbon](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400032) · [Bama Country](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100359) | CC-BY 4.0 | 3:29 / 3:32 | Upbeat rural country. |
| Rock | Exhilarate / Gearhead | Kevin MacLeod | [Exhilarate](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300028) · [Gearhead](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100221) | CC-BY 4.0 | 2:25 / 2:19 | Guitar rock. |
| Jazz / "easy listening" | Local Forecast – Elevator / Hep Cats | Kevin MacLeod | [Elevator](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300012) · [Hep Cats](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500022) | CC-BY 4.0 | 3:09 / 4:11 | Elevator is pre-mixed through "crappy elevator speakers". Good for stores too. |

### Credits

| Title | Artist | URL | License | Length | Notes |
| --- | --- | --- | --- | --- | --- |
| Boy (or another Kounine track) | Kounine | [itch](https://kounine.itch.io/bruno-simon) | CC0 | 2:43 | Already in hand. ⚠ audition |
| Something to Save | Komiku | [OGA](https://opengameart.org/content/something-to-save) | CC0 | ? | Tender. |
| **Americana** | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200092) | CC-BY 4.0 | 3:22 | Starts on the plains, builds to grand brass. Uplifting "we made it". |
| Fireflies and Stardust | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600061) | CC-BY 4.0 | 4:15 | Brings back the L1 Americana palette for closure. |

### Stingers (victory, twist/dread, death)

| Use | Title | Artist | URL | License | Length | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Victory / UI | Music Jingles (85) | Kenney | [kenney.nl](https://kenney.nl/assets/music-jingles) | CC0 | 1–3 s each | Pizzicato, sax, steel drum and orchestral-hit sets. |
| Victory | Win Jingle (+ MIDI) | Fupi | [OGA](https://opengameart.org/content/win-jingle) | CC0 | short | Comes with **MIDI**, so we can re-voice it in our own instruments. |
| Victory (big) | Discovery Hit / Hero Theme | Kevin MacLeod | [Discovery Hit](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300023) · [Hero Theme](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100491) | CC-BY 4.0 | 0:15 / 0:18 | Epic three-note sting; "short powerful theme with a bit of hope". |
| Twist / dread | Der Kleber Sting | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100612) | CC-BY 4.0 | 0:08 | "Standard dun dun DUUUUN!" |
| Twist / dread | An Upsetting Theme / Trouble | Kevin MacLeod | [An Upsetting Theme](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100333) · [Trouble](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100032) | CC-BY 4.0 | 1:03 / 0:17 | Low strings with glockenspiel; diminished-chord tremolo. |
| Death | Sad Game Over | Emma_MA | [OGA](https://opengameart.org/content/sad-game-over) | CC0 | short | Electric piano, "emotionally impactful". |
| Death | Greta Sting | Kevin MacLeod | [incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100530) | CC-BY 4.0 | 0:18 | Somber string sting. |
| (avoid) | Game Over Jingles | Tine Schenck | [OGA](https://opengameart.org/content/game-over-jingles) | **CC-BY-SA 4.0** | – | "Maybe" list only, because of ShareAlike. |

### "Maybe" list (ShareAlike or CC-BY with extra terms; needs a decision)

| Title / pack | Artist | License | Why it's tempting | Why it's on hold |
| --- | --- | --- | --- | --- |
| Yet Another Free Music Pack (incl. **80s Zombies Movie**, Sweet 70s, Space Horror *ambient layers*) | Clement Panchout | CC-BY 4.0 + "no reselling, no AI training" | A near-perfect thematic match, with layered horror ambience. | Extra terms. Email him for written OK. |
| Scott Buckley library (*Amberlight*, *In This Moment*, *Home Was You*) | Scott Buckley | CC-BY 4.0 + "must be synchronised with other media" | Best-in-class orchestral and piano for L6 dawn and credits. | Raw-file redistribution is arguably excluded. Email him for written OK. |
| Happy/melancholic synth + bells – Adaptive layers pack | 3xBlast | CC-BY 3.0 (OK) | **Real adaptive layers** (25 s loop variants). | Licensing is fine; genre fit (dating-sim) is weak. |
| Game Over Jingles | Tine Schenck | CC-BY-SA 4.0 | Varied jingles. | ShareAlike. |
| Lasso Lady cover | Haley Halcyon | CC-BY 4.0 (the original NES version is CC0) | Western flavour. | Licensing is fine but the style is chiptune. Listed for completeness. |

---

## 4. Recommended starter set (download first)

| Slot | Pick | License | Why |
| --- | --- | --- | --- |
| L1 | **Life of Riley** – Kevin MacLeod | CC-BY 4.0 | Glockenspiel + ukulele + guitar + light percussion, exactly the brief. |
| L2 | **80s Mysterywave music** (stems) – DesertDev | CC0 | Stems allow a tension layer to be added on the fly. Back-up: *I Can Feel it Coming* (MacLeod). |
| L3 | **Go Cart – Loop Mix** – Kevin MacLeod | CC-BY 4.0 | Seamless driving synth loop. Back-up: *Sunny City* (CC0, two tempos). |
| L4 | **Unreleased Zombie Soundtrack** (one intro/loop pair) – Emma_MA | CC-BY 3.0 | Synth-metal made for a zombie game, with intro and loop provided. |
| L5 | **Undaunted** + **Big Drumming** (percussion layer) – Kevin MacLeod | CC-BY 4.0 | Big drums, and a separate drum layer for intensity. |
| L6 night → dawn | **Oppressive Gloom** → **Promises to Keep** – Kevin MacLeod | CC-BY 4.0 | Loopable dark march, then a hopeful solo piano reprise. |
| Menu | **Kounine – Bruno Simon pack** (pick 1 of 3) | CC0 | Already on disk and cleared. If the mood doesn't fit, use *Leaving Home* (MacLeod). |
| Jukebox | **Sock Hop** – Kevin MacLeod | CC-BY 4.0 | 1950s tremolo-guitar rock. |
| Ice-cream truck | **Ice Cream Truck Theme** – Cleyton Kauffman (or our own *The Entertainer* render) | CC0 | Purpose-made, loops, includes stems. |
| Radio | **HoliznaCC0 Funk Collection** + **We Drove All Night** + MacLeod *Guts and Bourbon* / *Newer Wave* | CC0 / CC-BY 4.0 | Four genres with almost no attribution burden. |
| Credits | **Americana** – Kevin MacLeod | CC-BY 4.0 | Uplifting build that echoes L1. |
| Stingers | **Kenney Music Jingles** + **Sad Game Over** (Emma_MA) + **Der Kleber Sting** (MacLeod) | CC0 / CC0 / CC-BY 4.0 | Covers victory, death and twist. |

Attribution burden of the starter set: Kevin MacLeod (about 9 tracks, one credit block listing the titles) and Emma M. Andersson. Everything else is CC0.

---

## 5. Open risks

1. **Kevin MacLeod Content ID.** His catalog is pre-registered with YouTube Content ID. Let's-plays and trailers using the game audio may be claimed, and creators must dispute with the credit line. Mitigation: show the credit line in-game and in the press kit, and prefer CC0 for the most-heard tracks (L1, menu) if streamer-friendliness matters.
2. **Few real stems.** Only *80s Mysterywave*, *Eerie Space Music*, *Ice Cream Truck Theme* and 3xBlast's pack ship stems. Emma_MA ships intro/loop pairs; MacLeod ships nothing. For vertical layering we may need to (a) add our own layers (e.g. *Big Drumming*, synthesized pulses or risers) on top of a base track at matched BPM, or (b) split tracks with a source-separation tool. Both are allowed for CC0 and CC-BY, but CC-BY edits must be marked "modified" in the notices. Long term, commissioning a CC0 or CC-BY score with stems is the cleanest way to get a coherent adaptive soundtrack.
3. **Stylistic coherence.** The picks come from about 8 composers. The plan above uses MacLeod for the main levels and keeps one composer per level pair (Emma_MA for L4/L5, MacLeod for L5/L6). Audition everything together before committing.
4. **Unverified details.** Lengths marked "?" and loop claims marked ⚠ were not measured, because nothing was downloaded. The Kounine tracks, *Leaving Home*, *Ice Cream Truck Theme* (possible Pokémon quotation) and the *CC0 – Cinematic Music* collection items need an audition and a per-item license check.
5. **License drift.** Pages change: FreePD has already disappeared. Archive each license page when downloading, and record the SHA-256 of each committed file in `LICENSES.md`.
6. **"CC-BY plus" authors.** Scott Buckley and Clement Panchout add terms that conflict with plain CC-BY. Do not use them without written permission stored in `docs/licenses/`.
7. **Repo size.** WAV stems are 50 MB each (Mysterywave). Commit only transcoded OGG/Opus (and AAC/MP3 for Safari fallback) at game bitrates. Keep masters out of git, or use Git LFS. Transcoding counts as a modification, so note it for CC-BY files.
8. **Diegetic public-domain melodies.** A public-domain composition does not make a recording public domain. Use either a CC0/CC-BY recording or our own rendering. Avoid trademarked or copyrighted truck jingles (Mister Softee, Music Box Dancer) and *Turkey in the Straw*.
