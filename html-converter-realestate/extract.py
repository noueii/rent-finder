
from bs4 import BeautifulSoup
import json

# Adjust these filenames as needed
INPUT_FILE = "tokyo-apts.html"
OUTPUT_FILE = "output_listings.txt"
OUTPUT_FILE_JSON = "output_listings.json"
BASE_URL = "https://realestate.co.jp"

with open(INPUT_FILE, 'r', encoding='utf-8') as file:
    soup = BeautifulSoup(file, 'html.parser')

listings = soup.find_all("div", class_="property-listing")

output_data = []
output_data_json = []

for listing in listings:
    def safe_get_text(selector, default="N/A"):
        el = listing.select_one(selector)
        return el.get_text(strip=True) if el else default

    def safe_find_next_sibling(span_text):
        span = listing.find("span", string=span_text)
        if span and span.next_sibling:
            return span.next_sibling.strip()
        return "N/A"

    title = safe_get_text(".listing-title .text-semi-strong")
    location_container = listing.select_one(
        ".listing-title span:not(.text-semi-strong)")
    location_parts = location_container.decode_contents().split(
        '<br/>') if location_container else []

    area = location_parts[0].replace("in", "").strip() if len(
        location_parts) > 0 else "N/A"
    ward = location_parts[1].strip() if len(location_parts) > 1 else "N/A"

    link_tag = listing.select_one(".listing-title a")
    link = BASE_URL + link_tag['href'] if link_tag else "N/A"

    monthly_cost = safe_find_next_sibling("Monthly Costs")
    availability = safe_get_text(".text-success", default="Not specified")
    size = safe_find_next_sibling("Size")
    deposit = safe_find_next_sibling("Deposit")
    key_money_span = listing.find("span", string="Key Money")
    key_money = key_money_span.find_next_sibling().get_text(
        strip=True) if key_money_span else "N/A"
    floor = safe_find_next_sibling("Floor")
    year_built = safe_find_next_sibling("Year Built")
    nearest_station_span = listing.find("span", string="Nearest Station")
    nearest_station = nearest_station_span.find_next_sibling().get_text(
        strip=True) if nearest_station_span else "N/A"

    formatted_listing = (
        f"Property: {title}\n"
        f"Link: {link}\n"
        f"Area: {area}\n"
        f"Ward: {ward}\n"
        f"Monthly Costs: {monthly_cost}\n"
        f"Availability: {availability}\n"
        f"Size: {size}\n"
        f"Deposit: {deposit}\n"
        f"Key Money: {key_money}\n"
        f"Floor: {floor}\n"
        f"Year Built: {year_built}\n"
        f"Nearest Station: {nearest_station}\n"
        + "-" * 40
    )
    output_data.append(formatted_listing)

    prop = {
        "property": title,
        "area": area,
        "ward": ward,
        "link": link,
        "monthly_costs": monthly_cost,
        "availability": availability,
        "size": size,
        "deposit": deposit,
        "key_money": key_money,
        "floor": floor,
        "year_built": year_built,
        "nearest_station": nearest_station
    }

    output_data_json.append(prop)

with open(OUTPUT_FILE, 'w', encoding='utf-8') as file:
    file.write("\n".join(output_data))

with open(OUTPUT_FILE_JSON, 'w', encoding='utf-8') as file:
    json.dump(output_data_json, file, indent=2, ensure_ascii=False)

print(f"Extracted data saved to {OUTPUT_FILE}")
