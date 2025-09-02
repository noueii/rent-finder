# Product Requirements Document (PRD)
## Tokyo Apartment Finder

### 1. Executive Summary

Tokyo Apartment Finder is a real estate web application that revolutionizes apartment searching by allowing users to find properties based on commute time to their workplace or desired destinations. The platform combines traditional apartment search filters with real-time public transportation route calculations to provide a unique, user-centric apartment discovery experience.

### 2. Problem Statement

Traditional apartment search platforms in Tokyo focus on location-based searches without considering the actual commute time, which is often the most critical factor for residents. Users need to manually check transit times for each property, making the search process tedious and inefficient.

### 3. Solution Overview

A web application that:
- Calculates real-time commute times using public transportation data
- Provides a Tinder-like browsing experience for efficient apartment discovery
- Offers personalized lists and bookmarking features
- Includes an admin panel for data management and testing

### 4. Target Users

#### Primary Users
- **Apartment Seekers**: People looking for apartments in Tokyo who prioritize commute time
- **Authenticated Users**: Users who have created accounts to access premium features

#### Secondary Users
- **Administrators**: Internal team managing apartment data and system operations

### 5. Core Features

#### 5.1 Search Endpoint
- **Endpoint**: `/search` with standard query parameters
- **Access**: Available to all users
- **Functionality**:
  - Standard filters only (price, size, location, etc.)
  - Returns immediate filtered results
  - No commute calculations in this flow

#### 5.2 Commute-Based Search (Separate Flow)
- **Access**: Authenticated users only
- **Process**: Entirely different from standard search
  1. User configures filters and commute requirements
  2. System creates a new list/search session
  3. User is redirected to a dedicated page showing progress
  4. Backend processes apartments asynchronously:
     - Fetch apartments matching basic criteria
     - Calculate routes via OTP service for each
     - Populate the list with results
  5. Page shows real-time progress updates
  6. Results persist and remain accessible via list ID

#### 5.3 Browse Feature (/browse - Tinder-Style)
- **Route**: Dedicated `/browse` page
- **Interface**: Card-based, one apartment at a time
- **Interactions**:
  - Swipe right/tap right: Continue browsing
  - Swipe left/tap left: Add to hidden list
  - Bottom buttons: Quick actions for list management
  - Image navigation: Tap sides to navigate photos
- **Lists**:
  - Bookmarked
  - Liked
  - Favorited
  - Hidden
  - Custom search results

#### 5.4 Apartment Cards
- **Design**: Reusable component
- **Data**: Receives only apartment ID and commute routes
- **Display**: Consistent across all features

#### 5.5 Admin Panel
- **Scraping Management**: Control data collection from various real estate sites
- **Endpoint Testing**: Test backend services functionality
- **Data Management**: CRUD operations for apartment listings

### 6. Technical Requirements

#### 6.1 Technology Stack
- **Frontend**: Next.js (T3 Stack)
- **UI Components**: shadcn/ui
- **Animations**: motion.dev
- **Database**: PostgreSQL (containerized with Docker)
- **API**: tRPC
- **Authentication**: NextAuth.js (T3 Stack)
- **External Services**: OTP service for route calculations

#### 6.2 Architecture Principles
- **Component Reusability**: Maximum code reuse across features
- **Code Readability**: Keep files concise and well-organized
- **MVP Approach**: Local development first, production-ready structure
- **Version Control**: Git with meaningful commits for all significant changes

#### 6.3 Data Model
- **Apartments**: Property listings with details
- **Apartment Images**: Multiple images per apartment
- **Stations**: Train/subway stations
- **Train Lines**: Transit lines information
- **Station-Line Relationship**: Many-to-many
- **Lists**: User-created and system lists
- **Apartment-List Relationship**: Many-to-many
- **Routes**: Cached commute calculations
- **User Preferences**: Saved filters, search history, and settings

### 7. User Experience Requirements

#### 7.1 Landing Page
- Focus entirely on commute-based search feature
- Clear value proposition
- Simple authentication flow

#### 7.2 Search Experience
- Real-time progress indicators
- Persistent results (survive page refresh)
- Clear feedback on search status

#### 7.3 Browse Experience
- Smooth animations
- Intuitive gesture controls
- Quick action buttons
- Minimal cognitive load

### 8. Development Workflow

#### 8.1 Component Development
1. Create component library page
2. Mock all UI components
3. Review and iterate until satisfied
4. Implement in features

