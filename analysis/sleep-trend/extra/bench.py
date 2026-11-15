import numpy as np, pandas as pd
DP=24.37; AC=0.41
def base(s,n=10):
    b=s[:n]; m=b.mean(); sd=b.std(ddof=1); return m, max(12.0, np.sqrt(0.4*sd**2+0.6*DP**2))
def fixo(s,z=3.25,n=10):
    m,d=base(s,n); return [i+1 for i in range(n,len(s)) if s[i]<m-z*d]
def ewma(s,L=3.65,a=0.25,n=10):
    m,d=base(s,n); f=np.sqrt((1+AC*(1-a))/(1-AC*(1-a))); z=m; out=[]
    for i in range(n,len(s)):
        t=i-n+1; z=a*s[i]+(1-a)*z; sz=d*np.sqrt(a/(2-a)*(1-(1-a)**(2*t)))*f
        if z-m < -L*sz: out.append(i+1)
    return out
def cusum(s,h=4.5,k=1.25,n=10):
    m,d=base(s,n); S=0; out=[]
    for i in range(n,len(s)):
        S=max(0,S-(s[i]-m)/d-k)
        if S>h: out.append(i+1)
    return out
DET={'limiar_fixo':(fixo,'z',3.25),'ewma':(ewma,'L',3.65),'cusum':(cusum,'h',4.5)}
df=pd.read_csv('/mnt/project-files/dados-saude/equipe/metricas_noites.csv')
pv=df.pivot(index='sujeito',columns='noite',values='duracao_total_min').dropna(); pl=pv[(pv[1]-pv[2]).abs()<150]
MED=df.duracao_total_min.mean(); SD=float((pl[1]-pl[2]).abs().median()/np.sqrt(2)*1.4826); RHO=float(pl[1].corr(pl[2]))
print('calib',round(MED,1),round(SD,2),round(RHO,3))
def gen(rng,drift,dias=30,d0=21,mag=2.2,ramp=3):
    sn=SD*np.sqrt(1-RHO**2); x=rng.normal(0,SD); s=np.zeros(dias)
    for t in range(dias):
        if t>0: x=RHO*x+rng.normal(0,sn)
        s[t]=MED+x
    if drift:
        for i in range(d0-1,dias): s[i]-=min(1,(i-(d0-1)+1)/ramp)*mag*SD
    return s
def evaluate(series_nd, series_d, fn, kw):
    fa=np.mean([len(fn(s,**kw))>0 for s in series_nd])
    det=[];lag=[]
    for s in series_d:
        a=[d for d in fn(s,**kw) if d>=21]
        if a: det.append(1); lag.append(a[0]-21)
        else: det.append(0)
    return fa, np.mean(det), (np.median(lag) if lag else np.nan), (np.mean(lag) if lag else np.nan)
# 1) reproduce team benchmark
rng=np.random.default_rng(42)
nd=[gen(rng,False) for _ in range(50)]; dd=[gen(rng,True) for _ in range(50)]
for n,(fn,p,v) in DET.items():
    fa,dt,md,mn=evaluate(nd,dd,fn,{p:v}); print('repro',n,f'FA {fa:.0%} det {dt:.0%} med {md} mean {mn:.2f}')
# 2) team params on big fresh sample
rng=np.random.default_rng(7)
ndB=[gen(rng,False) for _ in range(3000)]; ddB=[gen(rng,True) for _ in range(3000)]
for n,(fn,p,v) in DET.items():
    fa,dt,md,mn=evaluate(ndB,ddB,fn,{p:v}); print('big',n,f'FA {fa:.1%} det {dt:.1%} med {md} mean {mn:.2f}')
# 3) fair: calibrate to 8% FA on train, test on fresh
rng=np.random.default_rng(1001); ndT=[gen(rng,False) for _ in range(3000)]
grids={'limiar_fixo':np.arange(2.0,5.01,0.05),'ewma':np.arange(2.0,6.01,0.05),'cusum':np.arange(2.0,14.01,0.1)}
for n,(fn,p,v) in DET.items():
    best=None
    for g in grids[n]:
        fa=np.mean([len(fn(s,**{p:g}))>0 for s in ndT])
        if fa<=0.08: best=g; break
    fa,dt,md,mn=evaluate(ndB,ddB,fn,{p:best}); print('fair8',n,p,round(best,2),f'FA {fa:.1%} det {dt:.1%} med {md} mean {mn:.2f}')
