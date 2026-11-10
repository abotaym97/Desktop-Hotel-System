function fitBounds(saved={},displays=[],defaults={width:1440,height:940}){
 const areas=displays.map(d=>d.workArea);if(!areas.length)throw Error('No available display');
 const valid=['x','y','width','height'].every(k=>Number.isFinite(saved[k]));
 const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 const best=valid?areas.reduce((a,b)=>overlap(saved,b)>overlap(saved,a)?b:a):areas[0];
 const found=valid&&overlap(saved,best)>0;
 const width=Math.round(Math.min(best.width,Math.max(Math.min(850,best.width),Number.isFinite(saved.width)?saved.width:defaults.width)));
 const height=Math.round(Math.min(best.height,Math.max(Math.min(650,best.height),Number.isFinite(saved.height)?saved.height:defaults.height)));
 return {x:Math.round(found?Math.max(best.x,Math.min(saved.x,best.x+best.width-width)):best.x+(best.width-width)/2),
  y:Math.round(found?Math.max(best.y,Math.min(saved.y,best.y+best.height-height)):best.y+(best.height-height)/2),width,height};
}
function tileBounds(area,count){
 const columns=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/columns);
 return Array.from({length:count},(_,i)=>{const col=i%columns,row=Math.floor(i/columns);const x=area.x+Math.round(col*area.width/columns),y=area.y+Math.round(row*area.height/rows);
  return {x,y,width:Math.round((col+1)*area.width/columns)-Math.round(col*area.width/columns),height:Math.round((row+1)*area.height/rows)-Math.round(row*area.height/rows)};});
}
function positiveId(value){return /^[1-9]\d{0,14}$/.test(String(value))?String(value):null;}
function accountDestination(id,branch){id=positiveId(id);branch=positiveId(branch);if(!id||!branch)throw Error('A valid room stay and branch are required');return `/admin/billing?stay=${id}&desktop_account=1&desktop_branch=${branch}`;}
module.exports={fitBounds,tileBounds,positiveId,accountDestination};
