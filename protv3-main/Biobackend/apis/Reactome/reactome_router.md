# Reactome

## Overview
Free, open-source, curated and peer-reviewed pathway database

**Category:** pathway-analysis  
**Base URL:** https://reactome.org/ContentService  
**Prefix:** /reactome  
**Source:** https://reactome.org/dev  
**Discovered:** 2026-04-16T02:56:47.418498

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /data/pathways/low/entity/{id} | GET | Get pathways for a given entity |
| 2 | /data/query/enhanced/{id} | GET | Get enhanced details for an entity |
| 3 | /data/species/all | GET | List all species in Reactome |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/reactome/discover')
print(resp.json())
```