#### 8.2 Git Workflow
- Commit after each significant implementation
- Clear commit messages
- Feature branches for major work

### 9. Success Metrics

- **Search Efficiency**: Time to find suitable apartment reduced by 50%
- **User Engagement**: Average session duration > 10 minutes
- **Conversion**: 30% of searches result in saved apartments
- **Performance**: Search results load < 3 seconds after initial calculation

### 10. MVP Scope

#### Phase 1 (MVP)
- Component library
- Admin panel
- Basic authentication
- Standard search endpoint
- Commute-based search flow (separate)
- Browse interface (/browse)
- Core lists (Bookmarked, Hidden)
- Transit data integration

#### Future Phases
- Advanced filtering
- Social features
- Mobile app
- AI recommendations
- Landlord portal

### 11. Constraints and Assumptions

#### Constraints
- Must work locally first
- Limited to public transportation data available through OTP
- Authentication required for premium features

#### Assumptions
- Users have stable internet connection
- OTP service remains available and accurate
- Scraping sources remain accessible
- Users primarily use public transportation

### 12. Dependencies

- OTP service availability
- Real estate website scraping permissions
- PostgreSQL database setup
- Docker environment
- Authentication provider setup

### 13. Risks and Mitigation

| Risk | Impact | Mitigation |
|------|---------|------------|
| OTP service downtime | High | Cache route calculations, implement fallback |
| Scraping blocked | Medium | Multiple data sources, respect robots.txt |
| Performance issues | High | Implement pagination, optimize queries |
| Data accuracy | Medium | Regular validation, user reporting system |

### 14. Timeline

- **Week 1-2**: Component library and UI development
- **Week 3-4**: Admin panel
- **Week 5-6**: Authentication and basic search
- **Week 7-8**: Commute calculation integration
- **Week 9-10**: Browse feature implementation
- **Week 11-12**: Testing and refinement

### 15. Appendix

#### A. Component Library Requirements
- All components documented
- Interactive examples
- Accessibility compliant
- Responsive design
- Animation previews

#### B. API Endpoints (Initial)
- `/auth/*` - Authentication flows
- `/search` - Standard search with query parameters (no commute)
- `/browse` - Tinder-like browsing interface
- `/lists/*` - List management (includes commute search results)
- `/apartments/:id` - Individual apartment data
- `/admin/*` - Admin operations

#### C. Database Schema (Simplified)
- users
- user_preferences
- apartments
- apartment_images
- stations
- train_lines
- station_lines (junction)
- lists
- apartment_lists (junction)
- routes
- search_sessions
- scraping_sources

#### D. Scraping References

##### Target Sites

1. **RealEstate.co.jp**
   - Search: `https://realestate.co.jp/en/rent?prefecture=JP-13&city=13000&trainline=&district=&max_rent=160000&search=Search`
   - Detail: `https://realestate.co.jp/en/rent/view/1249374`

2. **YOLO Japan Home**
   - Search: `https://home.yolo-japan.com/en/tokyo/list?priceTo=160&areaFrom=25&perPage=50&page=1`
   - Detail: `https://home.yolo-japan.com/en/property/1411616`

