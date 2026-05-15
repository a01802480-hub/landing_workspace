# AlphaFold DB

## Overview
AI-predicted 3D protein structures

**Category:** structure  
**Base URL:** https://alphafold.ebi.ac.uk/api  
**Prefix:** /alphafold  
**Source:** https://alphafold.ebi.ac.uk/  
**Discovered:** 2026-04-16T03:05:28.048239

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /prediction/{uniprot_id} | GET | Get AlphaFold prediction |
| 2 | /entry/{uniprot_id} | GET | Get entry metadata |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/alphafold/discover')
print(resp.json())
```
