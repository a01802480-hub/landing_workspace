# Ensembl

## Overview
Genomic data, annotation, and variation from Ensembl

**Category:** genomics  
**Base URL:** https://rest.ensembl.org  
**Prefix:** /ensembl  
**Source:** https://rest.ensembl.org  
**Discovered:** 2026-04-16T02:56:40.913959

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /lookup/symbol/{species}/{symbol} | GET | Look up an Ensembl ID by symbol |
| 2 | /sequence/id/{id} | GET | Request a sequence by its stable ID |
| 3 | /variation/{species}/{id} | GET | Get variation data by ID |
| 4 | /xrefs/id/{id} | GET | Get external references for an Ensembl ID |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/ensembl/discover')
print(resp.json())
```