3. **Wagaya Japan**
   - Search: `https://wagaya-japan.com/en/rent/tokyo/list/?upperprice=160000&heibeimin=25&room_kei=0&sort=4`
   - Detail: `https://wagaya-japan.com/en/chintai_detail.php?id=2600102`

   ```
   <li id="data-item-2" class="lists-fluid-item pro-search-item" data-itemid="35.643840,139.317691">
					<div class="pro-ttlbox">
						<p class="pro-search-item__cate">Corporate Apartments</p>
						<p class="pro-search-item__ttl">Villagehouse Kobiki</p>
					</div>
					<div class="pro-search-infobox">
						<div class="pro-search-infobox__img">
							<img class=" ls-is-cached lazyloaded" data-src="https://dzql9bqbblzc3.cloudfront.net/mirror_canto_repo/exterior/3019/3019_02_g3tqlch2l97vv4g27d7hv8dh79.JPG" src="https://dzql9bqbblzc3.cloudfront.net/mirror_canto_repo/exterior/3019/3019_02_g3tqlch2l97vv4g27d7hv8dh79.JPG" alt="">
						</div>
						<div class="pro-search-infobox__table pro-search-table">
							<dl class="pro-search-table__row"><dt class="pro-search-table__name">Location</dt><dd class="pro-search-table__data"><p>Kobiki-machi 530, Hachioji-shi, Tokyo-to</p></dd></dl>
							<dl class="pro-search-table__row"><dt class="pro-search-table__name">Nearest Station</dt><dd class="pro-search-table__data"><p>10minutes on foot from YamadaStation.</p></dd></dl>
							<dl class="pro-search-table__row"><dt class="pro-search-table__name">Building Age/level</dt><dd class="pro-search-table__data"><p>1964/8（60years） / 5F-story building.</p></dd></dl>
						</div>
					</div>
					<div class="pro-floor-list">
						<p class="pro-floor-count">▼&nbsp;2 room</p>
						<div class="floor-list-pc">
							<dl class="pro-floor-list__item">
								<dt class="pro-floor-list__col">Floor plan</dt>
								<dt class="pro-floor-list__col">F</dt>
								<dt class="pro-floor-list__col">Rent/Maintenance Fee</dt>
								<dt class="pro-floor-list__col">Deposit/Key Money</dt>
								<dt class="pro-floor-list__col">Layout/Area</dt>
								<dt class="pro-floor-list__col">Details</dt>
							</dl>
<dl class="pro-floor-list__item">
						<dd class="pro-floor-list__col">
							<div class="col_image"><img class="pro-floor-img" src="https://dzql9bqbblzc3.cloudfront.net/mirror_canto_repo/floorplan_specific/H32_P2_uautmv22ul21pcsqgpc11vj32r.JPG" alt=""></div>
							<p style="font-size: 12px;margin-top: 3px;">16 photos</p>
						</dd>
						<dd class="pro-floor-list__col"><p>2F</p></dd>
						<dd class="pro-floor-list__col"><p class="emph">￥60,000</p><p>-</p></dd>
						<dd class="pro-floor-list__col"><p>0months</p><p>0months</p></dd>
						<dd class="pro-floor-list__col"><p>3DK</p><p>(49.2m²)</p></dd>
						<dd class="pro-floor-list__col floor-btn-box inq_box">
							<span class="fav_btn" data-favid="1378105"></span>
							<a href="/en/chintai_detail.php?id=1378105" class="pro-btn-dtl" target="_blank">Details</a>
							<a href="/en/chintai_detail.php?id=1378105#detail-inq" class="pro-btn-inq" target="_blank">Contact us</a>
						</dd>
					</dl>
<dl class="pro-floor-list__item">
						<dd class="pro-floor-list__col">
							<div class="col_image"><img class="pro-floor-img" src="https://dzql9bqbblzc3.cloudfront.net/mirror_canto_repo/floorplan_specific/H32_P2_uautmv22ul21pcsqgpc11vj32r.JPG" alt=""></div>
							<p style="font-size: 12px;margin-top: 3px;">16 photos</p>
						</dd>
						<dd class="pro-floor-list__col"><p>5F</p></dd>
						<dd class="pro-floor-list__col"><p class="emph">￥54,000</p><p>-</p></dd>
						<dd class="pro-floor-list__col"><p>0months</p><p>0months</p></dd>
						<dd class="pro-floor-list__col"><p>3DK</p><p>(49.2m²)</p></dd>
						<dd class="pro-floor-list__col floor-btn-box inq_box">
							<span class="fav_btn" data-favid="3444043"></span>
							<a href="/en/chintai_detail.php?id=3444043" class="pro-btn-dtl" target="_blank">Details</a>
							<a href="/en/chintai_detail.php?id=3444043#detail-inq" class="pro-btn-inq" target="_blank">Contact us</a>
						</dd>
					</dl></div></div></li>
      ```

4. **E-Housing**
   - Search: `https://e-housing.jp/rent?location_point=139.5816585897043%2C35.514082964298694&location_point=139.5816585897043%2C35.79533792183815&location_point=139.88731007682898%2C35.79533792183815&location_point=139.88731007682898%2C35.514082964298694&area_from=25&area_to=100%2B&price_from=0&price_to=160000`
   - Detail: `https://e-housing.jp/rent/tokyo/sumida/isle-premium-oshiage-nord/505`

   ```
	await fetch("https://api.e-housing.jp/rent/properties", {
    "credentials": "omit",
    "headers": {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/json",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
    },
    "referrer": "https://e-housing.jp/",
    "body": "{\"search_params\":[\"address\",\"address_ja\",\"name\",\"name_ja\"],\"location_point\":[\"139.5816585897043,35.514082964298694\",\"139.5816585897043,35.79533792183815\",\"139.88731007682898,35.79533792183815\",\"139.88731007682898,35.514082964298694\"],\"per_page\":50,\"page\":7,\"rent_amounts_from\":\"0\",\"rent_amounts_to\":\"160000\",\"amount_from\":\"0\",\"amount_to\":\"160000\",\"sale_prices_from\":\"0\",\"sale_prices_to\":\"160000\",\"area_from\":\"25\",\"area_to\":9999999999,\"sort_column\":\"popularity\",\"price_from\":\"0\",\"price_to\":\"160000\",\"reins_partial\":\"\",\"require_latlong\":true}",
    "method": "POST",
    "mode": "cors"
	})
   ```

