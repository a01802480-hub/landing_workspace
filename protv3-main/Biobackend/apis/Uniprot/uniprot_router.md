# UniProt

## Overview
Central hub for protein sequence and functional information

**Category:** protein-data  
**Base URL:** https://www.ebi.ac.uk/proteins/api  
**Prefix:** /uniprot  
**Source:** https://www.uniprot.org/  
**Discovered:** 2026-04-16T02:56:44.362321

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /proteins | GET | Search for proteins |
| 2 | /proteins/{accession} | GET | Get a protein by accession |
| 3 | /features | GET | Get protein features |
| 4 | /variation | GET | Get protein variation data |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/uniprot/discover')
print(resp.json())
```
