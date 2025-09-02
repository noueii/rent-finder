#!/usr/bin/env python3
"""
Explore GTFS file structure to see what data is available
"""

import zipfile

def explore_gtfs(gtfs_file='../data/tokyo_rail.zip'):
    """List all files in GTFS and show sample data"""
    
    with zipfile.ZipFile(gtfs_file) as zf:
        print("Files in GTFS:")
        print("-" * 50)
        for filename in sorted(zf.namelist()):
            print(f"  - {filename}")
        
        print("\n\nSample data from each file:")
        print("=" * 80)
        
        for filename in sorted(zf.namelist()):
            if filename.endswith('.txt'):
                print(f"\n{filename}:")
                print("-" * 50)
                with zf.open(filename) as f:
                    lines = f.read().decode('utf-8').split('\n')
                    # Show header and first 3 rows
                    for i, line in enumerate(lines[:4]):
                        print(f"  {line}")
                        if i >= 3:
                            break

if __name__ == "__main__":
    explore_gtfs()