5. **Japan Property**
   - Search: `https://www.japan-property.jp/apartment-for-rent/Tokyo/23wards?price_to=150000&page=2`
   - Detail: `https://www.japan-property.jp/apartment-property-for-rent-in-tokyo-R0002189`

6. **Metro Residences**
   - Search: `https://www.metroresidences.com/jp-en/apartment-rental/?price=0,150000&size=25,165`
   - Detail: `https://www.metroresidences.com/jp-en/apartment-rental/tokyo/chuo/grand-palace-tokyo-yaesu-avenue/45032`a

   - Fetch: 
   ```
   await fetch("https://www.metroresidences.com/api/mbp/building", {
    "credentials": "include",
    "headers": {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.5",
        "content-type": "application/json",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Priority": "u=0",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
    },
    "referrer": "https://www.metroresidences.com/jp-en/apartment-rental/?price=0,150000&size=25,165&view=grid-view",
    "body": "{\"price\":\"0,150000\",\"size\":\"25,165\",\"view\":\"grid-view\",\"countryCode\":\"jp\",\"languageCode\":\"en\",\"distance\":\"2.5km\",\"curPage\":1,\"perPage\":24}",
    "method": "POST",
    "mode": "cors"
	});
	```

7. **Hmlet Japan**
   - Search: `https://hmletjapan.com/en/property/n/shibuya,shinjuku,central,asakusa,ikebukuro,shinagawa?gad_source=1&price_max=150000`
   - Detail: `https://hmletjapan.com/en/property/57/units/1136/detail`

   - GraphQL: 
   ```
   await fetch("https://go4k2rbeqrb4nlkkrlhdiqztiu.appsync-api.ap-northeast-1.amazonaws.com/graphql", {
    "credentials": "include",
    "headers": {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "content-type": "application/json; charset=UTF-8",
        "x-amz-date": "20250718T191146Z",
        "x-amz-security-token": "IQoJb3JpZ2luX2VjEHsaDmFwLW5vcnRoZWFzdC0xIkYwRAIgW8R6j29Ti4uSIvgeP3JCWWbUTca30auAildlQQN1/fICIH4acK+tuBOnnUZG5T5fcvp6Ps5mzaKtrlO/fYeR+6MFKr4FCJT//////////wEQABoMMDE0NDk4NjU2NjUxIgyQsFGu++HI7/K3GGkqkgV4qPNZ3qPPhrko6DMV+QZRKEa9O4rqnGJHOxHrDQzwPZ6qhL/g5hpswQBHb0GQWmZgFn1D4PD/zjRXqz8ylxOZxWUbqJJphdyYBafGtag4j/LFHyL3p1jN44Wg3Aues/jlYYTU2ApuaAnKCtaevqwn5luRQF2MY5DLLKeb+Ux39weDYh8/GkEn4zXNgIpYP+4e+olhvvku/bGczmkLq9nLhWeETOGW1TdoOzm2ZGe4CZsDWiYry3qmajwxNPoqN+MJ87mWvroLhfNTpss+v/aOMNZ1C+NeCPK+pJhyiz/KmJT42wCZYbIrfxx8956bswr35ksl3pMSZ2yQCrrZ6DPOeFrRHdL9/3FNCBRFzeELu0a5ZlMi1GHyudsRp/qe5gcP1E3rtwHogHjtHLa1LtNSciZkg6O0jbzF0exftUgeW6Wn5tR2hSOnK0YH+4/jERebh944hMr4XABAEzQUZIepemztVPmFFPoj8iXmYuZ26SriYJu5y//SQLV2vbq/jSJaM0cziafMuZBqp+xqEcl0N1KiWv2TG+dF5KYmVSg5WuHxnzVVflOrv2BRHbEpiFQ0YQl2JjZrLhzB9b/Ahyde9ULcudbpJn12iJ+AAFEMkXa96PJ0fa5qHGcuI84JR+7Vh1C7HxPPplFp13dqWFWJ1oUMpzEsnYiIZKnIt6b5QIGGYZLnxW86zJmd9HnjTl8uFjl5KkhP83o9XlDhv62vQb1QbGBvulXWR4SOPqiYnMzj3aMYrDShSH70Ceo4HNsNOh3Xf7ifrCf/qJYhIW8iB0y4pWk3xyehx2LVPRB57xrJaqwU4GCYVsEQOiq2TQLQiHbAhW7BNcwTXwKby42TBCNTG4cJmtgvpaT0o0VrF35zMPK46sMGOuQC0O18riIZsK+IPdO8v2U8nE0oibTRdhrrcfNMyDRAVu3ez11KT2vDC+K2DLDkrJfDh19VYoPVGLj2mA8OwLZ/Aotf/e5gipC06PAcW9Wg77SwF5x9L2fi3+U/SRJvY6+DTt1aPB3PV/xCUkvmudHnZRXgE5rQzidXf1AxTtNpZVVF2Pvg1SO24Oy3WUrQVmUr3lLoOfwR8j9y1XohHNaWy2Mzd6fizu3aWXgshX0HbmNqOgfobYLCJrc3A+w2Cp/qOX22rbs3TJd7VJVlczgAN6yjvNtrRTJhjaDuQBxYdhwp/P9DtvsTdFVasm3xmsKcI8nKDPSPe6ws4z51U+fFEMSwAPGNJBaDjv1RKEKXS60Bdip+NQIg7ocZV2TCSeY6/rcx3Y3AUyiWvqqLb51CWxM8bTi8ztuOz77fPP7vPcQX/FsKIXS82NMXePaGUhfkXuCY6D9JXlUFeyGJBFS/BlKU4Ak=",
        "authorization": "AWS4-HMAC-SHA256 Credential=ASIAQGYBP6GFYJ4CZKRM/20250718/ap-northeast-1/appsync/aws4_request, SignedHeaders=accept;content-type;host;x-amz-date;x-amz-security-token, Signature=d3b7d3350729466cb084e492a0ecf70ef3dbde3bc29d3dc15b90251ac10941b8",
        "x-amz-user-agent": "aws-amplify/3.0.7",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "Priority": "u=4",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
    },
    "referrer": "https://hmletjapan.com/",
    "body": "{\"operationName\":\"listSearchPageDisplayInformation\",\"variables\":{\"limit\":12,\"nextToken\":\"MA==\",\"areas\":[\"shibuya\",\"shinjuku\",\"central\",\"asakusa\",\"ikebukuro\",\"shinagawa\"],\"orderBy\":[{\"earliest_move_in_date\":\"ASC\",\"list_price\":\"ASC\",\"unit_id\":\"ASC\"}]},\"query\":\"query listSearchPageDisplayInformation($limit: Int!, $nextToken: String!, $areas: [String], $layouts: [String], $filter: TableUnit_searches_filteredFilterInput, $orderBy: [OrderByUnit_searchInput]) {\\n  countUnit_searches_filtered(areas: $areas, layouts: $layouts, filter: $filter)\\n  listUnit_searches_filtered(\\n    limit: $limit\\n    nextToken: $nextToken\\n    areas: $areas\\n    layouts: $layouts\\n    filter: $filter\\n    orderBy: $orderBy\\n  ) {\\n    items {\\n      property_id\\n      unit_id\\n      photo_path\\n      earliest_move_in_date\\n      list_price\\n      coordinates\\n      property {\\n        prefecture_en\\n        prefecture_ja\\n        city_en\\n        city_ja\\n        property_name_en\\n        property_name_ja\\n        __typename\\n      }\\n      unit {\\n        unit_number\\n        layout\\n        size_square_meters\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n}\"}",
    "method": "POST",
    "mode": "cors"
	});
	```

##### Data Points
- Property ID/URL
- Title/Name
- Price (monthly rent)
- Size (m²)
- Location/Address
- Nearest station(s)
- Room layout
- Floor number
- Building age
- Images
- Amenities
- Availability status

##### Scraping Considerations
- **Frequency**: On-demand when admin initiates scraping
- **Rate Limits**: Implement delays between requests (1-2 seconds)
- **Authentication**: None required for public listings
- **Robots.txt**: Check and respect each site's robots.txt
- **User-Agent**: Use appropriate headers to identify scraper