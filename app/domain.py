import math
import re
from collections import Counter

STATES = {'Suggested': ['Review', 'Rejected', 'Deferred'], 'Review': ['Feasibility', 'Rejected', 'Deferred'], 'Feasibility': ['Planned', 'Rejected', 'Deferred'], 'Planned': ['Implemented', 'Deferred'], 'Implemented': ['Validated', 'Needs rework'], 'Needs rework': ['Planned'], 'Validated': ['Closed'], 'Deferred': ['Review'], 'Rejected': [], 'Closed': []}
KPI = {'Scrap Rate': ('%', 'lower'), 'OEE': ('%', 'higher'), 'FPY': ('%', 'higher'), 'Downtime': ('min', 'lower'), 'MTBF': ('hours', 'higher'), 'MTTR': ('min', 'lower'), 'Cycle Time': ('sec', 'lower'), 'Energy / Unit': ('kWh', 'lower'), 'Defects PPM': ('ppm', 'lower'), 'Changeover Time': ('min', 'lower')}
WEIGHTS = {'Text relevance': .30, 'Equipment match': .20, 'Process match': .20, 'KPI gap': .15, 'Historical success': .05, 'Feasibility': .10}

def improvement(baseline, post, direction):
    if not all(math.isfinite(x) and x >= 0 for x in (baseline, post)) or baseline == 0:
        raise ValueError('Baseline must be positive and values finite and non-negative.')
    return round((post-baseline)/baseline*100*(1 if direction == 'higher' else -1), 2)

def tokens(text):
    synonyms = {'misaligned': 'alignment', 'misalignment': 'alignment', 'weld': 'welding', 'defects': 'scrap', 'rejects': 'scrap', 'fixture': 'jig'}
    return Counter(synonyms.get(w, w) for w in re.findall(r'[a-z0-9]+', text.lower()) if len(w)>2)

def similarity(a, b):
    a,b = tokens(a),tokens(b)
    return sum(v*b[k] for k,v in a.items()) / (math.sqrt(sum(v*v for v in a.values())*sum(v*v for v in b.values())) or 1)

def recommend(kaizen, sites, history):
    result=[]
    for site in sites:
        if site['plant']==kaizen['plant'] and site['shop']==kaizen['shop']: continue
        matches=[h for h in history if h['plant']==site['plant'] and h['shop']==site['shop'] and h['status'] in ('Validated','Closed')]
        factors={'Text relevance': round(similarity(kaizen['problem']+' '+kaizen['title'],site['context'])*100), 'Equipment match': 100 if site['equipment']==kaizen['equipment'] else 0, 'Process match': 100 if site['shop']==kaizen['shop'] else 0, 'KPI gap': round(min(1,max(0,(site['scrap']-2.1)/2.1))*100), 'Historical success': round(100*sum(h.get('improvement',0)>0 for h in matches)/len(matches)) if matches else 0, 'Feasibility': 50}
        result.append({**site,'score':round(sum(factors[k]*w for k,w in WEIGHTS.items())), 'factors':factors,'weights':WEIGHTS,'model':'offline-token-cosine-v1','note':'Ranking score, not a probability. Feasibility is an unverified neutral prior; history uses validated outcomes only.'})
    return sorted(result,key=lambda r:r['score'],reverse=True)
