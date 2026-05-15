# MUSCLE

## Overview
Multiple sequence alignment by MUSCLE

**Category:** alignment  
**Base URL:** https://www.ebi.ac.uk/Tools/services/rest/muscle  
**Prefix:** /muscle  
**Source:** https://www.ebi.ac.uk/Tools/msa/muscle/  
**Discovered:** 2026-04-16T02:53:17.757927

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /job | POST | Submit MUSCLE alignment |
| 2 | /status/{job_id} | GET | Check status |
| 3 | /result/{job_id} | GET | Get result |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/muscle/discover')
print(resp.json())
```
