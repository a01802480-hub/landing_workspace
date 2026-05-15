# NCBI E-utilities

## Overview
Entrez Programming Utilities for searching and retrieving NCBI data

**Category:** search  
**Base URL:** https://eutils.ncbi.nlm.nih.gov/entrez/eutils  
**Prefix:** /ncbi  
**Source:** https://www.ncbi.nlm.nih.gov/books/NBK25497/  
**Discovered:** 2026-04-16T02:56:52.879690

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /esearch.fcgi | GET | Search an Entrez database |
| 2 | /efetch.fcgi | GET | Fetch records from an Entrez database |
| 3 | /esummary.fcgi | GET | Get document summaries from a list of UIDs |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/ncbi/discover')
print(resp.json())
```
