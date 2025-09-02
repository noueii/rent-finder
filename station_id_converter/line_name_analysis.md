# Line Name Analysis: CLI Tool vs Realestate.co.jp

## Summary
- **CLI Tool**: 70 line files (with some duplicates)
- **Realestate.co.jp**: 88 train lines
- **Key Differences**: Naming conventions, additional lines, and categorization

## Naming Convention Differences

### 1. JR Line Prefixes
**CLI Tool** uses underscores and no "JR" prefix for most lines:
- `Yamanote_Line` → **Realestate**: `JR Yamanote Line`
- `Keihin_Tohoku_Line` → **Realestate**: `JR Keihin-Tōhoku Line`
- `Saikyo_Line` → **Realestate**: `JR Saikyō Line`
- `Musashino_Line` → **Realestate**: `JR Musashino Line`
- `Nambu_Line` → **Realestate**: `JR Nambu Line`
- `Yokosuka_Line` → **Realestate**: `JR Yokosuka Line`
- `Yokohama_Line` → **Realestate**: `JR Yokohama Line`
- `Takasaki_Line` → **Realestate**: `JR Takasaki Line`
- `Keiyo_Line` → **Realestate**: `JR Keiyō Line`
- `Itsukaichi_Line` → **Realestate**: `JR Itsukaichi Line`
- `Hachiko_Line` → **Realestate**: `JR Hachikō Line (Hachiōji-Komagawa)`
- `Ome_Line` → **Realestate**: `JR Ōme Line`
- `Shonan_Shinjuku_Line` → **Realestate**: `JR Shōnan-Shinjuku Line`

### 2. Special Characters and Formatting
**CLI Tool** uses underscores and simplified names:
- `Chuo_Line__Rapid_` → **Realestate**: `JR Chūō Line (Rapid)`
- `Sobu_Line__Rapid_` → **Realestate**: `JR Sōbu Main Line`
- `Joban_Line__Rapid_Local_` → **Realestate**: `JR Jōban Line (Ueno-Toride)`
- `Tokaido_Line` → **Realestate**: `JR Tōkaidō Line (Tokyo-Atami)`

### 3. Metro/Subway Lines
**CLI Tool** format vs **Realestate** format:
- `Tokyo_Metro_Chiyoda` → `Tokyo Metro Chiyoda Line`
- `Tokyo_Metro_Ginza` → `Tokyo Metro Ginza Line`
- `Tokyo_Metro_Marunouchi` → `Tokyo Metro Marunouchi`
- `Tokyo_Metro_Hibiya` → `Tokyo Metro Hibiya Line`
- `Tokyo_Metro_Tozai` → `Tokyo Metro Tōzai Line`
- `Tokyo_Metro_Hanzomon` → `Tokyo Metro Hanzōmon`
- `Tokyo_Metro_Namboku` → `Tokyo Metro Namboku Line`
- `Tokyo_Metro_Yurakucho` → `Tokyo Metro Yūrakuchō Line`
- `Tokyo_Metro_Fukutoshin` → `Tokyo Metro Fukutoshin Line`

### 4. Toei Lines
- `Toei_Asakusa` → `Toei Asakusa Line`
- `Toei_Mita` → `Toei Mita Line`
- `Toei_Oedo` → `Toei Ōedo Line`
- `Toei_Shinjuku` → `Toei Shinjuku Line`

### 5. Private Railway Lines

#### Keio Lines:
- `Keio_Line` → `Keiō Line`
- `Keio_Inokashira_Line` → `Keiō Inokashira Line`
- `Keio_New` → `Keiō New Line`
- `Keio_Takao` → `Keiō Takao Line`
- `Keio_Dobutsuen` → `Keiō Dōbutsuen Line`

#### Tokyu Lines:
- `Tokyu_Toyoko_Line` → `Tōkyū Tōyoko Line`
- `Tokyu_Den_en_toshi_Line` → `Tōkyū Den-en-toshi Line`
- `Tokyu_Oimachi_Line` → `Tōkyū Ōimachi`
- `Tokyu_Ikegami_Line` → `Tōkyū Ikegami Line`
- `Tokyu_Meguro_Line` → `Tōkyū Meguro Line`
- `Tokyu_Setagaya_Line` → `Tōkyū Setagaya Line`
- `Tokyu_Tamagawa_Line` → `Tōkyū Tamagawa Line`

