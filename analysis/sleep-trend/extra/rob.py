exec(open('bench.py').read().split('# 1) reproduce')[0])
import numpy as np
marina=np.array([428.3,400.8,429.3,445.2,387.5,378.2,406.2,407.8,415.1,399.5,431.7,442.6,431.2,450.1,443.2,410.9,425.0,401.2,432.3,424.4,418.2,404.6,441.4,425.8,413.4,349.0,344.2,337.0,336.2,335.4])
for n,(fn,p,v) in DET.items(): print('marina',n,fn(marina,**{p:v}), [round(x,1) for x in base(marina)])
print('cusum S:', end=' ')
m,d=base(marina); S=0
for i in range(10,30): S=max(0,S-(marina[i]-m)/d-1.25); print(i+1, round(S,2), end='; ')
print()
for mult,rho in [(1.0,0.41),(1.5,0.41),(2.0,0.41),(1.0,0.7),(3.45,0.41)]:
    SD0=SD; SD=SD0*mult; RHO=rho
    rng=np.random.default_rng(5); nd=[gen(rng,False) for _ in range(2000)]
    print(f'SD x{mult} rho {rho}:', {n: f"{np.mean([len(fn(s,**{p:v}))>0 for s in nd]):.0%}" for n,(fn,p,v) in DET.items()})
    SD=SD0; RHO=0.411
