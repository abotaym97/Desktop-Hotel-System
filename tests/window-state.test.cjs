const {test}=require('node:test'),assert=require('node:assert/strict');
const {fitBounds,tileBounds,accountDestination}=require('../src/window-state.cjs');
const displays=[{id:1,workArea:{x:0,y:0,width:1920,height:1040}},{id:2,workArea:{x:-1920,y:0,width:1920,height:1080}}];
test('restores separate window positions on a second display and recovers disconnected displays',()=>{
 const saved={x:-1800,y:100,width:1100,height:800};assert.deepEqual(fitBounds(saved,displays),saved);
 const recovered=fitBounds(saved,[displays[0]]);assert(recovered.x>=0);assert(recovered.x+recovered.width<=1920);
 assert.equal(fitBounds({x:5000,y:5000,width:5000,height:5000},displays).width,1920);
});
test('tiling stays within work area and uses non-overlapping columns',()=>{
 const rows=tileBounds(displays[1].workArea,4);assert.equal(rows.length,4);
 for(const r of rows){assert(r.x>=-1920&&r.x+r.width<=0);assert(r.y>=0&&r.y+r.height<=1080);}
 assert.equal(rows[0].x+rows[0].width,rows[1].x);assert.equal(rows[0].y+rows[0].height,rows[2].y);
});
test('room windows carry only numeric room-stay and branch IDs',()=>{
 assert.equal(accountDestination(12,3),'/admin/billing?stay=12&desktop_account=1&desktop_branch=3');
 for(const args of [[0,1],['../12',1],[1,null],['https://other',1]])assert.throws(()=>accountDestination(...args));
});
