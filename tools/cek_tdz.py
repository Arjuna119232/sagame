import re,sys
p=sys.argv[1]
lines=open(p).read().split('\n')
decl={}
depth=0
code=[]
for i,l in enumerate(lines,1):
    if l.startswith(('const ','let ','var ')):
        m=re.match(r'(?:const|let|var)\s+([A-Za-z_$][\w$]*)',l)
        if m and m.group(1) not in decl: decl[m.group(1)]=i
    if depth==0: code.append((i,l))
    t=re.sub(r"'(\\.|[^'])*'",'""',l); t=re.sub(r'"(\\.|[^"])*"','""',t); t=re.sub(r'//.*','',t)
    depth+=t.count('{')-t.count('}')
bad=[]
for name,dl in decl.items():
    for i,l in code:
        if i>=dl: break
        if l.strip().startswith('//'): continue
        if re.search(r'(?<![\w.$])'+re.escape(name)+r'(?![\w$])', l.split('//')[0]):
            bad.append((name,dl,i,l.strip()[:90])); break
for b in sorted(bad,key=lambda x:x[2]):
    print("USE-BEFORE-DECL %s: dipakai baris %d -> deklarasi baris %d | %s"%(b[0],b[2],b[1],b[3]))
print("total:",len(bad))
sys.exit(1 if bad else 0)
