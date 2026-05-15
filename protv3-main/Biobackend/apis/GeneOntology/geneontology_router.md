# Gene Ontology

## Overview
The Gene Ontology resource for gene function information

**Category:** annotation  
**Base URL:** http://api.geneontology.org/api  
**Prefix:** /go  
**Source:** http://geneontology.org/  
**Discovered:** 2026-04-16T03:05:30.904436

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /bioentity/gene/{id} | GET | Get GO annotations for a gene |
| 2 | /ontology/term/{id} | GET | Get details for a GO term |
| 3 | /search/entity/autocomplete/{term} | GET | Autocomplete search for entities |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/go/discover')
print(resp.json())
```
