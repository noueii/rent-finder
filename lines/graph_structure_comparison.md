# Transfer Edge Storage Comparison

## Current (Weird) Approach
```json
"edges": {
  "00005613": {
    "00005613_transfer_00000139_to_00000141": {
      "to": "00005613",  // Points to itself!
      "type": "transfer",
      "travel_time": 5
    }
  }
}
```
**Problems:**
- Self-referencing edges are confusing
- Doesn't represent actual movement
- Makes pathfinding logic complex

## Better Option 1: Line-Aware Nodes
Create virtual nodes for each line at a station:
```json
"nodes": {
  "00005613": { "type": "station", "name": "Osaki" },
  "00005613_L00000141": { "type": "line_platform", "station": "00005613", "line": "00000141" },
  "00005613_L00000139": { "type": "line_platform", "station": "00005613", "line": "00000139" }
},
"edges": {
  "00005613_L00000141": {
    "00005613_L00000139": { "type": "transfer", "time": 5 },
    "00007825_L00000141": { "type": "train", "time": 3 }
  }
}
```

## Better Option 2: Edge Metadata (Simpler)
Keep single nodes but add current_line to edge data:
```json
"edges": {
  "00005613": {
    "00007825": [
      {
        "line_id": "00000141",
        "train_type": "Local",
        "time": 3,
        "requires_line": "00000141"  // Must be on this line
      }
    ]
  }
}
```
Then handle transfers in the algorithm by tracking current line.

## Better Option 3: State-Based Graph (My Recommendation)
Store edges normally, but track line state during traversal:
```json
"stations": {
  "00005613": {
    "name": "Osaki",
    "lines": ["00000141", "00000139"]
  }
},
"edges": {
  "00005613": {
    "00007825": [
      {
        "line_id": "00000141",
        "train_type": "Local",
        "time": 3
      }
    ]
  }
}
```

During pathfinding:
- Track current line in algorithm state
- Add 5 min when switching lines
- No weird self-edges needed!