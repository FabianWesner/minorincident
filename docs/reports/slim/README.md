# Slim build

Baseline: `53949e814`. Every q249 human figure is included below; children and the intentionally bulky Alphas/brute/bloated are measured and identified for retention. Ratios are invariant under q257’s uniform delivery height fit.

Measurements use visible indexed bind-pose geometry; hidden stump caps, eyes and hand props are excluded. Each limb radius is the 95th percentile perpendicular distance from its own bone axis, in the middle 40–60% of that segment (thigh: leg→shin, calf: shin→foot). Torso width/depth are the 2–98% envelope in the lower torso band 20–40% from pelvis to shoulder, excluding limb surfaces assigned to the nearest arm capsule and the courier backpack region. Limb radii retain the authored joint ownership; the body surface split only prevents a folded sleeve or backpack from setting torso thickness. Shoes are measured separately by foot/toe ownership; the larger 2–98% length and height is reported. This avoids combining both feet, flared hems or a backpack with body thickness.

| Figure | Policy | Upper arm r/H | Forearm r/H | Thigh r/H | Calf r/H | Torso W/H | Torso D/H | Shoe L/H | Shoe H/H |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| char.courier-female | reference | 0.0377 | 0.0434 | 0.0712 | 0.0369 | 0.1669 | 0.1561 | 0.1598 | 0.1178 |
| char.survivor-male | adult | 0.0559 | 0.0641 | 0.1051 | 0.0589 | 0.2550 | 0.1821 | 0.1590 | 0.1540 |
| char.survivor-female | adult | 0.0556 | 0.0401 | 0.0778 | 0.0469 | 0.2631 | 0.1623 | 0.2040 | 0.1748 |
| inf.common-worker | adult | 0.1151 | 0.1047 | 0.1109 | 0.1165 | 0.2376 | 0.2388 | 0.2840 | 0.1037 |
| inf.alpha | retained intentional bulk | 0.2713 | 0.1692 | 0.1607 | 0.1871 | 0.3183 | 0.3252 | 0.3085 | 0.2000 |
| inf.alpha-worker | retained intentional bulk | 0.1827 | 0.1830 | 0.1269 | 0.1228 | 0.3085 | 0.2844 | 0.2464 | 0.1611 |
| inf.alpha-hoodie | retained intentional bulk | 0.2603 | 0.1623 | 0.1542 | 0.1795 | 0.3054 | 0.3121 | 0.2960 | 0.1919 |
| inf.alpha-fire | retained intentional bulk | 0.2626 | 0.1341 | 0.1556 | 0.1811 | 0.3082 | 0.3149 | 0.2987 | 0.1936 |
| inf.alpha-suit | retained intentional bulk | 0.2713 | 0.1692 | 0.1607 | 0.1871 | 0.3183 | 0.3252 | 0.3085 | 0.2000 |
| inf.jogger | adult | 0.1137 | 0.0391 | 0.1141 | 0.0618 | 0.3056 | 0.2316 | 0.3289 | 0.1485 |
| inf.baseball-cap | adult | 0.0588 | 0.0373 | 0.0901 | 0.0460 | 0.2556 | 0.2438 | 0.2491 | 0.1976 |
| inf.suburban-mom | adult | 0.1213 | 0.2151 | 0.1907 | 0.1176 | 0.4759 | 0.1748 | 0.2691 | 0.1382 |
| inf.delivery-driver | adult | 0.0666 | 0.0253 | 0.1261 | 0.0734 | 0.3154 | 0.2242 | 0.2763 | 0.1473 |
| inf.skater | adult | 0.0871 | 0.0514 | 0.1033 | 0.0838 | 0.3461 | 0.3245 | 0.2879 | 0.1936 |
| inf.college-student | adult | 0.0553 | 0.0263 | 0.0565 | 0.0533 | 0.2577 | 0.1550 | 0.1668 | 0.1019 |
| inf.bbq-dad | adult | 0.2023 | 0.1388 | 0.2641 | 0.1938 | 0.5578 | 0.4057 | 0.2923 | 0.1317 |
| inf.cashier | adult | 0.0897 | 0.0450 | 0.1146 | 0.0864 | 0.2924 | 0.2829 | 0.2821 | 0.1256 |
| inf.bathrobe-neighbor | adult | 0.1812 | 0.0476 | 0.3636 | 0.1294 | 0.4006 | 0.3492 | 0.2877 | 0.1373 |
| inf.construction-worker | adult | 0.0774 | 0.0483 | 0.0844 | 0.0839 | 0.3581 | 0.3000 | 0.2437 | 0.1842 |
| inf.crawler | adult | 0.2030 | 0.1604 | 0.3330 | 0.1149 | 0.7727 | 0.8532 | n/a* | n/a* |
| inf.riot-cop | adult | 0.2069 | 0.3675 | 0.1983 | 0.2065 | 0.4933 | 0.3985 | 0.3110 | 0.0982 |
| inf.hazmat | adult | 0.1351 | 0.1312 | 0.1657 | 0.1183 | 0.3503 | 0.4105 | 0.3019 | 0.2117 |
| inf.firefighter | adult | 0.1820 | 0.1300 | 0.1475 | 0.1204 | 0.4233 | 0.3013 | 0.2617 | 0.1838 |
| inf.bloated | retained intentional bulk | 0.0966 | 0.0753 | 0.1122 | 0.0757 | 0.4438 | 0.5872 | 0.2090 | 0.0813 |
| inf.screamer | adult | 0.0796 | 0.0509 | 0.0935 | 0.0589 | 0.2864 | 0.2438 | 0.2002 | 0.1446 |
| inf.sprinter | adult | 0.0747 | 0.0467 | 0.0970 | 0.0607 | 0.2594 | 0.2560 | 0.2300 | 0.1788 |
| inf.armored-football | adult | 0.1211 | 0.0646 | 0.0926 | 0.0631 | 0.2933 | 0.2566 | 0.2026 | 0.1437 |
| inf.butcher | adult | 0.1006 | 0.0783 | 0.1179 | 0.0677 | 0.3394 | 0.3816 | 0.2336 | 0.2088 |
| inf.nurse | adult | 0.0979 | 0.0828 | 0.1386 | 0.0798 | 0.3378 | 0.2586 | 0.3128 | 0.1404 |
| inf.brute | retained intentional bulk | 0.1240 | 0.1013 | 0.1065 | 0.0879 | 0.3536 | 0.3392 | 0.1969 | 0.1195 |
| npc.civilian-adult-m | adult | 0.0413 | 0.0617 | 0.0806 | 0.0964 | 0.2008 | 0.1342 | 0.1932 | 0.1372 |
| npc.civilian-adult-f | adult | 0.0732 | 0.0864 | 0.1121 | 0.0772 | 0.3740 | 0.1944 | 0.2486 | 0.1271 |
| npc.civilian-kid | child | 0.0822 | 0.0935 | 0.1178 | 0.1143 | 0.3165 | 0.3009 | 0.2362 | 0.1331 |
| npc.civilian-elderly | adult | 0.1256 | 0.0941 | 0.0947 | 0.0973 | 0.3121 | 0.2027 | 0.2210 | 0.1176 |
| npc.patient-zero-courier | adult | 0.0665 | 0.0391 | 0.0911 | 0.0568 | 0.2834 | 0.3756 | 0.1718 | 0.1183 |
| npc.brother | child | 0.0572 | 0.0565 | 0.0911 | 0.0433 | 0.2201 | 0.3634 | 0.1606 | 0.1171 |
| npc.mrs-alvarez | adult | 0.0244 | 0.0619 | 0.0672 | 0.0632 | 0.2593 | 0.3371 | 0.1850 | 0.1281 |
| npc.police-officer | adult | 0.0796 | 0.0895 | 0.1202 | 0.0791 | 0.2779 | 0.2463 | 0.2401 | 0.1124 |
| npc.paramedic | adult | 0.0569 | 0.0307 | 0.1021 | 0.0640 | 0.2382 | 0.2825 | 0.1567 | 0.1234 |
| npc.firefighter-alive | adult | 0.0953 | 0.1178 | 0.1205 | 0.1228 | 0.2828 | 0.2840 | 0.2109 | 0.0899 |
| npc.national-guard | adult | 0.0648 | 0.0864 | 0.0877 | 0.0932 | 0.2748 | 0.3826 | 0.2077 | 0.1192 |
| npc.survivor-group / survivor01_root | adult | 0.0511 | 0.0301 | 0.0734 | 0.0538 | 0.2252 | 0.2174 | 0.1598 | 0.1092 |
| npc.survivor-group / survivor02_root | adult | 0.0511 | 0.0301 | 0.0541 | 0.0538 | 0.1958 | 0.2163 | 0.1597 | 0.1092 |
| npc.survivor-group / survivor03_root | adult | 0.0512 | 0.0302 | 0.0745 | 0.0540 | 0.2107 | 0.2143 | 0.1602 | 0.1096 |
| npc.survivor-group / survivor04_root | adult | 0.0511 | 0.0301 | 0.0541 | 0.0538 | 0.2040 | 0.2224 | 0.1598 | 0.1098 |
| npc.helicopter-pilot | adult | 0.0617 | 0.0446 | 0.0579 | 0.0584 | 0.2679 | 0.2599 | 0.1725 | 0.1235 |
| npc.civilian-man-a | adult | 0.0413 | 0.0617 | 0.0806 | 0.0964 | 0.2008 | 0.1342 | 0.1932 | 0.1372 |
| npc.civilian-man-b | adult | 0.0812 | 0.1176 | 0.0791 | 0.0985 | 0.3053 | 0.2136 | 0.2140 | 0.1106 |
| npc.civilian-woman-a | adult | 0.0732 | 0.0864 | 0.1121 | 0.0772 | 0.3740 | 0.1944 | 0.2486 | 0.1271 |
| npc.civilian-woman-b | adult | 0.0661 | 0.0623 | 0.0904 | 0.0797 | 0.2243 | 0.2322 | 0.2145 | 0.0978 |
| inf.teen-skater | adult | 0.0765 | 0.0467 | 0.0859 | 0.0835 | 0.3142 | 0.2885 | 0.2364 | 0.1698 |
| char.courier-male | adult | 0.0564 | 0.0511 | 0.0700 | 0.0707 | 0.2364 | 0.1759 | 0.2254 | 0.1472 |
| npc.lab-tech-a | adult | 0.1299 | 0.1004 | 0.1092 | 0.1031 | 0.3806 | 0.2006 | 0.2409 | 0.1362 |
| npc.lab-tech-b | adult | 0.1335 | 0.0850 | 0.1077 | 0.1069 | 0.4059 | 0.2160 | 0.2840 | 0.1478 |
| npc.lab-guard | adult | 0.1480 | 0.1468 | 0.1794 | 0.1216 | 0.4912 | 0.3371 | 0.2830 | 0.1804 |
| npc.depot-clerk | adult | 0.0738 | 0.0745 | 0.1372 | 0.1172 | 0.3348 | 0.1861 | 0.2160 | 0.1683 |
| npc.dale.aftermath | adult | 0.0735 | 0.1130 | 0.0916 | 0.1112 | 0.2019 | 0.1793 | 0.2021 | 0.1145 |
| npc.rosa.aftermath | adult | 0.0732 | 0.0663 | 0.1072 | 0.1073 | 0.2451 | 0.1645 | 0.2086 | 0.1242 |
| npc.mr-okafor.aftermath | adult | 0.1378 | 0.0894 | 0.1168 | 0.0881 | 0.2579 | 0.1849 | 0.2156 | 0.2142 |
| npc.mia.aftermath | adult | 0.1773 | 0.1293 | 0.0955 | 0.1040 | 0.2891 | 0.3525 | 0.3651 | 0.1744 |
| npc.sam.aftermath | adult | 0.1336 | 0.0959 | 0.1721 | 0.1172 | 0.3177 | 0.3076 | 0.1951 | 0.1170 |
| npc.civilian-man-a.aftermath | adult | 0.0667 | 0.0618 | 0.0823 | 0.0965 | 0.2011 | 0.1344 | 0.1926 | 0.1307 |
| npc.civilian-man-b.aftermath | adult | 0.0780 | 0.0941 | 0.0929 | 0.0873 | 0.2500 | 0.2160 | 0.2116 | 0.0997 |
| npc.civilian-woman-b.aftermath | adult | 0.0684 | 0.0645 | 0.0936 | 0.0825 | 0.2320 | 0.2403 | 0.2220 | 0.1012 |
| npc.marcus.aftermath | adult | 0.0636 | 0.0590 | 0.0801 | 0.0952 | 0.1970 | 0.1327 | 0.1931 | 0.1283 |
| npc.shelter-survivor.bandaged | adult | 0.0667 | 0.0618 | 0.0823 | 0.0965 | 0.2011 | 0.1344 | 0.1926 | 0.1307 |
| npc.shelter-survivor.lying | adult | 0.0667 | 0.0618 | 0.0823 | 0.0965 | 0.2011 | 0.1344 | 0.1926 | 0.1307 |
| npc.shelter-survivor.sitting | adult | 0.0667 | 0.0618 | 0.0823 | 0.0965 | 0.2011 | 0.1344 | 0.1926 | 0.1307 |
| inf.mega-alpha | retained intentional bulk | 0.2268 | 0.2592 | 0.1438 | 0.1378 | 0.4037 | 0.2769 | 0.3057 | 0.1982 |
| inf.mega-alpha-ashen | retained intentional bulk | 0.2268 | 0.2592 | 0.1438 | 0.1378 | 0.4037 | 0.2769 | 0.3057 | 0.2002 |
| inf.mega-alpha-ember | retained intentional bulk | 0.2182 | 0.2780 | 0.1484 | 0.2000 | 0.3838 | 0.2750 | 0.3057 | 0.1968 |

* n/a: no visible geometry for this anatomical part. Sparse bone ownership uses the nearest same-side visible cross-section; exact fallbacks are identified per figure in JSON.

