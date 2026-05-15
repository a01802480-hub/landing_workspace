# HMMER

## Overview
Protein sequence homology search using profile HMMs

**Category:** search  
**Base URL:** https://www.ebi.ac.uk/Tools/services/rest/hmmer  
**Prefix:** /hmmer  
**Source:** https://www.ebi.ac.uk/Tools/hmmer/  
**Discovered:** 2026-04-16T02:52:56.215567

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /job | POST | Submit HMMER search |
| 2 | /status/{job_id} | GET | Check search status |
| 3 | /result/{job_id} | GET | Get search results |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/hmmer/discover')
print(resp.json())
```
