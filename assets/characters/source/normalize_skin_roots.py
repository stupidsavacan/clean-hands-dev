# Copied from character-revision/source/normalize_skin_roots.py; see source-provenance.json.
# Import performs no file writes. Build/export orchestration lives in build_recipe.py.

import json, struct

def normalize(path):
 raw=path.read_bytes();magic,version,total=struct.unpack_from('<III',raw)
 assert magic==0x46546c67 and version==2 and total==len(raw)
 chunks=[];pos=12
 while pos<len(raw):
  size,kind=struct.unpack_from('<II',raw,pos);chunks.append((kind,raw[pos+8:pos+8+size]));pos+=8+size
 doc=json.loads(chunks[0][1]);nodes=doc['nodes'];parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
 animated={c['target'].get('node') for a in doc.get('animations',[]) for c in a['channels']}
 count=0
 for idx,n in enumerate(nodes):
  if 'skin' not in n or idx not in parents:continue
  par=parents[idx];chain=[par]
  while chain[-1] in parents:chain.append(parents[chain[-1]])
  for anc in chain:
   a=nodes[anc]
   assert anc not in animated,('animated parent requires manual review',path,anc)
   assert a.get('translation',[0,0,0])==[0,0,0] and a.get('rotation',[0,0,0,1])==[0,0,0,1] and a.get('scale',[1,1,1])==[1,1,1]
   assert a.get('matrix',[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])==[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
  scenes=[s for s in doc['scenes'] if chain[-1] in s.get('nodes',[])]
  assert scenes,('skin ancestor not scene root',path,idx)
  nodes[par]['children'].remove(idx)
  if not nodes[par]['children']:nodes[par].pop('children')
  for s in scenes:
   if idx not in s['nodes']:s['nodes'].append(idx)
  count+=1
 if count:
  encoded=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*((-len(encoded))%4)
  chunks[0]=(chunks[0][0],encoded)
  body=b''.join(struct.pack('<II',len(data),kind)+data for kind,data in chunks)
  path.write_bytes(struct.pack('<III',magic,version,len(body)+12)+body)
 return count
