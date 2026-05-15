# SWISS-MODEL

## Overview
Automated protein structure homology modeling

**Category:** structure  
**Base URL:** https://swissmodel.expasy.org/api  
**Prefix:** /swissmodel  
**Source:** https://swissmodel.expasy.org/  
**Discovered:** 2026-04-16T03:05:36.921756

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /projects/ | POST | Submit homology modeling job |
| 2 | /projects/{project_id} | GET | Get project status |
| 3 | /projects/{project_id}/models/ | GET | Get models |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/swissmodel/discover')
print(resp.json())
```
