# NCBI BLAST

## Overview
Basic Local Alignment Search Tool for sequence similarity

**Category:** search  
**Base URL:** https://blast.ncbi.nlm.nih.gov  
**Prefix:** /blast  
**Source:** https://blast.ncbi.nlm.nih.gov/  
**Discovered:** 2026-04-16T02:52:53.293140

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /Blast.cgi | POST | Submit BLAST search (CMD=Put) |
| 2 | /Blast.cgi | GET | Check BLAST status (CMD=Get) |
| 3 | /Blast.cgi | GET | Get BLAST results (JSON format) |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/blast/discover')
print(resp.json())
```
