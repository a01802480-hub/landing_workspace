# InterPro

## Overview
Protein family, domain and functional site annotation

**Category:** annotation  
**Base URL:** https://www.ebi.ac.uk/interpro  
**Prefix:** /interpro  
**Source:** https://www.ebi.ac.uk/interpro/  
**Discovered:** 2026-04-16T02:52:50.251785

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /api/entry | GET | Search InterPro entries |
| 2 | /api/entry/InterPro/{id} | GET | Get entry details |
| 3 | /api/protein/UniProt/{accession} | GET | Get protein annotations |
| 4 | /api/sequence | POST | Analyze sequence for domains |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/interpro/discover')
print(resp.json())
```