#### Tobu Lines:
- `Tobu_Tojo_Line` → `Tōbu Tōjō Line`
- `Tobu_Isesaki_Line__Skytree_Line_` → `Tōbu Isesaki Line`
- `Tobu_Kameido` → `Tōbu Kameido Line`
- `Tobu_Noda__Urban_Park_Line_` → Not found in Realestate (might be Tōbu Daishi Line?)

#### Seibu Lines:
- `Seibu_Ikebukuro_Line` → `Seibu Ikebukuro Line`
- `Seibu_Shinjuku_Line` → `Seibu Shinjuku Line`
- `Seibu_Kokubunji` → `Seibu Kokubunji Line`
- `Seibu_Haijima` → `Seibu Haijima Line`

#### Odakyu Lines:
- `Odakyu_Odawara_Line` → `Odakyū Line`
- `Odakyu_Tama_Line` → `Odakyū Tama Line`
- `Odakyu_Enoshima` → Not found in Realestate

#### Others:
- `Keikyu_Main_Line` → `Keikyū Main Line`
- `Keisei_Main_Line` → `Keisei Main Line`
- `Keisei_Oshiage_Line` → `Keisei Oshiage Line`
- `Sotetsu_Main` → Not found directly (might be `Sotetsu・JR chokutsu line`)

### 6. Lines Present in Realestate but NOT in CLI Tool:
1. **Shinkansen Lines** (High-speed rail):
   - Akita Shinkansen
   - Hokuriku Shinkansen
   - Joetsu Shinkansen
   - Tohoku Shinkansen
   - Tokaido Shinkansen
   - Yamagata Shinkansen

2. **Additional JR Lines**:
   - JR Chūō Line (Tōkyō-Shiojiri)
   - JR Chūō-Sōbu Line
   - JR Narita Express
   - JR Sōbu Main Line
   - Ueno-Tokyo Line

3. **Additional Private Lines**:
   - Hokusō Railway Hokusō Line
   - Keikyū Airport Line
   - Keiō Keibajō Line
   - Keiō Sagamihara Line
   - Keisei Kanamachi Line
   - Narita Sky Access
   - Saitama Rapid Railway Line
   - Seibu Seibu-en Line
   - Seibu Tamagawa Line
   - Seibu Tamako Line
   - Seibu Toshima Line
   - Seibu Yamaguchi Line
   - Seibu Yurakucho Line
   - Tōbu Daishi Line
   - Toden Arakawa Line
   - Tokyo Metro Yūrakuchō New Line

### 7. Lines Present in CLI Tool but NOT clearly mapped in Realestate:
1. `Negishi_Line` (might be part of JR Keihin-Tōhoku Line)
2. `Kawagoe_Line` (JR line not listed separately)
3. `Odakyu_Enoshima` (Enoshima line not listed)
4. `Tobu_Noda__Urban_Park_Line_` (Urban Park Line not found)
5. `Yokohama_City_Subway_Blue` (Not in Tokyo prefecture list)
6. `Yokohamakosoku_Railway_Minatomirai` (Not in Tokyo prefecture list)

### 8. Special Cases:
- CLI has duplicate: `00000999_Tobu_Isesaki_Line__Skytree_Line_.json` and `00000798_Tobu_Isesaki_Line__Skytree_Line_.json`
- CLI has test file: `00000139_Saikyo_Line_v2_test.json`

## Recommendations for Mapping:
1. Create a mapping table that handles:
   - JR prefix additions
   - Character encoding differences (ō vs o, ū vs u)
   - Parenthetical information differences
   - Line vs Main Line suffixes
   
2. Handle missing lines by:
   - Ignoring Shinkansen lines (not relevant for local commuting)
   - Creating placeholder mappings for lines not in CLI tool
   - Flagging Yokohama lines as out-of-scope (different prefecture)

3. Use fuzzy matching for station names within each line to handle minor differences