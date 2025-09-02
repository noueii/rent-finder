# Unmapped Realestate.co.jp Stations Summary

## Overview
Out of 965 stations from realestate.co.jp, **419 stations (43.4%)** are not found in the CLI graph.

## Categories of Unmapped Stations

### 1. **Shinkansen Stations** (9 stations)
High-speed rail lines not used for daily commuting:
- Joetsu, Yamagata, Akita, Hokuriku, Tohoku Shinkansen
- Only major stations: Tokyo, Ueno

### 2. **Entire Lines Missing from CLI Tool** (89 stations)
These train lines don't exist in the CLI tool at all:

#### Major Missing Lines:
- **Toden Arakawa Line** (29 stations) - Tokyo's only remaining tram line
- **JR Chūō-Sōbu Line** (21 stations) - Different from Chūō Line (Rapid)
- **Keiō Sagamihara Line** (9 stations)
- **Seibu Tamako Line** (7 stations)
- **Seibu Tamagawa Line** (6 stations)

#### Special Purpose Lines:
- **JR Narita Express** (4 stations) - Airport express
- **Keikyū Airport Line** (6 stations) - Haneda airport access
- **Narita Sky Access** (4 stations) - Narita airport access

### 3. **Missing Stations on Existing Lines** (312 stations)
These are the most problematic - stations that should exist but are missing:

#### Top Lines with Missing Stations:
1. **Toei Ōedo Line** - 26 missing stations
2. **JR Keihin-Tōhoku Line** - 17 missing stations
3. **JR Chūō Line (Rapid)** - 16 missing stations
4. **Tokyo Metro Marunouchi** - 14 missing stations
5. **Tokyo Metro Chiyoda Line** - 11 missing stations
6. **Tokyo Metro Fukutoshin Line** - 11 missing stations

## Key Findings

### Major Hub Stations Appearing Multiple Times:
These important stations appear on multiple lines but couldn't be mapped:
- **Tokyo** - 17 occurrences
- **Ueno** - 12 occurrences
- **Shinjuku** - 12 occurrences
- **Shibuya** - 10 occurrences
- **Ikebukuro** - 7 occurrences

This suggests there might be issues with:
1. Station name formatting differences
2. Multiple station entries for the same physical location
3. Different station IDs for different lines at the same station

## Recommendations

1. **Priority Fixes**:
   - Investigate why major stations (Tokyo, Shinjuku, etc.) aren't matching
   - These are likely formatting or ID structure issues

2. **Line Additions**:
   - Consider adding missing lines like Toden Arakawa Line
   - Add JR Chūō-Sōbu Line as separate from Chūō Line (Rapid)

3. **Station Coverage**:
   - Review why so many stations are missing from existing lines
   - May need to update the CLI tool's station data

4. **Special Handling**:
   - Airport lines could be excluded from commute calculations
   - Shinkansen stations should be filtered out